/**
 * The eight default Forum communities, created per campus with an idempotent findOrCreate on
 * (campusId, slug). Runs at boot (migrations/forum.js) for every active campus and lazily the first
 * time a campus lists its communities (a campus added later still gets them).
 *
 * Only names, descriptions, house rules and allowed post types are seeded. No posts, no Freshers
 * Guide text and no invented college policies: guides are written by admins / community moderators.
 */
const ALL = ['question', 'discussion', 'review', 'resource', 'guidance', 'campus_info'];

const COMMON_RULES = [
  'Be respectful. No harassment, slurs, threats or personal attacks.',
  'Never post anyone\'s phone number, email, room number or private chats.',
  'Stay on topic for this community.',
];

const DEFAULT_COMMUNITIES = [
  {
    slug: 'academics', name: 'Academics', sortOrder: 10,
    description: 'Courses, exams, assignments, labs and study doubts.',
    allowedTypes: ['question', 'discussion', 'resource', 'guidance', 'review'],
    rules: [...COMMON_RULES, 'Academic integrity: no exam answers during exams, no graded work for hire.'],
  },
  {
    slug: 'placements', name: 'Placements', sortOrder: 20,
    description: 'Internships, placement drives, interview experiences and preparation.',
    allowedTypes: ['question', 'discussion', 'resource', 'guidance', 'review'],
    rules: [...COMMON_RULES, 'Share interview experiences without leaking confidential test content.'],
  },
  {
    slug: 'hostel-food', name: 'Hostel & Food', sortOrder: 30,
    description: 'Hostel life, mess, canteens and food around campus.',
    allowedTypes: ['question', 'discussion', 'review', 'campus_info'],
    rules: COMMON_RULES,
  },
  {
    slug: 'clubs', name: 'Clubs', sortOrder: 40,
    description: 'Clubs, events, fests and student activities.',
    allowedTypes: ['question', 'discussion', 'review', 'campus_info', 'resource'],
    rules: COMMON_RULES,
  },
  {
    slug: 'admissions', name: 'Admissions', sortOrder: 50,
    description: 'Questions from applicants and new admits. Official answers are labelled Official.',
    allowedTypes: ['question', 'discussion', 'guidance', 'campus_info'],
    rules: [...COMMON_RULES, 'Student advice is not official policy. Check official notices for fees and deadlines.'],
  },
  {
    slug: 'faculty-reviews', name: 'Faculty Reviews', sortOrder: 60,
    description: 'Structured, honest reviews of courses and teaching. Reviewers are never shown.',
    allowedTypes: ['review', 'question', 'discussion'],
    rules: [
      'Review the teaching and the course, not the person.',
      'No unsupported allegations, insults or personal details. Serious complaints belong with the college grievance cell.',
      'Faculty and official accounts can reply once to a review.',
    ],
  },
  {
    slug: 'off-campus', name: 'Off-campus Life', sortOrder: 70,
    description: 'Rooms, travel, city tips and life outside campus.',
    allowedTypes: ['question', 'discussion', 'review', 'resource', 'campus_info'],
    rules: COMMON_RULES,
  },
  {
    slug: 'freshers-help', name: 'Freshers Help', sortOrder: 80,
    description: 'New on campus? Ask anything. Seniors and officials answer here.',
    allowedTypes: ALL,
    rules: [...COMMON_RULES, 'Be patient with freshers. No ragging, no pranks.'],
  },
];

const seeded = new Set(); // campusIds already ensured in this process

/** Ensures the default communities exist for one campus. Returns the number created. */
const ensureDefaults = async (sequelize, campusId) => {
  if (!campusId) return 0;
  const key = String(campusId);
  if (seeded.has(key)) return 0;
  const FriendsCommunity = sequelize.models.FriendsCommunity;
  if (!FriendsCommunity) return 0;
  let created = 0;
  for (const c of DEFAULT_COMMUNITIES) {
    try {
      const [, isNew] = await FriendsCommunity.findOrCreate({
        where: { campusId, slug: c.slug },
        defaults: {
          campusId,
          slug: c.slug,
          name: c.name,
          description: c.description,
          rules: c.rules,
          kind: 'default',
          allowAnonymous: true,
          allowedTypes: c.allowedTypes,
          status: 'active',
          sortOrder: c.sortOrder,
        },
      });
      if (isNew) created++;
    } catch (err) {
      // A concurrent seed for the same campus won the unique index; the row exists.
      if (!/unique|duplicate/i.test(String(err && (err.name || '') + (err.message || '')))) throw err;
    }
  }
  seeded.add(key);
  return created;
};

/** Seeds every active campus (boot). */
const seedAllCampuses = async (sequelize) => {
  const Campus = sequelize.models.Campus;
  if (!Campus || !sequelize.models.FriendsCommunity) return 0;
  const campuses = await Campus.findAll({ where: { isActive: true }, attributes: ['id'] });
  let created = 0;
  for (const c of campuses) created += await ensureDefaults(sequelize, c.id);
  if (created) console.log(`✅ [FRIENDS_FORUM_SEED] created ${created} default communities`);
  return created;
};

const resetSeedCache = () => seeded.clear();

module.exports = { DEFAULT_COMMUNITIES, ensureDefaults, seedAllCampuses, resetSeedCache };
