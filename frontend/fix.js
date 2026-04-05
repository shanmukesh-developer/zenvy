const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/app/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Global market cards
content = content.replace(/<div className="flex justify-between items-center mt-1">\s*<span className="text-\[8px\] font-bold text-secondary-text uppercase tracking-widest">\{item\.restaurantName\}<\/span>/g, `<div className="flex justify-between items-start mt-1 gap-2 min-w-0 overflow-hidden">\n                          <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</span>`);

// Chef picks
content = content.replace(/<div className="flex items-center justify-between">\s*<p className="text-\[8px\] font-bold text-secondary-text uppercase tracking-widest">\{item\.restaurantName\}<\/p>/g, `<div className="flex items-start justify-between gap-2 min-w-0 overflow-hidden mt-1">\n                          <p className="text-[8px] font-bold text-secondary-text uppercase tracking-widest truncate min-w-0 flex-1" title={item.restaurantName}>{item.restaurantName}</p>`);

// Add shrink-0 to prices
content = content.replace(/className="text-\[10px\] font-black text-([^"]+)"/g, 'className="text-[10px] font-black shrink-0 text-$1"');

fs.writeFileSync(file, content);
console.log('Fixed all product card clipping errors globally.');
