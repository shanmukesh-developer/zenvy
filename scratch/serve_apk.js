const http = require('http');
const fs = require('fs');
const path = require('path');

const apkPath = path.join(__dirname, '..', 'zenvy-customer.apk');
const PORT = 8090;

const server = http.createServer((req, res) => {
  if (fs.existsSync(apkPath)) {
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="zenvy-customer.apk"',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(apkPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('APK file not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Direct APK Download Server running on port ${PORT}`);
});
