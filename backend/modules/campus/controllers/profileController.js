const { getCampusModel } = require('../models/Campus');
const { getCampusProfileModel } = require('../models/CampusProfile');
const { getVerificationModel } = require('../models/Verification');
const { getUserModel } = require('../../../models/User');
const realtime = require('../../../utils/realtime');

// Helper to seed default campuses if none exist
const ensureDefaultCampuses = async () => {
  const Campus = getCampusModel();
  if (!Campus) return;
  const count = await Campus.count();
  if (count === 0) {
    await Campus.bulkCreate([
      {
        name: 'SRM University AP',
        code: 'SRMAP',
        emailDomains: ['srmap.edu.in'],
        city: 'Amaravathi',
        isActive: true,
        settings: {
          branches: ['CSE', 'ECE', 'MECH', 'CIVIL', 'BBA', 'MBA', 'AI & ML'],
          hostelBlocks: ['Ganga-1', 'Ganga-2', 'Yamuna-1', 'Yamuna-2', 'Godavari', 'Narmada', 'Krishna'],
        }
      },
      {
        name: 'VIT-AP University',
        code: 'VITAP',
        emailDomains: ['vitap.ac.in', 'vitapstudent.ac.in'],
        city: 'Amaravathi',
        isActive: true,
        settings: {
          branches: ['CSE', 'ECE', 'MECH', 'LAW', 'BBA'],
          hostelBlocks: ['MH-1', 'MH-2', 'MH-3', 'LH-1', 'LH-2'],
        }
      },
      {
        name: 'KL University',
        code: 'KLU',
        emailDomains: ['kluniversity.in'],
        city: 'Vaddeswaram',
        isActive: true,
        settings: {
          branches: ['CSE', 'ECE', 'MECH', 'CIVIL', 'BT'],
          hostelBlocks: ['BH-1', 'BH-2', 'GH-1'],
        }
      }
    ]);
    console.log('🏛️ [CAMPUS_INIT] Seeded initial campuses.');
  }
};

// @desc    List available campuses
// @route   GET /api/campus/campuses
const getCampuses = async (req, res) => {
  try {
    await ensureDefaultCampuses();
    const Campus = getCampusModel();
    const campuses = await Campus.findAll({ where: { isActive: true } });
    res.json(campuses);
  } catch (error) {
    console.error('[GET_CAMPUSES_ERR]', error);
    res.status(500).json({ message: 'Failed to fetch campuses' });
  }
};

// @desc    Get or auto-create campus profile for user
// @route   GET /api/campus/profile
const getCampusProfile = async (req, res) => {
  try {
    await ensureDefaultCampuses();
    const CampusProfile = getCampusProfileModel();
    const Campus = getCampusModel();
    const User = getUserModel();

    if (!CampusProfile) {
      return res.status(500).json({ message: 'CampusProfile model not initialized' });
    }

    let profile = await CampusProfile.findOne({
      where: { userId: req.user.id },
      include: Campus ? [{ model: Campus, as: 'campus' }] : []
    });

    if (!profile) {
      // Find default campus (SRMAP)
      const defaultCampus = Campus ? await Campus.findOne({ where: { code: 'SRMAP' } }) : null;
      // Only real data: the student fills branch, year, section, bio and interests themselves.
      profile = await CampusProfile.create({
        userId: req.user.id,
        campusId: defaultCampus ? defaultCampus.id : null,
        branch: null,
        year: null,
        section: null,
        hostelBlock: req.user.hostelBlock || null,
        roomNumber: req.user.roomNumber || null,
        verificationStatus: 'unverified',
        isAdult: false,
        roles: ['student'],
        bio: null,
        interests: []
      });

      if (defaultCampus) {
        profile = await CampusProfile.findByPk(profile.id, {
          include: [{ model: Campus, as: 'campus' }]
        });
      }
    }

    // Attach basic user info
    const userData = {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone,
      profileImage: req.user.profileImage,
      statusEmoji: req.user.statusEmoji,
      statusText: req.user.statusText,
    };

    res.json({
      profile,
      user: userData
    });
  } catch (error) {
    console.error('[GET_CAMPUS_PROFILE_ERR]', error);
    res.status(500).json({ message: 'Failed to fetch campus profile' });
  }
};

// @desc    Update campus profile
// @route   PUT /api/campus/profile
const updateCampusProfile = async (req, res) => {
  try {
    const CampusProfile = getCampusProfileModel();
    const User = getUserModel();

    let profile = await CampusProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await CampusProfile.create({ userId: req.user.id });
    }

    const {
      campusId,
      collegeId,
      branch,
      year,
      section,
      hostelBlock,
      roomNumber,
      dob,
      bio,
      interests
    } = req.body;

    // A verified student's campus and college id are tied to the verification (admins can change them).
    const isVerified = profile.verificationStatus === 'verified';
    const isAdminCaller = String(req.user.role || '').toLowerCase() === 'admin';
    if (isVerified && !isAdminCaller) {
      const changingCampus = campusId !== undefined && String(campusId || '') !== String(profile.campusId || '');
      const changingCollegeId = collegeId !== undefined && String(collegeId || '') !== String(profile.collegeId || '');
      if (changingCampus || changingCollegeId) {
        return res.status(400).json({
          code: 'VERIFIED_FIELDS_LOCKED',
          message: 'Your campus and college ID are locked after verification. Contact Zenvy support to change them.'
        });
      }
    }

    let isAdult = profile.isAdult;
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      isAdult = age >= 18;
    }

    await profile.update({
      campusId: campusId !== undefined ? campusId : profile.campusId,
      collegeId: collegeId !== undefined ? collegeId : profile.collegeId,
      branch: branch !== undefined ? branch : profile.branch,
      year: year !== undefined ? Number(year) : profile.year,
      section: section !== undefined ? section : profile.section,
      hostelBlock: hostelBlock !== undefined ? hostelBlock : profile.hostelBlock,
      roomNumber: roomNumber !== undefined ? roomNumber : profile.roomNumber,
      dob: dob !== undefined ? dob : profile.dob,
      isAdult,
      bio: bio !== undefined ? bio : profile.bio,
      interests: interests !== undefined ? interests : profile.interests,
    });

    // Also sync hostelBlock and roomNumber to User model for food delivery
    if (hostelBlock || roomNumber) {
      const dbUser = await User.findByPk(req.user.id);
      if (dbUser) {
        if (hostelBlock) dbUser.hostelBlock = hostelBlock;
        if (roomNumber) dbUser.roomNumber = roomNumber;
        await dbUser.save();
      }
    }

    const Campus = getCampusModel();
    const updated = await CampusProfile.findByPk(profile.id, {
      include: Campus ? [{ model: Campus, as: 'campus' }] : []
    });

    res.json({
      message: 'Profile updated successfully',
      profile: updated
    });
  } catch (error) {
    console.error('[UPDATE_CAMPUS_PROFILE_ERR]', error);
    res.status(500).json({ message: 'Failed to update campus profile' });
  }
};

// @desc    Request college email verification OTP
// @route   POST /api/campus/verify/email-otp
const requestEmailOtp = async (req, res) => {
  try {
    const { email, campusId } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid college email is required' });
    }

    const Campus = getCampusModel();
    let campus = null;
    if (campusId) {
      campus = await Campus.findByPk(campusId);
    } else {
      campus = await Campus.findOne({ where: { code: 'SRMAP' } });
    }

    const domain = email.split('@')[1].toLowerCase();
    const allowed = campus && campus.emailDomains && campus.emailDomains.includes(domain);
    if (!allowed) {
      return res.status(400).json({ 
        message: `Email domain '@${domain}' is not authorized for ${campus ? campus.name : 'this campus'}. Allowed: ${campus ? campus.emailDomains.join(', ') : 'none'}` 
      });
    }

    // No email provider is configured on the server, so a code could never reach the
    // student's inbox. Be honest instead of pretending a mail was sent: point them to
    // the ID-card verification flow (POST /api/campus/verify/upload-id).
    return res.status(503).json({
      code: 'EMAIL_VERIFICATION_UNAVAILABLE',
      message: 'College email verification is not available yet. Please verify with a photo of your student ID card instead.'
    });
  } catch (error) {
    console.error('[REQUEST_EMAIL_OTP_ERR]', error);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
};

// @desc    Confirm college email OTP
// @route   POST /api/campus/verify/confirm-otp
const confirmEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const Verification = getVerificationModel();
    const { Op } = require('sequelize');

    const record = await Verification.findOne({
      where: {
        userId: req.user.id,
        collegeEmail: email.toLowerCase(),
        otp: otp.trim(),
        status: 'pending',
        otpExpiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    record.status = 'approved';
    await record.save();

    const CampusProfile = getCampusProfileModel();
    let profile = await CampusProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await CampusProfile.create({ userId: req.user.id });
    }

    const alreadyVerified = profile.verificationStatus === 'verified';
    await profile.update({
      collegeEmail: email.toLowerCase(),
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      // Verification reward is granted once per profile, not on every re-verification
      buddyPoints: (profile.buddyPoints || 0) + (alreadyVerified ? 0 : 150)
    });

    realtime.notifyAdmin('verification', 'updated', record.id, { scope: 'email' });
    res.json({
      message: 'Campus verification successful! Welcome to Campus Buddy.',
      verificationStatus: 'verified',
      profile
    });
  } catch (error) {
    console.error('[CONFIRM_EMAIL_OTP_ERR]', error);
    res.status(500).json({ message: 'Verification failed' });
  }
};

// @desc    Upload ID card photo for manual verification
// @route   POST /api/campus/verify/upload-id
const submitIdCard = async (req, res) => {
  try {
    const { idCardImageUrl, campusId, collegeId } = req.body;
    if (!idCardImageUrl) {
      return res.status(400).json({ message: 'ID card image is required' });
    }

    const Verification = getVerificationModel();
    const verification = await Verification.create({
      userId: req.user.id,
      campusId,
      type: 'id_card',
      idCardImageUrl,
      status: 'pending'
    });

    const CampusProfile = getCampusProfileModel();
    let profile = await CampusProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await CampusProfile.create({ userId: req.user.id });
    }

    await profile.update({
      campusId: campusId || profile.campusId,
      collegeId: collegeId || profile.collegeId,
      idCardImageUrl,
      verificationStatus: 'pending'
    });

    realtime.notifyAdmin('verification', 'created', verification.id);
    res.json({
      message: 'ID card submitted for verification. Admin review usually takes 2-4 hours.',
      verificationStatus: 'pending'
    });
  } catch (error) {
    console.error('[SUBMIT_ID_CARD_ERR]', error);
    res.status(500).json({ message: 'Failed to submit ID card' });
  }
};

// @desc    List student verification requests (admin only)
// @route   GET /api/campus/verify/requests?status=pending
const getVerificationRequests = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status = 'pending' } = req.query;
    const Verification = getVerificationModel();
    const User = getUserModel();

    const rows = await Verification.findAll({
      where: { status },
      order: [['createdAt', 'ASC']],
      limit: 100,
    });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length
      ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'phone'] })
      : [];
    const byId = {};
    users.forEach((u) => { byId[u.id] = u; });

    res.json({
      requests: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: byId[r.userId] ? byId[r.userId].name : 'Unknown',
        userPhone: byId[r.userId] ? byId[r.userId].phone : null,
        type: r.type,
        collegeEmail: r.collegeEmail,
        idCardImageUrl: r.idCardImageUrl,
        status: r.status,
        reviewNotes: r.reviewNotes,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('[GET_VERIFICATION_REQUESTS_ERR]', error);
    res.status(500).json({ message: 'Failed to load verification requests' });
  }
};

// @desc    Approve or reject a student verification (admin only)
// @route   POST /api/campus/verify/:id/review
const reviewVerification = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { action, notes } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }

    const Verification = getVerificationModel();
    const record = await Verification.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Verification request not found' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${record.status}` });
    }

    record.status = action === 'approve' ? 'approved' : 'rejected';
    record.reviewedBy = req.user.id;
    record.reviewNotes = notes || null;
    await record.save();

    const CampusProfile = getCampusProfileModel();
    let profile = await CampusProfile.findOne({ where: { userId: record.userId } });
    if (!profile) {
      profile = await CampusProfile.create({ userId: record.userId });
    }

    if (action === 'approve') {
      const alreadyVerified = profile.verificationStatus === 'verified';
      await profile.update({
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        buddyPoints: (profile.buddyPoints || 0) + (alreadyVerified ? 0 : 150),
      });
    } else {
      await profile.update({ verificationStatus: 'rejected' });
    }

    realtime.notifyAdmin('verification', 'updated', record.id);
    res.json({
      message: action === 'approve' ? 'Student verified' : 'Verification rejected',
      verificationStatus: profile.verificationStatus,
      profile,
    });
  } catch (error) {
    console.error('[REVIEW_VERIFICATION_ERR]', error);
    res.status(500).json({ message: 'Failed to review verification' });
  }
};

module.exports = {
  getCampuses,
  getCampusProfile,
  updateCampusProfile,
  requestEmailOtp,
  confirmEmailOtp,
  submitIdCard,
  getVerificationRequests,
  reviewVerification,
};
