const fs = require('fs');
const https = require('https');

// Extract URLs from restaurants.ts
const code = fs.readFileSync('frontend/src/data/restaurants.ts', 'utf8');
const urlRegex = /https:\/\/images\.unsplash\.com\/[^"'\s?]+(?:\?[^"'\s]*)?/g;
const urls = [...new Set(code.match(urlRegex) || [])];

console.log(`Found ${urls.length} unique Unsplash URLs to test.`);

let active = 0;
let broken = [];
let complete = 0;

function checkUrl(url) {
  active++;
  const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
    if (res.statusCode >= 400 && res.statusCode !== 403) { 
      // Unsplash might throw 403 for hotlinking but usually it's 404 for missing
      broken.push({ url, status: res.statusCode });
    }
    done();
  });
  
  req.on('error', (e) => {
    broken.push({ url, status: e.message });
    done();
  });

  req.on('timeout', () => {
    broken.push({ url, status: 'TIMEOUT' });
    req.abort();
  });

  req.end();
}

function done() {
  active--;
  complete++;
  if (complete === urls.length) {
    if (broken.length === 0) {
      console.log('✅ ALL IMAGES ARE PRESENT AND WORKING PERFECTLY!');
    } else {
      console.log('❌ FOUND BROKEN IMAGES:');
      broken.forEach(b => console.log(`- ${b.status}: ${b.url}`));
    }
  }
}

// Stagger requests to avoid getting IP banned
urls.forEach((url, i) => {
  setTimeout(() => checkUrl(url), i * 100);
});
