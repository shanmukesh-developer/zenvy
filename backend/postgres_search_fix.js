const fs = require('fs');
const files = [
  'c:\\hostel-bite\\backend\\controllers\\searchController.js',
  'c:\\hostel-bite\\backend\\controllers\\adminController.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  content = content.replace(/\[\s*Op\.like\s*\]/g, '[Op.iLike]');
  fs.writeFileSync(f, content, 'utf-8');
});
console.log('Upgraded Op.like to Op.iLike for case-insensitive Postgres searching.');
