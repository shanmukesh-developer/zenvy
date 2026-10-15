// backend/utils/pricingSchema.js

// This mirrors the frontend CustomizeDrawer options to securely calculate addon costs on the server.
const detectProductType = (name, tags = [], category = '') => {
  const searchStr = `${name} ${(tags || []).join(' ')} ${category || ''}`.toLowerCase();
  
  const DETECTION = [
    { type: 'cake',     keywords: /cake|pastry|brownie|cupcake|cheesecake|gateau|truffle/i },
    { type: 'pizza',    keywords: /pizza|calzone/i },
    { type: 'biryani',  keywords: /biryani|biriyani|pulao|rice bowl/i },
    { type: 'beverage', keywords: /juice|shake|coffee|tea|chai|lassi|smoothie|lemonade|mojito|cold brew|frappe|soda|milkshake|coolant/i },
    { type: 'sweets',   keywords: /sweet|laddu|ladoo|barfi|halwa|jalebi|kaju|peda|mysore pak|rasgulla|gulab jamun|soan papdi|dry fruit|mithai/i },
    { type: 'burger',   keywords: /burger|sandwich|wrap|sub|roll|frank|hotdog/i },
    { type: 'dessert',  keywords: /ice cream|kulfi|falooda|sundae|gelato|popsicle|rabri|gulab jamun|rasgulla/i },
    { type: 'fruit',    keywords: /fruit|apple|banana|mango|grapes|orange|watermelon|papaya|kiwi|berry/i },
    { type: 'laundry',  keywords: /dry wash|laundry|wash|ironing|clothes|dry clean/i },
    { type: 'rental',   keywords: /rental|car|bike|scooter|driver|cab|taxi/i },
    { type: 'pharmacy', keywords: /pharmacy|medicine|first aid|tablet|syrup|supplement|vitamin|pill|bandage|kit/i },
    { type: 'general-food', keywords: /curry|meal|rice|roti|naan|noodle|pasta|soup|salad|starter|thali|dish/i },
  ];

  for (const d of DETECTION) {
    if (d.keywords.test(searchStr)) return d.type;
  }
  return 'general';
};

const calculateCustomizationCost = (basePrice, dbItem, customizations) => {
  if (!customizations || typeof customizations !== 'object') return 0;

  const type = detectProductType(dbItem.name, dbItem.tags, dbItem.category);
  let extraCost = 0;

  // Only the option fields a paid add-on can come from count (the keys mirror CustomizeDrawer).
  // Free-text fields (cakeMessage, specialInstructions, rentalDriverContact, ...) never add a
  // surcharge: a cake message "Mango" used to be billed as the Mango flavour (+30).
  const FIELDS = {
    weight: ['weight'],
    size: ['size'],
    flavor: ['flavor'],
    egg: ['eggPreference'],
    crust: ['crust'],
    toppings: ['toppings'],
    rental: ['rentalDetails'],
    laundry: ['clothesType', 'serviceType', 'laundryService'],
  };
  const matchAddon = (fieldGroup, val, addAmount) => {
    const keys = FIELDS[fieldGroup] || [];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(customizations, key)) continue;
      const fieldVal = customizations[key];
      if (Array.isArray(fieldVal) ? fieldVal.includes(val) : fieldVal === val) extraCost += addAmount;
    }
  };

  switch (type) {
    case 'cake':
      matchAddon('weight', '1 Kg', Math.round(basePrice * 0.8));
      matchAddon('weight', '1.5 Kg', Math.round(basePrice * 1.5));
      matchAddon('weight', '2 Kg', Math.round(basePrice * 2.5));
      matchAddon('flavor', 'Red Velvet', 50);
      matchAddon('flavor', 'Mango', 30);
      matchAddon('egg', 'Eggless', 20);
      break;

    case 'pizza':
      matchAddon('size', 'Medium', 60);
      matchAddon('size', 'Large', 120);
      matchAddon('crust', 'Cheese Burst', 70);
      matchAddon('crust', 'Stuffed Crust', 90);
      matchAddon('toppings', 'Extra Cheese', 40);
      matchAddon('toppings', 'Olives', 25);
      matchAddon('toppings', 'Jalapeños', 20);
      matchAddon('toppings', 'Mushrooms', 25);
      matchAddon('toppings', 'Onions', 15);
      matchAddon('toppings', 'Paneer', 35);
      matchAddon('toppings', 'Corn', 15);
      break;

    case 'biryani':
      matchAddon('size', 'Full', Math.round(basePrice * 0.7));
      matchAddon('size', 'Family', Math.round(basePrice * 1.8));
      matchAddon('toppings', 'Raita', 25);
      matchAddon('toppings', 'Salan', 20);
      matchAddon('toppings', 'Extra Masala', 15);
      matchAddon('toppings', 'Boiled Egg', 15);
      break;

    case 'beverage':
      matchAddon('size', 'Medium', 20);
      matchAddon('size', 'Large', 40);
      break;

    case 'burger':
      matchAddon('size', 'Double', 50);
      matchAddon('toppings', 'Extra Cheese', 25);
      matchAddon('toppings', 'Extra Patty', 50);
      matchAddon('toppings', 'Lettuce', 10);
      matchAddon('toppings', 'Mayo', 10);
      break;

    case 'dessert':
      matchAddon('size', 'Double', 40);
      matchAddon('size', 'Triple', 70);
      matchAddon('toppings', 'Chocolate Sauce', 15);
      matchAddon('toppings', 'Sprinkles', 10);
      matchAddon('toppings', 'Nuts', 20);
      matchAddon('toppings', 'Whipped Cream', 15);
      break;

    case 'sweets':
      matchAddon('weight', '500g', Math.round(basePrice * 0.8));
      matchAddon('weight', '1 Kg', Math.round(basePrice * 2.5));
      matchAddon('weight', '2 Kg', Math.round(basePrice * 5.5));
      matchAddon('size', 'Gift Box', 50);
      matchAddon('size', 'Premium Gift', 120);
      break;

    case 'fruit':
      matchAddon('weight', '1 Kg', Math.round(basePrice * 0.8));
      matchAddon('weight', '1.5 Kg', Math.round(basePrice * 1.5));
      matchAddon('weight', '2 Kg', Math.round(basePrice * 2.5));
      matchAddon('toppings', 'Cut & Packed', 50);
      break;

    case 'laundry':
      matchAddon('laundry', 'Wash & Iron', 20);
      matchAddon('laundry', 'Premium Dry Clean', 100);
      matchAddon('laundry', 'Shoe Cleaning', 150);
      break;

    case 'rental':
      matchAddon('rental', 'With Driver', 500);
      break;

    default:
      break;
  }

  return extraCost;
};

module.exports = { calculateCustomizationCost, detectProductType };
