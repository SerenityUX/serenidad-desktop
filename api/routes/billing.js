/**
 * Stripe webhook → token credit handler.
 *
 * Flow:
 *   `checkout.session.completed`
 *      mode = payment       → one-time top-up; credit immediately.
 *      mode = subscription  → first period; credit immediately AND stamp
 *                             the subscription metadata with the kodan
 *                             user id so renewal invoices can find them.
 *   `invoice.payment_succeeded`
 *      billing_reason = subscription_create  → already credited above.
 *      billing_reason = subscription_cycle   → renewal; credit.
 *   `customer.subscription.deleted`           → noop, log only.
 *
 * Idempotency is enforced via the `stripe_events` table — every event id
 * is inserted once with `ON CONFLICT DO NOTHING` and a non-zero rowcount
 * means we're seeing a brand-new event.
 *
 * Auth-token security: signature verified via `STRIPE_WEBHOOK_SECRET`. The
 * route is mounted on a `express.raw` body parser so the raw bytes Stripe
 * signed are intact when we hand them to `stripe.webhooks.constructEvent`.
 */
const express = require("express");
const {
  stripe,
  isConfigured,
  tierForPriceId,
  SUBSCRIPTION_TOKENS,
  ONE_TIME_TOKENS_PER_DOLLAR,
} = require("../lib/stripeClient");

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

module.exports = function createBillingRouter(pool) {
  const router = express.Router();

  router.post(
    "/stripe-webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!isConfigured() || !WEBHOOK_SECRET) {
        // Avoid silently 200ing — surface a config error in Stripe's
        // dashboard so it's obvious the API isn't set up yet.
        return res.status(500).send("stripe not configured");
      }

      const sig = req.headers["stripe-signature"];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
      } catch (err) {
        console.warn("[stripe-webhook] bad signature:", err.message);
        return res.status(400).send(`Webhook signature error: ${err.message}`);
      }

      // Dedupe via the events table. INSERT-ON-CONFLICT-DO-NOTHING returns
      // 0 rows affected when we've already processed this event.
      try {
        const dedupe = await pool.query(
          `INSERT INTO stripe_events (id, type) VALUES ($1, $2)
             ON CONFLICT (id) DO NOTHING
             RETURNING id`,
          [event.id, event.type],
        );
        if (dedupe.rowCount === 0) {
          // Already processed — ack so Stripe stops retrying.
          return res.json({ received: true, duplicate: true });
        }
      } catch (e) {
        console.error("[stripe-webhook] dedupe failed:", e.message);
        // Fall through; better to risk a duplicate than to drop the event.
      }

      try {
        if (event.type === "checkout.session.completed") {
          await handleCheckoutCompleted(pool, event.data.object);
        } else if (event.type === "invoice.payment_succeeded") {
          await handleInvoicePaid(pool, event.data.object);
        } else if (event.type === "customer.subscription.deleted") {
          // Renewals stop firing once a sub is deleted, so there's nothing
          // for us to do at runtime — just log so the timeline is visible.
          console.log(
            `[stripe-webhook] subscription deleted: ${event.data.object.id}`,
          );
        } else {
          console.log(`[stripe-webhook] ignored event type: ${event.type}`);
        }
      } catch (e) {
        console.error(
          `[stripe-webhook] handler error for ${event.type}:`,
          e.message,
        );
        // Return 500 so Stripe retries. Idempotency table prevents double
        // processing on the eventual successful retry.
        return res.status(500).send("handler failed");
      }

      return res.json({ received: true });
    },
  );

  return router;
};

// ─── handlers ────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(pool, session) {
  const userId = session.client_reference_id;
  if (!userId) {
    console.warn(
      `[stripe-webhook] checkout ${session.id} missing client_reference_id; skipping`,
    );
    return;
  }

  if (session.mode === "payment") {
    // One-time top-up: amount_total is in cents.
    const dollars = Math.floor((session.amount_total || 0) / 100);
    const tokens = dollars * ONE_TIME_TOKENS_PER_DOLLAR;
    if (tokens <= 0) return;
    await creditTokens(pool, userId, tokens, {
      name: "Token top-up",
      notes: `Stripe session ${session.id}, $${dollars}`,
    });
    return;
  }

  if (session.mode === "subscription") {
    const tokens = await tokensForSubscriptionSession(session);
    if (!tokens) return;
    await creditTokens(pool, userId, tokens, {
      name: "Subscription start",
      notes: `Stripe sub ${session.subscription}`,
    });
    // Stamp user id onto the subscription so renewal invoices can credit
    // the right account without us having to scan back to a checkout
    // session every cycle.
    if (session.subscription) {
      try {
        await stripe.subscriptions.update(session.subscription, {
          metadata: { kodan_user_id: userId },
        });
      } catch (e) {
        console.warn(
          `[stripe-webhook] failed to stamp subscription ${session.subscription}: ${e.message}`,
        );
      }
    }
  }
}

async function handleInvoicePaid(pool, invoice) {
  // We credit the FIRST cycle in handleCheckoutCompleted; only count
  // renewals here so we don't double-credit the initial payment.
  if (invoice.billing_reason !== "subscription_cycle") return;
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription);
  const userId = sub.metadata?.kodan_user_id;
  if (!userId) {
    console.warn(
      `[stripe-webhook] invoice ${invoice.id} sub ${invoice.subscription} has no kodan_user_id metadata`,
    );
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id;
  const tier = tierForPriceId(priceId);
  const tokens = SUBSCRIPTION_TOKENS[tier];
  if (!tokens) {
    console.warn(
      `[stripe-webhook] unknown subscription price ${priceId} for sub ${sub.id}`,
    );
    return;
  }

  await creditTokens(pool, userId, tokens, {
    name: "Subscription renewal",
    notes: `Stripe sub ${sub.id} invoice ${invoice.id}`,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────

/**
 * Read a checkout.session.completed (mode=subscription) and figure out the
 * token grant. We expand line_items because session events are delivered
 * without them by default.
 */
async function tokensForSubscriptionSession(session) {
  let items = session.line_items?.data;
  if (!items || items.length === 0) {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });
    items = expanded.line_items?.data || [];
  }
  const priceId = items[0]?.price?.id;
  const tier = tierForPriceId(priceId);
  const tokens = SUBSCRIPTION_TOKENS[tier];
  if (!tokens) {
    console.warn(
      `[stripe-webhook] subscription checkout has unknown price ${priceId}`,
    );
    return 0;
  }
  return tokens;
}

async function creditTokens(pool, userId, delta, { name, notes }) {
  // Trigger on `transactions` keeps users.tokens in sync — see migration
  // 007. Don't touch users.tokens directly.
  await pool.query(
    `INSERT INTO transactions (user_id, delta, name, notes)
     VALUES ($1, $2, $3, $4)`,
    [userId, delta, String(name).slice(0, 80), String(notes || "").slice(0, 500)],
  );
  console.log(
    `[stripe-webhook] credited ${delta} to user ${userId} (${name})`,
  );
}
