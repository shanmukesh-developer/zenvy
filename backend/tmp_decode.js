const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const match = env.match(/FIREBASE_PRIVATE_KEY="([^"]+)"/);
if (match) {
    const encoded = match[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const outPath = 'C:/Users/Shanmukh/.gemini/antigravity/brain/d413961d-c375-4348-8e04-bdfc32af0966/browser/key.txt';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, decoded);
    console.log('Decoded key written to:', outPath);
} else {
    console.log('No key match found');
}
