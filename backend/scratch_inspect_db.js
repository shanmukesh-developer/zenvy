const { Sequelize } = require('sequelize');
const path = require('path');

async function inspect() {
    const sqlitePath = path.join(__dirname, 'local_dev.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: sqlitePath,
        logging: console.log
    });

    try {
        const [results] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='Users';");
        console.log('--- USERS TABLE SQL ---');
        console.log(results[0]?.sql);

        const [indexes] = await sequelize.query("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='Users';");
        console.log('--- USERS INDEXES ---');
        indexes.forEach(idx => console.log(`${idx.name}: ${idx.sql}`));

        const [duplicates] = await sequelize.query("SELECT name, COUNT(*) as count FROM Users GROUP BY name HAVING count > 1;");
        console.log('--- DUPLICATE NAMES ---');
        console.log(duplicates);

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

inspect();
