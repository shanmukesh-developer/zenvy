const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { id: '41e5d9fb-4663-434c-9bcd-17456523b464', phone: '1276981697', role: 'customer' },
  'super_secret_zenvy_token_2026',
  { expiresIn: '30d' }
);

const req = http.request({
  hostname: 'localhost',
  port: 8080,
  path: '/api/friends',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log(parsed.map(f => ({ name: f.name, friendshipId: f.friendshipId, streak: f.streakCount })));
    process.exit(0);
  });
});
req.end();
