require('dotenv').config();
const { Sequelize } = require('sequelize'); 
const s = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres', 
  dialectOptions: {ssl: {require: true, rejectUnauthorized: false}}, 
  logging: false
}); 

async function nukeAndSeed() {
  try {
    console.log("Nuking public schema...");
    await s.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');
    console.log("Schema successfully nuked and recreated!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

nukeAndSeed();
