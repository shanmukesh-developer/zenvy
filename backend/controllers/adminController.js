const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');
const { getUserModel } = require('../models/User');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getOrderModel } = require('../models/Order');

const broadcastSystemUpdate = (req, type, data) => {
  const io = req.app.get('io');
  if (io) io.emit('systemUpdate', { type, data });
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
    const item = await MenuItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Product not found' });
    const restaurant = await Restaurant.findByPk(item.restaurantId);
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
        name: { [Op.like]: `%${q}%` },
        isActive: true
      }
    });

    const matchedItems = await MenuItem.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { category: { [Op.like]: `%${q}%` } }
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
    res.json({ ...menuItem.toJSON(), _id: menuItem.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
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
    res.json({ ...user.toJSON(), _id: user.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  res.json([]); // Simplified - no separate audit log table in PostgreSQL migration
};

exports.updateGlobalConfig = async (req, res) => {
  res.json({ key: req.body.key, value: req.body.value });
};

exports.getGlobalConfig = async (req, res) => {
  res.json([]);
};

// ─── Dashboard Stats ──────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const Order = getOrderModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    const { Op } = require('sequelize');

    const totalOrders = await Order.count();
    const activeOrders = await Order.count({ where: { status: { [Op.notIn]: ['Delivered', 'Cancelled'] } } });
    const deliveredOrders = await Order.findAll({ where: { status: 'Delivered' } });
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const activeFleet = await DeliveryPartner.count({ where: { isApproved: true } });

    res.json({
      revenue: `₹${totalRevenue.toLocaleString()}`,
      orderActivity: totalOrders.toString(),
      activeFleet: activeFleet.toString(),
      commission: `₹${Math.round(totalRevenue * 0.1).toLocaleString()}`,
      activeOrders: activeOrders.toString()
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
        location: 'Main Campus',
        imageUrl: restData.imageUrl || restData.image,
        commissionRate: 10,
        commissionType: 'percentage',
        operatingHours: { start: '09:00', end: '22:00' },
        isActive: true,
        tags: restData.categories || []
      });

      if (restData.menu && Array.isArray(restData.menu)) {
        for (const item of restData.menu) {
          await MenuItem.create({
            restaurantId: restaurant.id,
            name: item.name,
            price: item.price,
            description: item.description,
            imageUrl: item.image || item.imageUrl,
            category: item.category,
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
  res.json([]);
};

exports.upsertVaultItem = async (req, res) => {
  res.json({ id: req.params.id, ...req.body });
};

exports.deleteVaultItem = async (req, res) => {
  res.json({ message: 'Deleted' });
};
