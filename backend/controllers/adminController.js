const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');
const { getUserModel } = require('../models/User');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getOrderModel } = require('../models/Order');
const { getVaultItemModel } = require('../models/VaultItem');
const { getGlobalConfigModel } = require('../models/GlobalConfig');
const { getVerificationLogModel } = require('../models/VerificationLog');
const { Op } = require('sequelize');

const broadcastSystemUpdate = (req, type, data) => {
  const io = req.app.get('io');
  if (io) io.emit('systemUpdate', { type, data });
};

const logAuditAction = async (req, targetId, action, details) => {
  try {
    const VerificationLog = getVerificationLogModel();
    await VerificationLog.create({
      adminId: req.user?.id ? req.user.id.toString() : 'admin_default',
      targetId: targetId ? targetId.toString() : 'global',
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
    });
  } catch (error) {
    console.error('[AUDIT_LOG_ERROR]', error);
  }
};

// ─── Public Endpoints ─────────────────────────────────────────
exports.getRestaurants = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const restaurants = await Restaurant.findAll({ where: { isActive: true } });
    const result = await Promise.all(restaurants.map(async (r) => {
      const menu = await MenuItem.findAll({ where: { restaurantId: r.id } });
      const rObj = r.toJSON();
      return { 
        ...rObj, 
        _id: r.id, 
        id: r.id,
        categories: rObj.tags || [],
        menu: menu.map(m => {
          const mObj = m.toJSON();
          return { ...mObj, _id: m.id, id: m.id, image: mObj.imageUrl || mObj.image };
        })
      };
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const restaurant = await Restaurant.findByPk(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    const menu = await MenuItem.findAll({ where: { restaurantId: restaurant.id } });
    const resObj = restaurant.toJSON();
    res.json({ 
      ...resObj, 
      _id: restaurant.id, 
      id: restaurant.id,
      categories: resObj.tags || [],
      menu: menu.map(m => {
        const mObj = m.toJSON();
        return { ...mObj, _id: m.id, id: m.id, image: mObj.imageUrl || mObj.image };
      })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMenuItemById = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const Restaurant = getRestaurantModel();
    const VaultItem = getVaultItemModel();
    
    let item = await MenuItem.findByPk(req.params.id);
    let restaurant;

    if (!item) {
      // Fallback: Check VaultItem if MenuItem not found
      item = await VaultItem.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Product not found (Nexus Error: 404)' });
      
      const itemObj = item.toJSON();
      return res.json({ 
        ...itemObj, 
        _id: item.id, 
        id: item.id, 
        image: itemObj.imageUrl || itemObj.image,
        restaurantName: 'Zenvy Exclusive Vault', 
        restaurantId: 'vault_prime' 
      });
    }

    restaurant = await Restaurant.findByPk(item.restaurantId);
    const itemObj = item.toJSON();
    res.json({ 
      ...itemObj, 
      _id: item.id, 
      id: item.id, 
      image: itemObj.imageUrl || itemObj.image,
      restaurantName: restaurant?.name || 'Zenvy Kitchen', 
      restaurantId: restaurant?.id 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ restaurants: [], items: [] });
    const { Op } = require('sequelize');
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    const matchedRestaurants = await Restaurant.findAll({
      where: {
        name: { [Op.iLike]: `%${q}%` },
        isActive: true
      }
    });

    const matchedItems = await MenuItem.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { category: { [Op.iLike]: `%${q}%` } }
        ],
        isAvailable: true
      }
    });

    res.json({
      restaurants: matchedRestaurants.map(r => ({ ...r.toJSON(), _id: r.id })),
      items: matchedItems.map(m => ({ ...m.toJSON(), _id: m.id }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Restaurant & Menu Control ────────────────────────────────
exports.getAllRestaurants = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const restaurants = await Restaurant.findAll();
    res.json(restaurants.map(r => ({ ...r.toJSON(), _id: r.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllMenuItems = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const where = req.query.restaurantId ? { restaurantId: req.query.restaurantId } : {};
    const items = await MenuItem.findAll({ where });
    res.json(items.map(i => ({ ...i.toJSON(), _id: i.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.create(req.body);
    broadcastSystemUpdate(req, 'RESTAURANT_CREATED', restaurant);
    await logAuditAction(req, restaurant.id, 'CREATE_RESTAURANT', { name: restaurant.name });
    res.status(201).json({ ...restaurant.toJSON(), _id: restaurant.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.findByPk(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Not found' });
    await restaurant.update(req.body);
    broadcastSystemUpdate(req, 'RESTAURANT_UPDATED', restaurant);
    await logAuditAction(req, restaurant.id, 'UPDATE_RESTAURANT', { name: restaurant.name });
    res.json({ ...restaurant.toJSON(), _id: restaurant.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.upsertMenuItem = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const { id } = req.params;
    let menuItem;
    if (id && id !== 'new') {
      menuItem = await MenuItem.findByPk(id);
      if (menuItem) await menuItem.update(req.body);
      else menuItem = await MenuItem.create(req.body);
    } else {
      menuItem = await MenuItem.create(req.body);
    }
    broadcastSystemUpdate(req, 'MENU_UPDATED', menuItem);
    await logAuditAction(req, menuItem.id, 'UPSERT_MENU_ITEM', { name: menuItem.name });
    res.json({ ...menuItem.toJSON(), _id: menuItem.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const item = await MenuItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    await item.destroy();
    broadcastSystemUpdate(req, 'MENU_ITEM_DELETED', { id: req.params.id });
    await logAuditAction(req, req.params.id, 'DELETE_MENU_ITEM', { id: req.params.id });
    res.json({ message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Fleet Management ──────────────────────────────────────────
exports.getAllRiders = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const riders = await DeliveryPartner.findAll({ attributes: { exclude: ['password'] } });
    res.json(riders.map(r => ({ ...r.toJSON(), _id: r.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveRider = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const rider = await DeliveryPartner.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ isApproved: req.body.isApproved });
    broadcastSystemUpdate(req, 'RIDER_STATUS_CHANGED', { id: req.params.id, isApproved: req.body.isApproved });
    res.json({ ...rider.toJSON(), _id: rider.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── User & Elite Tiering ──────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const User = getUserModel();
    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    res.json(users.map(u => ({ ...u.toJSON(), _id: u.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.setEliteStatus = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.update({ isElite: req.body.isElite });
    broadcastSystemUpdate(req, 'USER_ELITE_STATUS', { userId: req.params.userId, isElite: req.body.isElite });
    await logAuditAction(req, user.id, 'ELITE_STATUS_CHANGE', { email: user.email, isElite: req.body.isElite });
    res.json({ ...user.toJSON(), _id: user.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const VerificationLog = getVerificationLogModel();
    const logs = await VerificationLog.findAll({ order: [['timestamp', 'DESC']], limit: 100 });
    res.json(logs.map(l => ({ ...l.toJSON(), _id: l.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateGlobalConfig = async (req, res) => {
  try {
    const GlobalConfig = getGlobalConfigModel();
    const { key, value, description } = req.body;
    const [config, created] = await GlobalConfig.upsert({ key, value, description });
    res.json({ key, value, description, created });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getGlobalConfig = async (req, res) => {
  try {
    const GlobalConfig = getGlobalConfigModel();
    const configs = await GlobalConfig.findAll();
    res.json(configs.map(c => ({ ...c.toJSON(), _id: c.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Dashboard Stats ──────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const Order = getOrderModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    const { Op } = require('sequelize');

    const totalOrders = await Order.count();
    const activeOrdersList = await Order.findAll({ where: { status: { [Op.notIn]: ['Delivered', 'Cancelled'] } } });
    const activeOrdersCount = activeOrdersList.length;
    const activeRevenue = activeOrdersList.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const deliveredOrders = await Order.findAll({ where: { status: 'Delivered' } });
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const activeFleet = await DeliveryPartner.count({ where: { isApproved: true } });

    res.json({
      revenue: `₹${totalRevenue.toLocaleString()}`,
      activeRevenue: `₹${activeRevenue.toLocaleString()}`,
      orderActivity: totalOrders.toString(),
      activeFleet: activeFleet.toString(),
      commission: `₹${Math.round(totalRevenue * 0.1).toLocaleString()}`,
      activeOrders: activeOrdersCount.toString()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFinanceReport = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    const orders = await Order.findAll({ where: { status: 'Delivered' } });
    const restaurants = await Restaurant.findAll();
    const restaurantMap = restaurants.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});

    const report = orders.map(order => {
      const restaurant = restaurantMap[order.restaurantId] || { commissionRate: 10, name: 'Zenvy Kitchen' };
      const itemPrice = order.finalPrice || order.totalPrice;
      const commission = itemPrice * ((restaurant.commissionRate || 10) / 100);
      return {
        _id: order.id,
        orderId: order.id.slice(-6),
        restaurantName: restaurant.name,
        totalAmount: itemPrice,
        commissionEarned: Math.round(commission),
        deliveryFee: order.deliveryFee || 20,
        timestamp: order.createdAt
      };
    });

    res.json({
      transactions: report.reverse(),
      totalRevenue: report.reduce((s, r) => s + r.totalAmount, 0),
      totalCommission: report.reduce((s, r) => s + r.commissionEarned + r.deliveryFee, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Seed Database ─────────────────────────────────────────────
exports.seedDatabase = async (req, res) => {
  try {
    const { restaurants } = req.body;
    if (!restaurants || !Array.isArray(restaurants)) {
      return res.status(400).json({ message: 'Invalid seed data' });
    }

    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    await MenuItem.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });

    for (const restData of restaurants) {
      const restaurant = await Restaurant.create({
        name: restData.name,
        location: restData.location || 'Main Campus',
        imageUrl: restData.imageUrl || restData.image,
        vendorType: restData.vendorType || 'RESTAURANT',
        commissionRate: restData.commissionRate || 10,
        commissionType: restData.commissionType || 'percentage',
        operatingHours: restData.operatingHours || { start: '09:00', end: '22:00' },
        isActive: restData.isActive !== undefined ? restData.isActive : true,
        tags: restData.categories || restData.tags || []
      });

      if (restData.menu && Array.isArray(restData.menu)) {
        // Auto-generate tags from vendorType for frontend filtering
        const vendorTagMap = {
          'PHARMACY': ['pharmacy', 'medicine'],
          'STATIONARY': ['stationary', 'books'],
          'LAUNDRY': ['laundry', 'dry-wash'],
          'GYM': ['gym', 'high-protein', 'healthy'],
          'DRINKS': ['drinks'],
          'SEASONAL': ['seasonal'],
          'RENTAL': ['rental'],
          'GROCERY': ['fruits', 'healthy'],
          'SWEETS': ['sweets'],
          'RESTAURANT': [],
          'GLOBAL_MARKET': []
        };
        const vendorTags = vendorTagMap[restData.vendorType] || [];

        for (const item of restData.menu) {
          const itemTags = [...new Set([
            ...vendorTags,
            ...(item.tags || []),
            ...(item.category ? [item.category.toLowerCase()] : [])
          ])];
          await MenuItem.create({
            restaurantId: restaurant.id,
            name: item.name,
            price: item.price,
            description: item.description,
            imageUrl: item.image || item.imageUrl,
            category: item.category,
            tags: itemTags,
            isAvailable: true,
            isEliteOnly: false
          });
        }
      }
    }

    broadcastSystemUpdate(req, 'DATABASE_SEEDED', { count: restaurants.length });
    res.json({ message: `Successfully seeded ${restaurants.length} restaurants.` });
  } catch (error) {
    console.error('[SEED_ERROR]', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Zenvy Vault Control (Stubs for PostgreSQL) ─────────────────
exports.getVaultItems = async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const items = await VaultItem.findAll();
    res.json(items.map(i => ({ ...i.toJSON(), _id: i.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upsertVaultItem = async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const { id } = req.params;
    let item;
    if (id && id !== 'new') {
      item = await VaultItem.findByPk(id);
      if (item) await item.update(req.body);
      else item = await VaultItem.create(req.body);
    } else {
      item = await VaultItem.create(req.body);
    }
    broadcastSystemUpdate(req, 'VAULT_UPDATED', item);
    res.json({ ...item.toJSON(), _id: item.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteVaultItem = async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    await VaultItem.destroy({ where: { id: req.params.id } });
    broadcastSystemUpdate(req, 'VAULT_DELETED', { id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
