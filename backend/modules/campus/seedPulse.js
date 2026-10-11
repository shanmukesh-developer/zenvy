/*
 * Seeds real, DB-backed Pulse content (mess menu, events, 9 PM question, whispers)
 * into local_dev.sqlite. Idempotent: clears today's pulse rows before inserting.
 * Run: node modules/campus/seedPulse.js
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const crypto = require('crypto');
const { initUserModel } = require('../../models/User');
const { initMessageModel } = require('../../models/Message');
const { initCampusModels, getWhisperModel, getDailyQuestionModel, getQuestionAnswerModel, getCampusEventModel, getMessMenuModel } = require('./models');

const uid = () => crypto.randomUUID();

async function seedPulse() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'local_dev.sqlite'),
    logging: false,
  });

  initUserModel(sequelize);
  initMessageModel(sequelize);
  initCampusModels(sequelize);
  await sequelize.sync();

  const Whisper = getWhisperModel();
  const DailyQuestion = getDailyQuestionModel();
  const QuestionAnswer = getQuestionAnswerModel();
  const CampusEvent = getCampusEventModel();
  const MessMenu = getMessMenuModel();

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

  // ── Mess menu (today) ──
  await MessMenu.destroy({ where: { menuDate: today } });
  await MessMenu.bulkCreate([
    { menuDate: today, meal: 'breakfast', items: 'Idli, Sambar, Coconut Chutney, Filter Coffee' },
    { menuDate: today, meal: 'lunch', items: 'Veg Biryani, Paneer Butter Masala, Rasam, Curd, Salad' },
    { menuDate: today, meal: 'snacks', items: 'Masala Poha, Green Chutney, Masala Chai' },
    { menuDate: today, meal: 'dinner', items: 'Dal Tadka, Jeera Rice, Aloo Gobi, Gulab Jamun' },
  ]);

  // ── Events (today) ──
  await CampusEvent.destroy({ where: { startsAt: { [Sequelize.Op.between]: [dayStart, dayEnd] } } });
  const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
  await CampusEvent.bulkCreate([
    { title: 'Inter-Hostel Badminton Semifinals', location: 'Indoor Stadium', category: 'sports', description: 'Free entry • Ganga vs Godavari', startsAt: at(18, 30), endsAt: at(20, 30) },
    { title: 'HackSRMAP Kickoff Workshop', location: 'Central Library Auditorium', category: 'academic', description: 'Git, APIs and team formation for the 24h build.', startsAt: at(16, 0), endsAt: at(18, 0) },
  ]);

  // ── 9 PM Question (today) ──
  await QuestionAnswer.destroy({ truncate: true });
  await DailyQuestion.destroy({ where: { promptDate: today } });
  const q = await DailyQuestion.create({
    promptDate: today,
    question: 'What is that one campus life rule you secretly broke and never got caught?',
    opensAt: at(21, 0),
    closesAt: (() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; })(),
  });

  const seedAnswers = [
    { alias: 'Phantom Ninja', answer: 'Sneaked an induction stove into Ganga 4th floor and hosted 2 AM maggi parties for the whole wing.' },
    { alias: 'Night Shadow', answer: 'Swapped the lab mouse USBs with wireless dongles to prank our TA during the end-sem viva.' },
    { alias: 'Midnight Scholar', answer: 'Hid 6 library reference books behind unused encyclopedias so nobody else could check them out.' },
  ];
  for (const a of seedAnswers) {
    const ups = Array.from({ length: 20 + Math.floor(Math.random() * 40) }, uid);
    await QuestionAnswer.create({ questionId: q.id, userId: uid(), alias: a.alias, answer: a.answer, upvotes: ups });
  }

  // ── Whispers ──
  await Whisper.destroy({ truncate: true });
  const seedWhispers = [
    { alias: 'Anonymous Owl', topic: 'Hostels', text: 'Whoever plays acoustic guitar on the Ganga 3rd floor balcony at midnight — please never stop, that was angelic.', hearts: 54 },
    { alias: 'Midnight Coder', topic: 'Academics', text: 'Assignment question #4 literally broke my brain. Anyone else getting undefined on the edge cases?', hearts: 38 },
    { alias: 'Foodie Fox', topic: 'Canteen', text: 'The evening samosas at Canteen 2 were unusually crisp and hot today. Chef deserves a raise.', hearts: 29 },
    { alias: 'Silent Poet', topic: 'Crushes', text: 'To the person in the yellow hoodie in Central Library 2F reading Kafka: your leaked playlist taste is 10/10.', hearts: 87 },
    { alias: 'Star Gazer', topic: 'Late Night', text: 'SRMAP night breeze by the lake during exam week is unmatched. Take a 10 min break, you have got this.', hearts: 63 },
  ];
  for (const w of seedWhispers) {
    const hearts = Array.from({ length: w.hearts }, uid);
    await Whisper.create({ userId: uid(), alias: w.alias, topic: w.topic, text: w.text, hearts });
  }

  console.log('✅ [SEED_PULSE] Mess menu (4 meals), 2 events, 1 question + 3 answers, 5 whispers seeded for', today);
  await sequelize.close();
}

seedPulse().catch((e) => { console.error('❌ [SEED_PULSE] Failed:', e); process.exit(1); });
