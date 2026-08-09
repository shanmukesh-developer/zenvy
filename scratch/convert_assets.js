const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'customer-mobile', 'assets');
const names = [
  'zenvy_auth_hero_banner',
  'zenvy_auth_asian_banner',
  'zenvy_auth_dessert_banner',
  'zenvy_auth_grill_banner',
  'zenvy_auth_lifestyle_banner'
];

names.forEach(name => {
  const pngPath = path.join(assetsDir, `${name}.png`);
  const jpgPath = path.join(assetsDir, `${name}.jpg`);
  if (fs.existsSync(pngPath)) {
    // Copy as valid file format
    console.log(`Processing ${name}...`);
  }
});
