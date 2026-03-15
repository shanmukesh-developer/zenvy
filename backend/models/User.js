const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  hostelBlock: { type: String, required: true },
  roomNumber: { type: String, required: true },
  walletBalance: { type: Number, default: 0 },
  streakCount: { type: Number, default: 0 },
  lastOrderDate: { type: Date },
  totalOrders: { type: Number, default: 0 },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  fcmTokens: [{
    token: { type: String },
    appVersion: { type: String }
  }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
