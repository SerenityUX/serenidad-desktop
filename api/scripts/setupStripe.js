/* eslint-disable no-console */
/**
 * One-shot Stripe setup. Creates (or finds) the products, prices, and
 * Payment Links Kōdan needs, then prints the env vars to paste into your
 * deployment.
 *
 * Idempotent: each thing it creates is tagged with a stable
 * `metadata.kodan_id`, and the script looks up by that key before
 * creating. Re-running edits-in-place rather than duplicating.
 *
 * Pricing model (must stay in sync with api/routes/auth.js):
 *   Subscriptions = 20% margin → 80 tokens / $1
 *   One-time top-up = 30% margin → 70 tokens / $1, $5–$500 range
 *
 *   Starter  $10/mo   →   800 tokens / period
 *   Creator  $30/mo   →  2400 tokens / period
 *   Studio  $150/mo   → 12000 tokens / period
 *   Top-up   $1/unit  →    70 tokens / unit (adjustable 5..500 units)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   KODAN_WEB_URL=https://your-vercel-domain.vercel.app \
 *   node scripts/setupStripe.js
 *
 * Run with a TEST key first. Verify a checkout end-to-end. Then run again
 * with a live key in a fresh shell.
 *
 * The key needs WRITE permissions on Products, Prices, and Payment Links
 * for setup. After setup, your runtime API only needs the READ-only
 * restricted key. Don't reuse this setup key for runtime.
 */
require('dotenv').config();

const Stripe = require('stripe');

const SECRET = process.env.STRIPE_SECRET_KEY;
if (!SECRET) {
  console.error('ERROR: set STRIPE_SECRET_KEY before running.');
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(SECRET)) {
  console.error('ERROR: STRIPE_SECRET_KEY does not look like a Stripe key.');
  process.exit(1);
}

const WEB_URL = (
  process.env.KODAN_WEB_URL || 'https://serenidad-desktop.vercel.app'
).replace(/\/$/, '');

const SUCCESS_URL = `${WEB_URL}/home?purchase=success`;

const stripe = new Stripe(SECRET);

const SUBSCRIPTIONS = [
  { id: 'sub_starter', name: 'Kōdan Starter', tokens: 800,   monthly_cents: 1000 },
  { id: 'sub_creator', name: 'Kōdan Creator', tokens: 2400,  monthly_cents: 3000 },
  { id: 'sub_studio',  name: 'Kōdan Studio',  tokens: 12000, monthly_cents: 15000 },
];

const TOP_UP = {
  id: 'buy_tokens',
  name: 'Kōdan Tokens',
  tokens_per_unit: 70,
  unit_cents: 100, // $1 / unit
  min_units: 5,
  max_units: 500,
};

async function findByKodanId(resource, kodanId) {
  // `search` uses the metadata index; works on Products, Prices, Customers,
  // Subscriptions. Payment Links don't expose search, so we fall back to
  // listing for those.
  const res = await stripe[resource].search({
    query: `metadata['kodan_id']:'${kodanId}'`,
    limit: 1,
  });
  return res.data[0] || null;
}

async function ensureProduct(kodanId, attrs) {
  const existing = await findByKodanId('products', kodanId);
  if (existing) {
    if (existing.active && existing.name === attrs.name) {
      console.log(`  product (reused): ${existing.id}  ${existing.name}`);
      return existing;
    }
    const updated = await stripe.products.update(existing.id, {
      name: attrs.name,
      active: true,
      ...(attrs.description ? { description: attrs.description } : {}),
    });
    console.log(`  product (updated): ${updated.id}  ${updated.name}`);
    return updated;
  }
  const created = await stripe.products.create({
    name: attrs.name,
    description: attrs.description,
    metadata: { kodan_id: kodanId },
  });
  console.log(`  product (new): ${created.id}  ${created.name}`);
  return created;
}

async function ensurePrice(kodanId, productId, attrs) {
  const existing = await findByKodanId('prices', kodanId);
  if (existing && existing.active) {
    // Stripe prices are immutable on amount/interval. If anything important
    // changed, archive the old one and create a fresh price under the same
    // metadata id.
    const sameAmount = existing.unit_amount === attrs.unit_amount;
    const sameInterval =
      (existing.recurring?.interval || null) ===
      (attrs.recurring?.interval || null);
    if (sameAmount && sameInterval && existing.product === productId) {
      console.log(`  price   (reused): ${existing.id}  $${existing.unit_amount / 100}`);
      return existing;
    }
    await stripe.prices.update(existing.id, {
      active: false,
      metadata: { kodan_id: `${kodanId}_archived_${Date.now()}` },
    });
    console.log(`  price   (archived old): ${existing.id}`);
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: attrs.unit_amount,
    ...(attrs.recurring ? { recurring: attrs.recurring } : {}),
    metadata: { kodan_id: kodanId },
  });
  console.log(`  price   (new): ${created.id}  $${created.unit_amount / 100}`);
  return created;
}

/**
 * Payment Links don't have search-by-metadata. List active links and match
 * by metadata.kodan_id manually. Once found / created, write the price id
 * we want into a `kodan_price_id` metadata field for cheap drift detection
 * on re-runs.
 */
async function findPaymentLinkByKodanId(kodanId) {
  let after;
  for (let i = 0; i < 10; i++) {
    const page = await stripe.paymentLinks.list({
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    const hit = page.data.find((p) => p.metadata?.kodan_id === kodanId);
    if (hit) return hit;
    if (!page.has_more) break;
    after = page.data[page.data.length - 1].id;
  }
  return null;
}

async function ensurePaymentLink(kodanId, params) {
  const existing = await findPaymentLinkByKodanId(kodanId);
  if (existing) {
    // If the link still references the right price, leave it. Otherwise,
    // deactivate and create a fresh one (Stripe doesn't allow editing the
    // price array on a Payment Link).
    const targetPriceId = params.line_items[0].price;
    const refsCorrectPrice = existing.line_items?.data?.some?.(
      (li) => li.price?.id === targetPriceId,
    );
    if (existing.active && refsCorrectPrice) {
      console.log(`  link    (reused): ${existing.url}`);
      return existing;
    }
    await stripe.paymentLinks.update(existing.id, { active: false });
    console.log(`  link    (deactivated old): ${existing.id}`);
  }
  const created = await stripe.paymentLinks.create({
    ...params,
    metadata: {
      ...(params.metadata || {}),
      kodan_id: kodanId,
      kodan_price_id: params.line_items[0].price,
    },
    after_completion: {
      type: 'redirect',
      redirect: { url: SUCCESS_URL },
    },
  });
  console.log(`  link    (new): ${created.url}`);
  return created;
}

async function setupSubscription(spec) {
  console.log(`\n[${spec.id}]`);
  const product = await ensureProduct(spec.id, {
    name: spec.name,
    description: `${spec.tokens.toLocaleString()} Kōdan tokens per month`,
  });
  const price = await ensurePrice(`${spec.id}_price`, product.id, {
    unit_amount: spec.monthly_cents,
    recurring: { interval: 'month' },
  });
  const link = await ensurePaymentLink(`${spec.id}_link`, {
    line_items: [{ price: price.id, quantity: 1 }],
  });
  return { priceId: price.id, linkUrl: link.url };
}

async function setupTopUp(spec) {
  console.log(`\n[${spec.id}]`);
  const product = await ensureProduct(spec.id, {
    name: spec.name,
    description: `${spec.tokens_per_unit} tokens per $${spec.unit_cents / 100}. Adjustable quantity.`,
  });
  const price = await ensurePrice(`${spec.id}_price`, product.id, {
    unit_amount: spec.unit_cents,
  });
  const link = await ensurePaymentLink(`${spec.id}_link`, {
    line_items: [
      {
        price: price.id,
        quantity: spec.min_units,
        adjustable_quantity: {
          enabled: true,
          minimum: spec.min_units,
          maximum: spec.max_units,
        },
      },
    ],
  });
  return { priceId: price.id, linkUrl: link.url };
}

(async function main() {
  const mode = SECRET.includes('_test_') ? 'TEST' : 'LIVE';
  console.log(`\nKōdan / Stripe setup — running in ${mode} mode`);
  console.log(`After-payment redirect: ${SUCCESS_URL}\n`);

  const out = {};
  for (const spec of SUBSCRIPTIONS) {
    const { priceId, linkUrl } = await setupSubscription(spec);
    out[spec.id] = { priceId, linkUrl };
  }
  const topUp = await setupTopUp(TOP_UP);
  out[TOP_UP.id] = topUp;

  console.log('\n────────────────────────────────────────────────────');
  console.log('Done. Add these to your API service env (Coolify):\n');
  console.log(`STRIPE_PRICE_SUB_STARTER=${out.sub_starter.priceId}`);
  console.log(`STRIPE_PRICE_SUB_CREATOR=${out.sub_creator.priceId}`);
  console.log(`STRIPE_PRICE_SUB_STUDIO=${out.sub_studio.priceId}`);
  console.log(`STRIPE_PRICE_BUY_TOKENS=${out.buy_tokens.priceId}`);
  console.log('');
  console.log(`STRIPE_PAYMENT_LINK_SUB_STARTER=${out.sub_starter.linkUrl}`);
  console.log(`STRIPE_PAYMENT_LINK_SUB_CREATOR=${out.sub_creator.linkUrl}`);
  console.log(`STRIPE_PAYMENT_LINK_SUB_STUDIO=${out.sub_studio.linkUrl}`);
  console.log(`STRIPE_PAYMENT_LINK_BUY_TOKENS=${out.buy_tokens.linkUrl}`);
  console.log('────────────────────────────────────────────────────\n');
  console.log('Next:');
  console.log('  1. Paste those into Coolify env vars on the API service.');
  console.log('  2. Create a webhook endpoint in Stripe pointing at:');
  console.log(`     ${'https://api.serenidad.click/billing/stripe-webhook'}`);
  console.log('     Events: checkout.session.completed, invoice.payment_succeeded,');
  console.log('             customer.subscription.deleted');
  console.log('  3. Copy its signing secret into Coolify as STRIPE_WEBHOOK_SECRET.');
  console.log('  4. Redeploy the API service.\n');
})().catch((err) => {
  console.error('\nSetup failed:', err.message);
  if (err.raw?.message) console.error(err.raw.message);
  process.exit(1);
});
