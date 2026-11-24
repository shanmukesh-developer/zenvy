const { DataTypes } = require('sequelize');

let MenuItem;

const initMenuItemModel = (sequelize) => {
  if (!sequelize) return null;

  MenuItem = sequelize.define('MenuItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Owner-only test row (utils/testView, scripts/test_data_v2_seed.js): hidden from every non-tester request.
    isTestData: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    restaurantId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    description: { type: DataTypes.TEXT },
    imageUrl: { type: DataTypes.TEXT },
    category: { type: DataTypes.STRING },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    isVegetarian: { type: DataTypes.BOOLEAN, defaultValue: true },
    // 'veg' | 'nonveg' | 'egg'. Null on older rows: readers fall back to isVegetarian.
    dietType: { type: DataTypes.STRING(8), allowNull: true },
    // MRP / original price shown struck through (>= price). Null = no MRP.
    originalPrice: { type: DataTypes.FLOAT, allowNull: true },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
    outOfStockUntil: { type: DataTypes.DATE, allowNull: true },
    isEliteOnly: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Specialized cake (custom / designer): booking closes 2½ hours before the delivery slot instead of the
    // 2 hours of a normal cake (utils/deliverySlots). Switched on by the store or an admin.
    isSpecializedCake: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Delivery timing group set by the admin for this product (utils/deliveryGroups): 'food' | 'grocery' | 'bakery';
    // null = the store's group.
    deliveryGroup: { type: DataTypes.STRING(16), allowNull: true },
    customCommission: { type: DataTypes.FLOAT },
    specs: { type: DataTypes.JSON, defaultValue: {} },
    // Home slideshow (owner, 24-25 Nov 2026; utils/cutoutQueue, utils/homeSlideshow). cutoutUrl: the dish photo with
    // its background removed on our server (transparent WebP); cutoutSourceUrl: the imageUrl it was made from (a
    // different imageUrl = new photo, made again); cutoutStatus 'pending' | 'done' | 'failed' | null (not made yet);
    // cutoutAt: when the worker claimed / finished it. slideshowImageUrl: the admin's own slideshow image (wins over
    // everything); slideshowRoundPhoto: the admin chose the round photo over the cut-out for this dish.
    cutoutUrl: { type: DataTypes.TEXT, allowNull: true },
    cutoutSourceUrl: { type: DataTypes.TEXT, allowNull: true },
    cutoutStatus: { type: DataTypes.STRING(10), allowNull: true },
    cutoutAt: { type: DataTypes.DATE, allowNull: true },
    slideshowImageUrl: { type: DataTypes.TEXT, allowNull: true },
    slideshowRoundPhoto: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    ownerName: { type: DataTypes.STRING },
    ownerPhone: { type: DataTypes.STRING }
  }, { 
    timestamps: true,
    indexes: [
      { fields: ['restaurantId'] },
      { fields: ['category'] }
    ]
  });

  return MenuItem;
};

module.exports = { initMenuItemModel, getMenuItemModel: () => MenuItem };
