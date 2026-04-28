const fs = require('fs');
const https = require('https');

// Extract URLs from restaurants.ts
const code = fs.readFileSync('frontend/src/data/restaurants.ts', 'utf8');
const urlRegex = /(?:https:\/\/images\.unsplash\.com\/|https:\/\/picsum\.photos\/|https:\/\/images\.pexels\.com\/)[^"'\s?]+(?:\?[^"'\s]*)?/g;
const localRegex = /"\/assets\/[^"']+"/g;

const seedCode = fs.readFileSync('backend/scripts/unified_seed.js', 'utf8');
const vaultUrls = [...new Set(seedCode.match(urlRegex) || [])];

const urls = [...new Set([...(code.match(urlRegex) || []), ...vaultUrls])];
const localPaths = [...new Set((code.match(localRegex) || []).map(p => p.slice(1, -1)))];

console.log(`Found ${urls.length} remote URLs (including Vault) and ${localPaths.length} local paths to test.`);

let broken = [];
let complete = 0;
let total = urls.length + localPaths.length;

if (total === 0) {
  console.log('⚠️ No assets found to check.');
  process.exit(0);
}

function checkUrl(url, method = 'HEAD') {
  const req = https.request(url, { method, timeout: 5000 }, (res) => {
    if (res.statusCode >= 400) {
      if (method === 'HEAD' && (res.statusCode === 405 || res.statusCode === 403)) {
        // Fallback to GET for services that block HEAD
        return checkUrl(url, 'GET');
      }
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
  complete++;
  if (complete === total) {
    if (broken.length === 0) {
      console.log('✅ ALL IMAGES ARE PRESENT AND WORKING PERFECTLY!');
    } else {
      console.log('❌ FOUND BROKEN IMAGES:');
      broken.forEach(b => console.log(`- ${b.status}: ${b.url}`));
    }
  }
}

// Check local paths
localPaths.forEach(path => {
    const fullPath = `frontend/public${path}`;
    if (!fs.existsSync(fullPath)) {
        broken.push({ url: path, status: 'FILE_MISSING' });
    }
    done();
});

// Check remote URLs
urls.forEach((url, i) => {
  setTimeout(() => checkUrl(url), i * 100);
});
