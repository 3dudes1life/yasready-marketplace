export const STRIPE_TEST_SCENARIOS=[
  'single_author_checkout','multi_author_checkout','signed_webhook_replay','digital_entitlement_grant','connect_onboarding','refund_reconciliation','transfer_ceiling','dispute_hold'
];

export function stripeTestReadiness(env={}){
  const mode=env.STRIPE_MODE||'off';
  const checks={
    testMode:mode==='test',
    liveMode:mode==='live',
    checkoutSwitch:env.CHECKOUT_ENABLED==='true',
    secretKey:!!env.STRIPE_SECRET_KEY,
    webhookSecret:!!env.STRIPE_WEBHOOK_SECRET,
    connectWebhookSecret:!!env.STRIPE_CONNECT_WEBHOOK_SECRET,
    publicAppUrl:!!env.PUBLIC_APP_URL,
    refundsSwitch:env.REFUNDS_ENABLED==='true',
    transfersSwitch:env.TRANSFERS_ENABLED==='true'
  };
  return {
    mode,
    checks,
    checkoutTestReady:checks.testMode&&checks.checkoutSwitch&&checks.secretKey&&checks.webhookSecret&&checks.publicAppUrl,
    connectTestReady:checks.testMode&&checks.secretKey&&checks.connectWebhookSecret,
    refundsTestReady:checks.testMode&&checks.secretKey&&checks.refundsSwitch,
    transfersTestReady:checks.testMode&&checks.secretKey&&checks.transfersSwitch,
    liveMoneyEnabled:mode==='live'&&checks.checkoutSwitch,
    scenarios:[...STRIPE_TEST_SCENARIOS]
  };
}

export function evaluateStripeTestRun(results={}){
  const normalized={};
  for(const key of STRIPE_TEST_SCENARIOS) normalized[key]=results[key]===true;
  const passed=STRIPE_TEST_SCENARIOS.every(k=>normalized[k]);
  return {passed,status:passed?'passed':'failed',results:normalized,passedCount:Object.values(normalized).filter(Boolean).length,total:STRIPE_TEST_SCENARIOS.length};
}
