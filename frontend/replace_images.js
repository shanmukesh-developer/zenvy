const fs = require('fs');
const path = 'c:\\hostel-bite\\frontend\\src\\app\\page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Replace starting tag <Image with <SafeImage where src has item.imageUrl
content = content.replace(/<Image\s+(?=src=\{item\.imageUrl)/g, '<SafeImage ');

fs.writeFileSync(path, content, 'utf-8');
console.log('Replaced Image with SafeImage where src contains item.imageUrl');
