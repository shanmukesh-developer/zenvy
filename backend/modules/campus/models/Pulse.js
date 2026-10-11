const { DataTypes } = require('sequelize');

// JSON-array column stored as TEXT for SQLite/Postgres parity
const jsonColumn = (key) => ({
  type: DataTypes.TEXT,
  defaultValue: '[]',
  get() {
    const val = this.getDataValue(key);
    try { return val ? JSON.parse(val) : []; } catch { return []; }
  },
  set(val) {
    this.setDataValue(key, JSON.stringify(Array.isArray(val) ? val : []));
  },
});

let Whisper;
let DailyQuestion;
let QuestionAnswer;
let CampusEvent;
let MessMenu;

const initWhisperModel = (sequelize) => {
  if (!sequelize) return null;
  Whisper = sequelize.define('CampusWhisper', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false }, // server-only, never returned to clients
    alias: { type: DataTypes.STRING, allowNull: false },
    topic: { type: DataTypes.STRING(30), defaultValue: 'General' },
    text: { type: DataTypes.TEXT, allowNull: false },
    hearts: jsonColumn('hearts'),
  }, { timestamps: true });
  return Whisper;
};

const initDailyQuestionModel = (sequelize) => {
  if (!sequelize) return null;
  DailyQuestion = sequelize.define('CampusDailyQuestion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    promptDate: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    question: { type: DataTypes.STRING, allowNull: false },
    opensAt: { type: DataTypes.DATE, allowNull: true },
    closesAt: { type: DataTypes.DATE, allowNull: true },
  }, { timestamps: true });
  return DailyQuestion;
};

const initQuestionAnswerModel = (sequelize) => {
  if (!sequelize) return null;
  QuestionAnswer = sequelize.define('CampusQuestionAnswer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    questionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false }, // server-only, never returned
    alias: { type: DataTypes.STRING, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false },
    upvotes: jsonColumn('upvotes'),
  }, { timestamps: true });
  return QuestionAnswer;
};

const initCampusEventModel = (sequelize) => {
  if (!sequelize) return null;
  CampusEvent = sequelize.define('CampusEvent', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: true },
    category: { type: DataTypes.STRING(30), defaultValue: 'general' }, // sports | cultural | academic | general
    description: { type: DataTypes.TEXT, allowNull: true },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: true },
  }, { timestamps: true });
  return CampusEvent;
};

const initMessMenuModel = (sequelize) => {
  if (!sequelize) return null;
  MessMenu = sequelize.define('CampusMessMenu', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    menuDate: { type: DataTypes.DATEONLY, allowNull: false },
    meal: { type: DataTypes.STRING(20), allowNull: false }, // breakfast | lunch | snacks | dinner
    items: { type: DataTypes.STRING, allowNull: false },
  }, {
    timestamps: true,
    indexes: [{ fields: ['menuDate'] }],
  });
  return MessMenu;
};

const initPulseModels = (sequelize) => {
  initWhisperModel(sequelize);
  initDailyQuestionModel(sequelize);
  initQuestionAnswerModel(sequelize);
  initCampusEventModel(sequelize);
  initMessMenuModel(sequelize);
};

module.exports = {
  initPulseModels,
  initWhisperModel,
  initDailyQuestionModel,
  initQuestionAnswerModel,
  initCampusEventModel,
  initMessMenuModel,
  getWhisperModel: () => Whisper,
  getDailyQuestionModel: () => DailyQuestion,
  getQuestionAnswerModel: () => QuestionAnswer,
  getCampusEventModel: () => CampusEvent,
  getMessMenuModel: () => MessMenu,
};
