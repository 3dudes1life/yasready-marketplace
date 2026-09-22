import fs from 'node:fs';
const root=new URL('../',import.meta.url);const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const checks=[
 ['version',read('package.json').includes('"version": "0.14.0"')],
 ['operations-lib',read('src/lib/ingram-operations.mjs').includes('INGRAM_OPERATIONS_SCHEMA')],
 ['mapping-table',read('migrations/0014_ingram_operations.sql').includes('provider_title_mappings')],
 ['reconciliation-cases',read('migrations/0014_ingram_operations.sql').includes('provider_reconciliation_cases')],
 ['readiness-runs',read('migrations/0014_ingram_operations.sql').includes('provider_readiness_runs')],
 ['author-api',read('src/worker.mjs').includes('/api/me/ingram/operations')],
 ['admin-api',read('src/worker.mjs').includes('/api/admin/ingram/operations')],
 ['cost-import',read('src/worker.mjs').includes('/api/providers/ingram/costs/import')],
 ['dead-letter-actions',read('src/worker.mjs').includes('admin\/ingram\/dead-letters')],
 ['ops-ui',read('src/main.js').includes('INGRAM OPERATIONS')&&read('src/main.js').includes('READINESS CHECKLIST')],
 ['safe-cost-gate',read('wrangler.jsonc').includes('"INGRAM_COST_IMPORT_ENABLED": "false"')],
 ['submission-off',read('wrangler.jsonc').includes('"INGRAM_SUBMISSION_ENABLED": "false"')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(!ok)failed++;}console.log(`\n${checks.length-failed}/${checks.length} Ingram Operations checks passed.`);if(failed)process.exit(1);
