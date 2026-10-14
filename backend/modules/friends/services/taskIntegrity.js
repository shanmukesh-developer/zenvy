/**
 * Academic-integrity check for Friends > Tasks (spec section 8): keyword + context, run on the server
 * for every create and edit. check(fields) -> { decision: 'allow'|'flag'|'block', reasons[], details[] }.
 *
 * BLOCKED (422 ACADEMIC_INTEGRITY, clear reason, appealable):
 *   EXAM_TAKING        taking / writing / sitting someone's exam, test, quiz or viva, or answering live during one
 *   PROXY_ATTENDANCE   proxy attendance, marking someone present, attending a class as them
 *   IMPERSONATION      logging in as someone, using their credentials, pretending to be them
 *   GRADED_WORK        doing someone's graded work for submission ("complete my assignment",
 *                      "write my lab record", "submit it in my name")
 *   FAKE_CREDENTIALS   fake / forged certificates, marksheets, IDs, letters or signatures
 * FLAGGED (saved as pending_review + a system report for a human):
 *   GRADED_WORK_UNCLEAR  graded work + a "do it" verb, with no tutoring / explanation cue
 * ALLOWED: tutoring, explanations, doubt clearing, debugging, reviews / feedback, study materials,
 *   notes and printouts ("help me understand my DBMS assignment", "debug my project").
 *
 * Matching runs on a normalised copy (lower case, leetspeak undone, accents dropped) so simple
 * obfuscation ("t@ke my 3xam") is still caught. Admin flag / block keyword lists keep working through
 * contentPolicy, which the controller runs as well.
 */
const { normalise } = require('./contentPolicy');

const REASON_TEXT = {
  EXAM_TAKING: 'Tasks cannot ask someone to take, write or answer an exam, test, quiz or viva for you.',
  PROXY_ATTENDANCE: 'Proxy attendance (marking or attending in someone else\'s place) is not allowed.',
  IMPERSONATION: 'Tasks cannot ask anyone to log in as you or pretend to be you.',
  GRADED_WORK: 'Tasks cannot ask someone to do graded work for you to submit. Ask for tutoring, an explanation or debugging help instead.',
  FAKE_CREDENTIALS: 'Fake or forged certificates, marksheets, letters, IDs or signatures are not allowed.',
  GRADED_WORK_UNCLEAR: 'This looks like it may involve graded work, so a moderator will check it before it goes live.',
};

const ASSESSMENT = '(?:exam|exams|examination|test|tests|quiz|quizzes|viva|midterm|midsem|mid sem|endsem|end sem|semester exam|internal exam|internals|mock test|online test|placement test|assessment)';
// Words after an assessment noun that make it about preparation, not taking it ("my exam notes", "my test cases").
const NOT_TAKING = '(?!\\s+(?:prep|preparation|notes|schedule|timetable|syllabus|pattern|tips|strategy|revision|doubts?|concepts?|topics?|questions? papers?|portions?|cases?|suites?|scripts?|code|data|series|results?|marks?|dates?|hall tickets?|fees?|forms?|centre|center|venue))';
const GRADED = '(?:assignment|assignments|lab record|lab records|record|records|lab manual|project report|project reports|thesis|dissertation|homework|home work|capstone|term paper|term papers|internal assessment|graded work|mini project|major project|final year project|final project|seminar report|case study submission|coursework|course work|journal)';
const DO_VERB = '(?:write|complete|do|finish|make|prepare|solve|build|code|draft|type out|submit)';
const TUTOR_CUE = /\b(?:explain|explanation|teach|tutor|tutoring|understand|understanding|guide|guidance|doubt|doubts|debug|debugging|review|feedback|learn|learning|clarify|walk me through|mentor|concept|concepts|study|revision|revise|practice|check my|proofread|correct my mistakes)\b/;

const RULES = [
  // Exam taking / live answering.
  { code: 'EXAM_TAKING', re: new RegExp(`\\b(?:take|write|attempt|attend|sit|sit in|sit for|appear|appear for|give)\\s+(?:\\w+\\s+){0,2}(?:my|our|his|her)\\s+(?:\\w+\\s+){0,2}${ASSESSMENT}\\b${NOT_TAKING}`) },
  { code: 'EXAM_TAKING', re: new RegExp(`\\b${ASSESSMENT}\\s+(?:for me|on my behalf|in my place|instead of me)\\b`) },
  { code: 'EXAM_TAKING', re: new RegExp(`\\b(?:answers?|solutions?|help|answer)\\s+(?:\\w+\\s+){0,2}(?:during|in|while)\\s+(?:the\\s+|my\\s+|an?\\s+)?(?:live\\s+|online\\s+)?${ASSESSMENT}\\b`) },
  { code: 'EXAM_TAKING', re: new RegExp(`\\bsolve\\s+(?:my|the)\\s+(?:live\\s+|online\\s+)?${ASSESSMENT}\\b`) },
  { code: 'EXAM_TAKING', re: /\b(?:dummy candidate|exam proxy|proxy exam|proxy candidate)\b/ },
  // Proxy attendance.
  { code: 'PROXY_ATTENDANCE', re: /\bproxy\b(?:\s+\w+){0,3}\s+(?:attendance|class|classes|lecture|lab|for me)\b/ },
  { code: 'PROXY_ATTENDANCE', re: /\b(?:attendance)\s+(?:proxy|for me|on my behalf)\b/ },
  { code: 'PROXY_ATTENDANCE', re: /\b(?:mark|give|put|sign)\s+(?:my|our)\s+(?:attendance|present)\b/ },
  { code: 'PROXY_ATTENDANCE', re: /\b(?:attend|sit in)\s+(?:my|the)\s+(?:class|classes|lecture|lectures|lab|labs)\s+(?:for me|as me|in my place|on my behalf|instead of me)\b/ },
  // Impersonation.
  { code: 'IMPERSONATION', re: /\b(?:log ?in|sign ?in)\s+(?:as me|with my (?:id|password|credentials|account)|to my (?:portal|lms|erp|account))\b/ },
  { code: 'IMPERSONATION', re: /\b(?:pretend to be me|impersonate|act as me|pose as me|use my (?:id card|login|credentials|password))\b/ },
  // Fake credentials.
  { code: 'FAKE_CREDENTIALS', re: /\b(?:fake|forged|forge|duplicate|bogus|edited|morphed)\s+(?:\w+\s+){0,2}(?:certificate|certificates|marksheet|marksheets|mark sheet|grade card|transcript|degree|diploma|id card|identity card|internship letter|offer letter|experience letter|medical certificate|bonafide|noc|signature|attendance certificate)\b/ },
  { code: 'FAKE_CREDENTIALS', re: /\b(?:forge|fake)\s+(?:my|a|the|his|her)?\s*(?:signature|sign)\b/ },
  // Graded work for submission (strong forms).
  // printSafe: skipped for printing / copying jobs. tutorSafe: with a tutoring cue it is held for a
  // human (flag) instead of refused ("explain how to complete my assignment").
  { code: 'GRADED_WORK', printSafe: true, tutorSafe: true, re: new RegExp(`\\b${DO_VERB}\\s+(?:\\w+\\s+){0,3}(?:my|our)\\s+(?:\\w+\\s+){0,3}${GRADED}\\b`) },
  { code: 'GRADED_WORK', re: /\b(?:submit|submitted|hand in|turn in)\s+(?:\w+\s+){0,3}(?:as mine|as my own|in my name|under my name|on my behalf)\b/ },
  { code: 'GRADED_WORK', re: new RegExp(`\\b${GRADED}\\s+(?:\\w+\\s+){0,3}(?:for me to submit|to submit as mine|in my name|on my behalf|ready to submit)\\b`) },
];

// Printing / copying jobs mention graded work without doing it ("make 30 copies of my record").
const PRINT_CUE = /\b(?:print|prints|printout|printouts|print out|xerox|photocopy|photocopies|copies|binding|bind|spiral|lamination|laminate|scan|scanning)\b/;

const WEAK_GRADED = new RegExp(`\\b${GRADED}\\b`);
const WEAK_DO = new RegExp(`\\b${DO_VERB}\\b`);

/**
 * @param {object} f { title, description, skills[], areaHint }
 * @returns {{ decision: 'allow'|'flag'|'block', reasons: string[], details: string[] }}
 */
const check = (f = {}) => {
  const text = [f.title, f.description, Array.isArray(f.skills) ? f.skills.join(' ') : '', f.areaHint]
    .filter((x) => typeof x === 'string' && x.trim()).join('\n');
  const norm = normalise(text).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const block = new Set();
  const printJob = PRINT_CUE.test(norm);
  const tutoring = TUTOR_CUE.test(norm);
  let softened = false;
  for (const rule of RULES) {
    if (rule.printSafe && printJob) continue;
    if (!rule.re.test(norm)) continue;
    if (rule.tutorSafe && tutoring) { softened = true; continue; }
    block.add(rule.code);
  }
  if (block.size) {
    const reasons = [...block];
    return { decision: 'block', reasons, details: reasons.map((r) => REASON_TEXT[r]) };
  }
  if (softened || (!printJob && WEAK_GRADED.test(norm) && WEAK_DO.test(norm) && !tutoring)) {
    return { decision: 'flag', reasons: ['GRADED_WORK_UNCLEAR'], details: [REASON_TEXT.GRADED_WORK_UNCLEAR] };
  }
  return { decision: 'allow', reasons: [], details: [] };
};

/** Short guidance the app shows in the composer (same source as the server rules). */
const GUIDANCE = {
  allowed: ['Tutoring and doubt clearing', 'Explaining concepts', 'Debugging and code review', 'Feedback on your own draft', 'Notes, printouts and study material', 'Design, errands and other non-graded help'],
  notAllowed: ['Taking or answering an exam, test, quiz or viva for someone', 'Proxy attendance', 'Logging in as someone or impersonating them', 'Doing graded work for someone to submit', 'Fake or forged certificates, letters or signatures'],
};

module.exports = { check, REASON_TEXT, GUIDANCE };
