import fs from 'node:fs';
const required=['dist/index.html','src/worker.mjs','src/lib/auth.mjs','src/lib/stripe-server.mjs','src/lib/ingram.mjs','migrations/0001_foundation.sql','migrations/0002_marketplace_engine.sql','migrations/0005_commerce_pro.sql','migrations/0006_commerce_operations.sql','src/lib/commerce.mjs','docs/SHARED-ACCOUNT-CONTRACT.md','docs/BUSINESS-HANDOFF.md','docs/PROVIDER-INTEGRATIONS.md','src/lib/analytics-brain.mjs','migrations/0012_analytics_brain.sql','docs/ANALYTICS-BRAIN.md','src/lib/books-app.mjs','src/lib/stripe-test-cert.mjs','migrations/0013_stripe_test_books_app.sql','docs/BOOKS-APP-BRIDGE.md','docs/STRIPE-TEST-CLOSURE.md'];
for(const p of required){if(!fs.existsSync(p)) throw new Error(`Missing ${p}`)}
const html=fs.readFileSync('dist/index.html','utf8');if(!/Marketplace \| YasReady/.test(html)) throw new Error('Brand title missing');
const worker=fs.readFileSync('src/worker.mjs','utf8');
for(const route of ['/api/session','/api/me/stats','/api/me/campaigns','/api/me/business-export','/api/me/analytics-brain','/api/me/stripe/onboard','/api/webhooks/stripe','/api/me/orders','/api/me/ledger','/api/me/payouts','/api/me/fulfillment','/api/admin/refunds','/api/admin/transfers/create']) if(!worker.includes(route)) throw new Error(`Missing engine route ${route}`);
const cfg=fs.readFileSync('wrangler.jsonc','utf8');
if(!cfg.includes('"CHECKOUT_ENABLED": "false"')) throw new Error('Checkout must fail closed');
console.log('✅ Marketplace | YasReady v0.11.0 verified: Commerce + Books App Bridge + prior Marketplace layers are present in the production bundle.');
