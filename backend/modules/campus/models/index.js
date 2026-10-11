const { initCampusModel, getCampusModel } = require('./Campus');
const { initCampusProfileModel, getCampusProfileModel } = require('./CampusProfile');
const { initVerificationModel, getVerificationModel } = require('./Verification');
const { initClassAssignmentModel, getClassAssignmentModel } = require('./ClassAssignment');
const { initClassSubmissionModel, getClassSubmissionModel } = require('./ClassSubmission');
const { initFacultyAnnouncementModel, getFacultyAnnouncementModel } = require('./FacultyAnnouncement');
const { initCampusPollModel, getCampusPollModel } = require('./CampusPoll');
const { initAttendanceRecordModel, getAttendanceRecordModel } = require('./AttendanceRecord');
const { initLostAndFoundModel, getLostAndFoundModel } = require('./LostAndFound');
const { initRidePoolModel, getRidePoolModel } = require('./RidePool');
const { initProximityModels, getProximityRoomModel, getProximityMessageModel } = require('./ProximityRoom');
const {
  initPulseModels,
  getWhisperModel,
  getDailyQuestionModel,
  getQuestionAnswerModel,
  getCampusEventModel,
  getMessMenuModel,
} = require('./Pulse');

const initCampusModels = (sequelize) => {
  if (!sequelize) return;

  initCampusModel(sequelize);
  initCampusProfileModel(sequelize);
  initVerificationModel(sequelize);
  initClassAssignmentModel(sequelize);
  initClassSubmissionModel(sequelize);
  initFacultyAnnouncementModel(sequelize);
  initCampusPollModel(sequelize);
  initAttendanceRecordModel(sequelize);
  initLostAndFoundModel(sequelize);
  initRidePoolModel(sequelize);
  initProximityModels(sequelize);
  initPulseModels(sequelize);

  const User = sequelize.models.User;
  const Campus = getCampusModel();
  const CampusProfile = getCampusProfileModel();
  const Verification = getVerificationModel();
  const ClassAssignment = getClassAssignmentModel();
  const ClassSubmission = getClassSubmissionModel();
  const FacultyAnnouncement = getFacultyAnnouncementModel();

  if (User && CampusProfile) {
    User.hasOne(CampusProfile, { foreignKey: 'userId', as: 'campusProfile' });
    CampusProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  }

  if (Campus && CampusProfile) {
    Campus.hasMany(CampusProfile, { foreignKey: 'campusId', as: 'profiles' });
    CampusProfile.belongsTo(Campus, { foreignKey: 'campusId', as: 'campus' });
  }

  if (User && Verification) {
    User.hasMany(Verification, { foreignKey: 'userId', as: 'campusVerifications' });
    Verification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  }

  if (ClassAssignment && ClassSubmission) {
    ClassAssignment.hasMany(ClassSubmission, { foreignKey: 'assignmentId', as: 'submissions' });
    ClassSubmission.belongsTo(ClassAssignment, { foreignKey: 'assignmentId', as: 'assignment' });
  }

  const DailyQuestion = getDailyQuestionModel();
  const QuestionAnswer = getQuestionAnswerModel();
  if (DailyQuestion && QuestionAnswer) {
    DailyQuestion.hasMany(QuestionAnswer, { foreignKey: 'questionId', as: 'answers' });
    QuestionAnswer.belongsTo(DailyQuestion, { foreignKey: 'questionId', as: 'question' });
  }
};

module.exports = {
  initCampusModels,
  getCampusModel,
  getCampusProfileModel,
  getVerificationModel,
  getClassAssignmentModel,
  getClassSubmissionModel,
  getFacultyAnnouncementModel,
  getCampusPollModel,
  getAttendanceRecordModel,
  getLostAndFoundModel,
  getRidePoolModel,
  getProximityRoomModel,
  getProximityMessageModel,
  getWhisperModel,
  getDailyQuestionModel,
  getQuestionAnswerModel,
  getCampusEventModel,
  getMessMenuModel,
};
