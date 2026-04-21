const http = require('http');

const endpoints = [
  '/api/admin/verify-company',
  '/api/auth/create-user',
  '/api/chat/send',
  '/api/company/onboard',
  '/api/cron/auto-release',
  '/api/cron/escrow-auto-release',
  '/api/escrow/cancel',
  '/api/escrow/refund',
  '/api/escrow/release',
  '/api/gig/accept-offer',
  '/api/gig/apply',
  '/api/gig/buy-p2p',
  '/api/gig/complete',
  '/api/gig/deliver',
  '/api/gig/deliver-files',
  '/api/gig/dispute',
  '/api/gig/handshake',
  '/api/gig/hire',
  '/api/gig/rate-poster',
  '/api/gig/reject-offer',
  '/api/gig/report',
  '/api/gig/update-price',
  '/api/gig/verify-handshake',
  '/api/kyc/upload',
  '/api/moderation',
  '/api/payments/create-order',
  '/api/payments/verify-payment',
  '/api/profile/worker-setup',
  '/api/referral/apply',
  '/api/referral/redeem',
  '/api/rental/confirm-return',
  '/api/rental/return',
  '/api/telegram/broadcast',
  '/api/telegram/webhook'
];

async function checkEndpoint(path) {
  return new Promise((resolve) => {
    // Making GET requests since we just want to know if the route resolves
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    }, (res) => {
      resolve({ path, status: res.statusCode });
    });

    req.on('error', (e) => {
      resolve({ path, status: `ERROR: ${e.message}` });
    });

    req.end();
  });
}

async function run() {
  console.log('--- API Health Check ---');
  let issues = 0;
  for (const path of endpoints) {
    const result = await checkEndpoint(path);
    // 405 Method Not Allowed is expected for POST-only routes.
    // 401 Unauthorized, 400 Bad Request are also expected as we have no body/auth.
    // 404 is bad (missing route). 500 is bad (crashing instead of returning 400).
    let statusText = "\x1b[32mOK\x1b[0m";
    if (result.status === 404) {
      statusText = "\x1b[31mMISSING (404)\x1b[0m";
      issues++;
    } else if (result.status >= 500) {
      statusText = `\x1b[33mERROR (${result.status})\x1b[0m`;
      issues++;
    } else {
      statusText = `\x1b[32mUP (${result.status})\x1b[0m`;
    }
    
    console.log(`${path.padEnd(35)} [${statusText}]`);
  }
  
  if (issues > 0) {
    console.log(`\n\x1b[31mFound ${issues} potential endpoint issues (404s or 500s).\x1b[0m`);
  } else {
    console.log(`\n\x1b[32mAll endpoints responded. Routes are healthy.\x1b[0m`);
  }
}

run();
