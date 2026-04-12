const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const b64 = process.env.FIREBASE_PRIVATE_KEY;
if (!b64) {
    console.log('No FIREBASE_PRIVATE_KEY found in .env');
    process.exit(1);
}

let privateKey = b64;
if (privateKey.startsWith('LS0tLS1')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('ascii');
}

console.log('--- DECODED KEY START ---');
console.log(privateKey.substring(0, 50));
console.log('--- DECODED KEY END ---');
console.log(privateKey.substring(privateKey.length - 50));

const hasLiteralNewlines = privateKey.includes('\\n');
console.log('Has literal \\n strings:', hasLiteralNewlines);

if (hasLiteralNewlines) {
    console.log('Replacing literal \\n with real newlines...');
    privateKey = privateKey.replace(/\\n/g, '\n');
}

console.log('Final Key format check (First 2 lines):');
console.log(privateKey.split('\n').slice(0, 2).join('\n'));
