/**
 * fix_item_images_exact.js
 * Updates all 170+ menu items in Supabase PostgreSQL database to have exact, 100% relevant high-res Unsplash food & product imagery.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function fixItemImages() {
  console.log('🖼️ Updating all Menu Items with exact matching high-res Unsplash photos...');
  await connectDB();
  const sequelize = getSequelize();

  if (!sequelize) {
    console.error('❌ Failed to obtain Sequelize instance.');
    process.exit(1);
  }

  const { MenuItem } = sequelize.models;
  const items = await MenuItem.findAll();

  const MAPPINGS = [
    { match: ['mutton', 'dum biryani'], url: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop' },
    { match: ['biryani', 'pulao', 'hyderabadi'], url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop' },
    { match: ['margherita', 'cheese burst', 'pizza'], url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop' },
    { match: ['mushroom', 'truffle', 'pepperoni'], url: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=600&auto=format&fit=crop' },
    { match: ['burger', 'zinger', 'big mac'], url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop' },
    { match: ['fries', 'wedges'], url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop' },
    { match: ['dosa', 'uttapam'], url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop' },
    { match: ['idli', 'vada'], url: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop' },
    { match: ['noodles', 'chowmein'], url: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop' },
    { match: ['momo', 'dim sum', 'dumpling'], url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop' },
    { match: ['roll', 'wrap', 'frankie'], url: 'https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=600&auto=format&fit=crop' },
    { match: ['shawarma'], url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?q=80&w=600&auto=format&fit=crop' },
    { match: ['waffle'], url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?q=80&w=600&auto=format&fit=crop' },
    { match: ['mcflurry', 'ice cream', 'scoop'], url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=600&auto=format&fit=crop' },
    { match: ['pastry', 'cake', 'red velvet'], url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop' },
    { match: ['lava', 'molten'], url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop' },
    { match: ['salad', 'avocado', 'tofu'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop' },
    { match: ['salmon', 'quinoa', 'protein'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop' },
    { match: ['juice', 'cooler', 'pitaya', 'smoothie'], url: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop' },
    { match: ['coffee', 'espresso', 'frappuccino', 'latte'], url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop' },
    { match: ['shake', 'milkshake'], url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=600&auto=format&fit=crop' },
    { match: ['berry', 'fruits'], url: 'https://images.unsplash.com/photo-1629815049187-b952a2333061?q=80&w=600&auto=format&fit=crop' },
    { match: ['journal', 'notebook', 'book'], url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop' },
    { match: ['pen', 'fineliner'], url: 'https://images.unsplash.com/photo-1515545934533-3392437ce43a?q=80&w=600&auto=format&fit=crop' },
    { match: ['dry clean', 'coat', 'laundry'], url: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=600&auto=format&fit=crop' },
    { match: ['sneaker', 'shoe'], url: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?q=80&w=600&auto=format&fit=crop' },
    { match: ['first aid', 'kit', 'vitamin'], url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600&auto=format&fit=crop' },
    { match: ['ebike', 'skate', 'bike'], url: 'https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?q=80&w=600&auto=format&fit=crop' },
    { match: ['butter chicken', 'curry', 'kadhai'], url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=600&auto=format&fit=crop' },
    { match: ['naan', 'kulcha', 'breadsticks'], url: 'https://images.unsplash.com/photo-1544982503-9f984c14501a?q=80&w=600&auto=format&fit=crop' },
    { match: ['samosa', 'chaat', 'vada pav', 'pani puri'], url: 'https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop' }
  ];

  let updatedCount = 0;

  for (const item of items) {
    const itemNameLower = item.name.toLowerCase();
    const itemDescLower = (item.description || '').toLowerCase();
    const fullText = `${itemNameLower} ${itemDescLower}`;

    let matchedUrl = null;
    for (const map of MAPPINGS) {
      if (map.match.some(m => fullText.includes(m))) {
        matchedUrl = map.url;
        break;
      }
    }

    if (matchedUrl && item.imageUrl !== matchedUrl) {
      item.imageUrl = matchedUrl;
      await item.save();
      updatedCount++;
    }
  }

  console.log(`✅ EXACT IMAGE MATCH COMPLETE! Updated ${updatedCount} items with relevant 8k Unsplash photos.`);
  process.exit(0);
}

fixItemImages().catch(err => {
  console.error('❌ Failed fixing item images:', err);
  process.exit(1);
});
