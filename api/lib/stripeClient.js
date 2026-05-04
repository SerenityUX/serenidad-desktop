/**
 * Lazy Stripe SDK + Payment Link discovery cache.
 *
 * The frontend asks the API for token-package metadata (label, price,
 * paymentLinkUrl). Rather than making the operator paste 4 STRIPE_PAYMENT_LINK_*
 * env vars after every setup, we discover them at runtime by listing
 * Payment Links and matching on the `kodan_id` metadata tag we wrote when
 * scripts/setupStripe.js created them.
 *
 * Cached in-process, refreshed every 10 minutes (or on first request).
 * If STRIPE_SECRET_KEY isn't configured the helpers return safe defaults
 * so the rest of the app still boots.
 */
const Stripe = require('stripe');

const SECRET = process.env.STRIPE_SECRET_KEY || '';
const stripe = SECRET ? new Stripe(SECRET) : null;

const PAYMENT_LINK_KODAN_IDS = {
  sub_starter: 'sub_starter_link',
  sub_creator: 'sub_creator_link',
  sub_studio: 'sub_studio_link',
  buy_tokens: 'buy_tokens_link',
};

const REFRESH_MS = 10 * 60 * 1000; // 10 minutes
let cache = null;
let cacheAt = 0;
let inFlight = null;

async function fetchPaymentLinkMap() {
  if (!stripe) return {};
  const map = {};
  let after;
  for (let i = 0; i < 10; i++) {
    const page = await stripe.paymentLinks.list({
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    for (const link of page.data) {
      if (!link.active) continue;
      const id = link.metadata?.kodan_id;
      if (!id) continue;
      // Reverse-map kodan_id-of-link back to its package key.
      for (const [pkgKey, linkKey] of Object.entries(PAYMENT_LINK_KODAN_IDS)) {
        if (id === linkKey) map[pkgKey] = link.url;
      }
    }
    if (!page.has_more) break;
    after = page.data[page.data.length - 1].id;
  }
  return map;
}

async function getPaymentLinkUrls() {
  if (!stripe) return {};
  const fresh = Date.now() - cacheAt < REFRESH_MS;
  if (cache && fresh) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const next = await fetchPaymentLinkMap();
      cache = next;
      cacheAt = Date.now();
      return next;
    } catch (e) {
      console.warn('[stripe] payment-link discovery failed:', e.message);
      // Serve last good cache on failure rather than 500ing the route.
      return cache || {};
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Map a Stripe price id back to the kodan package key (sub_starter, etc.)
 * by reading the env-var configuration the operator pasted after running
 * setupStripe.js. Used by the webhook to figure out token amount per tier.
 */
function tierForPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_SUB_STARTER) return 'sub_starter';
  if (priceId === process.env.STRIPE_PRICE_SUB_CREATOR) return 'sub_creator';
  if (priceId === process.env.STRIPE_PRICE_SUB_STUDIO) return 'sub_studio';
  if (priceId === process.env.STRIPE_PRICE_BUY_TOKENS) return 'buy_tokens';
  return null;
}

const SUBSCRIPTION_TOKENS = {
  sub_starter: 800,
  sub_creator: 2400,
  sub_studio: 12000,
};

const ONE_TIME_TOKENS_PER_DOLLAR = 70;

module.exports = {
  stripe,
  isConfigured: () => !!stripe,
  getPaymentLinkUrls,
  tierForPriceId,
  SUBSCRIPTION_TOKENS,
  ONE_TIME_TOKENS_PER_DOLLAR,
};
