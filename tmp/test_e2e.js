const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { connectDB, getSequelize } = require('../backend/config/db');
const { getRestaurantModel } = require('../backend/models/Restaurant');
const { getMenuItemModel } = require('../backend/models/MenuItem');
const { getUserModel } = require('../backend/models/User');
const { getDeliveryPartnerModel } = require('../backend/models/DeliveryPartner');

async function runSimulation() {
  try {
    await connectDB();
    const sequelize = getSequelize();
    
    // Clear old test data
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const User = getUserModel();
    const Rider = getDeliveryPartnerModel();

    console.log("== 1. Infrastructure Setup ==");
    const testRest = await Restaurant.create({
      name: "Sim Cafe E2E",
      location: "Amaravathi Center",
      imageUrl: "https://example.com/logo.png",
      isActive: true,
      isOffline: false, 
      commissionRate: 15
    });
    console.log("-> Created Restaurant:", testRest.name);

    const testItem = await MenuItem.create({
      restaurantId: testRest.id,
      name: "E2E Burger",
      price: 150,
      description: "Simulation Burger",
      imageUrl: "https://example.com/burger.png",
      category: "Fast Food",
      tags: ["veg"],
      isAvailable: true,
    });
    console.log("-> Created Menu Item:", testItem.name);

    const testUser = await User.create({
      name: "E2E Customer",
      phone: "1111111111",
      password: "password123",
      hostelBlock: "VEDAVATHI",
      roomNumber: "101",
      isElite: true
    });
    console.log("-> Created Customer");

    const testRider = await Rider.create({
      name: "E2E Rider",
      phone: "2222222222",
      password: "password123",
      vehicleType: "Bike",
      vehicleNumber: "AP00X0000",
      isOnline: true,
      isApproved: true
    });
    console.log("-> Created Rider");

    const userToken = jwt.sign({ id: testUser.id, role: 'user' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
    const riderToken = jwt.sign({ id: testRider.id, role: 'delivery' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });

    console.log("\n== 2. Customer places order ==");
    const orderPayload = {
      restaurantId: testRest.id,
      items: [{ menuItemId: testItem.id, quantity: 2, name: testItem.name }],
      deliveryAddress: "Vedavathi Block"
    };

    const res1 = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      body: JSON.stringify(orderPayload)
    });
    const orderData = await res1.json();
    if (!res1.ok) throw new Error("Order creation failed: " + JSON.stringify(orderData));
    console.log("-> Order Placed. ID:", orderData._id);

    console.log("\n== 3. Restaurant Accepts Order ==");
    const res2 = await fetch(`http://localhost:5000/api/orders/${orderData._id}/restaurant-accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    const acceptData = await res2.json();
    if (!res2.ok) throw new Error("Restaurant accept failed: " + JSON.stringify(acceptData));
    console.log("-> Restaurant Accepted the order");

    console.log("\n== 4. Rider Accepts & Delivers ==");
    const res3 = await fetch(`http://localhost:5000/api/delivery/accept/${orderData._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${riderToken}` }
    });
    const riderAcceptData = await res3.json();
    if (!res3.ok) throw new Error("Rider accept failed: " + JSON.stringify(riderAcceptData));
    console.log("-> Rider Accepted Order");

    const res4 = await fetch(`http://localhost:5000/api/delivery/status/${orderData._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${riderToken}` },
      body: JSON.stringify({ status: 'Delivered' })
    });
    const riderDeliverData = await res4.json();
    if (!res4.ok) throw new Error("Rider deliver failed: " + JSON.stringify(riderDeliverData));
    console.log("-> Rider Marked Order as Delivered");

    console.log("\n✅ E2E Simulation completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Simulation Failed:", err.message);
    process.exit(1);
  }
}

runSimulation();
