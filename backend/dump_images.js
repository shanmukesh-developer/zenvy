const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'local_dev.sqlite'),
  logging: false
});

(async () => {
  try {
    const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('--- TABLES ---');
    console.log(tables.map(t => t.name).join(', '));

    const checkImage = (img) => {
        if (!img) return 'NULL';
        if (img.startsWith('data:image')) return `Base64 (${img.length} chars)`;
        if (img.startsWith('http')) return `External URL: ${img}`;
        return `Relative Path: ${img}`;
    };

    if (tables.some(t => t.name === 'Restaurants')) {
        const [restaurants] = await sequelize.query("SELECT name, imageUrl FROM Restaurants");
        console.log('\n--- RESTAURANTS ---');
        restaurants.forEach(r => console.log(`${r.name}: ${checkImage(r.imageUrl)}`));
    }

    if (tables.some(t => t.name === 'MenuItems')) {
        const [items] = await sequelize.query("SELECT name, imageUrl FROM MenuItems");
        console.log('\n--- MENU ITEMS ---');
        items.forEach(i => console.log(`${i.name}: ${checkImage(i.imageUrl)}`));
    }

    if (tables.some(t => t.name === 'DeliveryPartners')) {
        const [partners] = await sequelize.query("SELECT name, photoUrl FROM DeliveryPartners");
        console.log('\n--- DELIVERY PARTNERS ---');
        partners.forEach(p => console.log(`${p.name}: ${checkImage(p.photoUrl)}`));
    }

    if (tables.some(t => t.name === 'CommunityPosts')) {
        const [posts] = await sequelize.query("SELECT content, imageUrl FROM CommunityPosts");
        console.log('\n--- COMMUNITY POSTS ---');
        posts.forEach(p => console.log(`${(p.content || '').substring(0, 20)}: ${checkImage(p.imageUrl)}`));
    }

    sequelize.close();
  } catch (err) {
    console.error(err);
  }
})();
