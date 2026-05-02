const { Sequelize } = require('sequelize');
const path = require('path');

async function inspect() {
    const sqlitePath = path.join(__dirname, 'local_dev.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: sqlitePath,
        logging: false
    });

    try {
        const [users] = await sequelize.query("SELECT id, name, phone FROM Users;");
        console.log('--- ALL USERS ---');
        users.forEach(u => console.log(`ID: ${u.id}, Name: [${u.name}], Phone: [${u.phone}]`));

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

inspect();
