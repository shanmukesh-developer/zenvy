const { Sequelize } = require('sequelize');
const path = require('path');
const seq = new Sequelize({ dialect: 'sqlite', storage: path.join(__dirname, 'local_dev.sqlite'), logging: false });

async function check() {
  const [shan] = await seq.query("SELECT * FROM Friendships WHERE requesterId = '41e5d9fb-4663-434c-9bcd-17456523b464' OR recipientId = '41e5d9fb-4663-434c-9bcd-17456523b464'");
  console.log('SHANMUKH FRIENDSHIPS COUNT:', shan.length);
  console.log('SHANMUKH FRIENDSHIPS:', shan);

  const [allUsers] = await seq.query("SELECT id, name, phone FROM Users");
  console.log('ALL USERS:', allUsers);
}
check().catch(console.error);
