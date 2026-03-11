const http = require('http');

const data = JSON.stringify({
  message: {
    text: '/help',
    chat: { id: 12345 }
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log('RESPONSE BODY:');
    console.log(body);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
