const { getDailyContentModel } = require('../models/DailyContent');

// Seeded shuffle using Linear Congruential Generator — same date → same order
function seededShuffle(arr, seed) {
  const copy = [...arr];
  let s = Math.abs(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    s = ((s * 1103515245 + 12345) & 0x7fffffff);
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dateSeed() {
  const d = new Date();
  const str = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Admin: create custom daily content ──
exports.createContent = async (req, res) => {
  try {
    const DailyContent = getDailyContentModel();
    if (!DailyContent) return res.status(500).json({ message: 'DailyContent model not loaded' });
    const { type, payload, activeDate, expiresAt, isPublished } = req.body;
    const content = await DailyContent.create({
      type,
      payload,
      activeDate,
      expiresAt,
      isPublished
    });
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get published content for today ──
exports.getActiveContent = async (req, res) => {
  try {
    const DailyContent = getDailyContentModel();
    if (!DailyContent) return res.status(500).json({ message: 'DailyContent model not loaded' });
    const today = new Date().toISOString().split('T')[0];
    const content = await DailyContent.findOne({
      where: {
        activeDate: today,
        isPublished: true
      }
    });
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Daily Truth/Dare rotation (no DB needed) ──
// Returns today's shuffled subset of questions so every day is different.
exports.getDailyTruthDare = async (req, res) => {
  try {
    const seed = dateSeed();
    const count = parseInt(req.query.count) || 10; // how many to return

    // Full campus question pools — same as frontend but authoritative source
    const CAMPUS_TRUTHS = [
      "Hostel warden movie villain aithe, vaallu evariki matching?",
      "Nee classmate GPA entha low ante, repati exam pass ayye chances kante thakkuva?",
      "Canteen lo free ga dorukuthundi ani thinna chetha food ento cheppu?",
      "Room lo vachina gubulu vasanani, nee roommate meedha thosesi thappinchukunnava?",
      "Exam week lo snanam cheyakunda enni rojulu unnav?",
      "Ae professor voice vinte neeku ventane nidra vasthundi?",
      "Nee crush mundhu nuvvu chesina goppa comedy panento gurthunda?",
      "Roommate sodhi chepthanu ante, act cheyataniki eppudaina padukunnattu natinchava?",
      "Curfew time tharwatha bayataki velladaniki warden ki cheppina peddha abaddham enti?",
      "Nee Netflix password evariki isthe nuvvu safe kadhu anukuntunnav?",
      "Classes ki regular ga vellina, ae subject lo neeku 'zero knowledge' undi?",
      "Oke jodu socks ni enni rojulu thodigaav?",
      "Hostel pocket money tho nuvvu konna parama chetha vasthuuvu enti?",
      "Shared fridge lo unna pakkanolla food ni eppudaina dhochi thinnava?",
    ];

    const CAMPUS_DARES = [
      "Roommate ki 'Room lo unna sock ekkado cheppu' ani message petti 1 hour follow up cheyyaku.",
      "Eroju nee phone Screen Time screenshot ni ee chat ki send chey.",
      "WhatsApp status 'Hostel gossip speed calculator' ga 24 hours change chey.",
      "Crush ki 'Library stairs nundi padinapudu emaina debba thagilindha?' ani text petti screenshot pettu.",
      "Extreme confusion face selfie petti send chey.",
      "Creepy voice lo 'Warden chusthunnaru' ani voice note pettu.",
      "Senior ki '1+1 endhuku 3 kadhu?' ani text petti reaction screenshot pettu.",
      "Class WhatsApp group lo 'Exam cancel ayyindha?' ani message petti 5 seconds lo delete chey.",
      "Profile name ni 'Hostel Legend' ga change chesi 2 hours unchu.",
      "Textbook lo unna oka bore line ni voice note lo full dramatic ga read chey.",
      "Kotha number ki 'Nuvvu last semester chesindi naku thelsu' ani text petti screenshot pettu.",
      "Nee room messiest corner photo petti send chey right now.",
      "Keyboard language change chesi kotha language lo message pettu.",
      "Best friend ki 'Nenu Mars ki vellipothunna, emaina kavala?' ani message petti screenshot pettu.",
    ];

    const todayTruths = seededShuffle(CAMPUS_TRUTHS, seed).slice(0, count);
    const todayDares  = seededShuffle(CAMPUS_DARES, seed + 7919).slice(0, count);

    res.status(200).json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      data: {
        truths: todayTruths,
        dares: todayDares,
      }
    });
  } catch (error) {
    console.error('Error generating daily truth/dare:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
