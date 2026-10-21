// AI Classifier — Multilingual content classification (EN + FR + RU)
// Supports Latin, Cyrillic scripts + Russian domain detection

// ─── Category definitions ─────────────────────────────────────────────────────
export const CATEGORIES = {
  safe:          { key: 'safe',              color: '#10B981' },
  educational:   { key: 'educational',       color: '#3B82F6' },
  entertainment: { key: 'entertainment',     color: '#8B5CF6' },
  news:          { key: 'news_category',     color: '#6B7280' },
  violence:      { key: 'violence_category', color: '#EF4444' },
  adult:         { key: 'adult_category',    color: '#EC4899' },
  gambling:      { key: 'gambling_category', color: '#F59E0B' },
  drugs:         { key: 'drugs_category',    color: '#F97316' },
  hate:          { key: 'hate_category',     color: '#DC2626' },
};

// ─── Cyrillic keyword rules (native Russian script) ──────────────────────────
const CYRILLIC_RULES = {
  violence: [
    'убийство','убить','убивать','оружие','кровь','насилие','взрыв','теракт',
    'расстрел','резня','бомба','нападение','пытка','казнь','война','боевик',
    'террорист','геноцид','жертва','стрельба','нож','пистолет','автомат',
  ],
  adult: [
    'порно','секс','эротика','обнажённый','голый','интим','шлюха','проститутка',
    'онлифанс','стриптиз','извращение','фетиш','похоть','совокупление',
  ],
  gambling: [
    'казино','покер','ставки','азартные игры','букмекер','джекпот','рулетка',
    'слот','автомат','тотализатор','пари','выигрыш','ставка','лотерея',
    'онлайн казино','игровые автоматы','спортивные ставки',
  ],
  drugs: [
    'наркотики','наркотик','кокаин','героин','марихуана','гашиш','амфетамин',
    'метамфетамин','экстаз','лсд','передоз','закладка','спайс','меф','соль',
    'нарко','наркота','наркоман','наркодилер','купить наркотики',
  ],
  hate: [
    'расизм','расист','нацист','фашист','антисемит','исламофоб','ксенофоб',
    'ненависть','дискриминация','неонацист','шовинист','экстремист',
    'белое превосходство','национализм','гитлер','свастика',
  ],
  educational: [
    'образование','учёба','школа','университет','урок','лекция','курс',
    'обучение','учебник','домашнее задание','студент','учитель','наука',
    'математика','история','физика','химия','биология','литература',
  ],
  entertainment: [
    'фильм','кино','музыка','игра','развлечение','сериал','концерт','шоу',
    'стриминг','мультфильм','аниме','видео','блогер','ютуб','тикток',
  ],
  news: [
    'новости','журналист','репортаж','пресса','редакция','газета','телеканал',
    'происшествия','политика','экономика','общество','спорт новости',
    'новостной','последние новости','актуально',
  ],
};

// ─── Latin keyword rules (EN + FR + transliterated RU) ───────────────────────
const LATIN_RULES = {
  violence: {
    weight: 1.0,
    keywords: [
      // EN
      'kill','murder','shoot','weapon','blood','gore','fight','assault',
      'torture','execution','massacre','slaughter','stab','bomb','attack',
      'terrorist','genocide','war crime','brutality','snuff','shooting',
      'gunshot','beheading','lynching','suicide bombing',
      // FR
      'tuer','meurtre','arme','sang','attentat','fusil','couteau','bombe',
      'massacre','tuerie','violence','exécution','torture','attentat terroriste',
      // RU transliterated
      'ubiystvo','oruzhie','nasilie','vzryv','terrakt','bomba','nozh',
    ],
  },
  adult: {
    weight: 1.0,
    keywords: [
      // EN
      'porn','pornography','xxx','sex','nude','naked','erotic','adult content',
      'hentai','onlyfans','escort','stripper','nsfw','explicit','fetish',
      'nudity','sexual content','cam girl','webcam sex','hot girls',
      // FR
      'porno','sexe','nu','érotique','escorte','coquin','charme',
      'contenu adulte','site adulte',
      // RU transliterated
      'porno','seks','erotika','intim','obnazhyon','goliy',
    ],
  },
  gambling: {
    weight: 1.0,
    keywords: [
      // EN
      'casino','poker','bet','betting','gambling','slot machine','jackpot',
      'roulette','blackjack','wager','odds','sportsbook','bookie',
      'sports betting','online gambling','free spins','deposit bonus',
      // FR
      'paris sportifs','jeux argent','mise','cote','bookmaker','casino en ligne',
      'machines à sous','jeux de hasard',
      // RU transliterated
      'kazino','stavki','azartnye igry','bukmeker','dzhekpot','ruletka',
    ],
  },
  drugs: {
    weight: 1.0,
    keywords: [
      // EN
      'cocaine','heroin','marijuana','cannabis','weed','mdma','meth',
      'overdose','fentanyl','opioid','psychedelic','lsd','crack','narcotics',
      'drug dealer','buy drugs','recreational drugs','drug use',
      // FR
      'cocaïne','héroïne','drogue','stupéfiant','cannabis','shit',
      'se droguer','deal de drogue',
      // RU transliterated
      'narkotiki','kokain','geroyin','marihuana','zakladka','spays','mef',
    ],
  },
  hate: {
    weight: 1.0,
    keywords: [
      // EN
      'racism','racist','nazi','white supremacy','antisemit','islamophob',
      'xenophobia','hate speech','slur','supremacist','kkk','neo-nazi',
      'ethnic cleansing','white power','fascism',
      // FR
      'racisme','raciste','islamophobie','néonazi','xénophobie',
      'haine raciale','discours haineux',
      // RU transliterated
      'rasizm','nacist','fashist','antisemitizm','ksenofobiya','neонацист',
    ],
  },
  educational: {
    weight: 0.7,
    keywords: [
      'learn','education','school','university','course','tutorial','lesson',
      'homework','study','academic','science','math','history','lecture',
      'textbook','curriculum','professor','research','knowledge',
      'apprendre','école','université','cours','leçon','devoir','étudiant',
      'ucheba','obrazovanie','urok','shkola','universitet',
    ],
  },
  entertainment: {
    weight: 0.6,
    keywords: [
      'movie','music','game','sport','entertainment','youtube','netflix',
      'streaming','playlist','celebrity','actor','album','concert','anime',
      'film','musique','jeu','divertissement','série','chanson',
      'film','muzyka','igra','razvlechenie','serial',
    ],
  },
  news: {
    weight: 0.5,
    keywords: [
      'breaking news','news','article','press','media','journalist',
      'report','headline','editorial','analysis','correspondent',
      'actualité','nouvelles','presse','journaliste','reportage',
      'novosti','zhurnalist','reportazh','pressa',
    ],
  },
};

// ─── Domain rules (including Russian .ru / .рф domains) ──────────────────────
const DOMAIN_RULES = {
  adult: [
    // International
    'pornhub','xvideos','xhamster','youporn','brazzers','onlyfans',
    'redtube','tube8','spankbang','sex.com','chaturbate','livejasmin',
    // Russian adult sites
    'pornlab','russkoe-porno','русское-порно','porno-video',
    'pornofilm','erotika','intimclub',
  ],
  gambling: [
    // International
    'bet365','pokerstars','draftkings','fanduel','williamhill',
    'betway','888casino','unibet','betfair','bodog',
    // Russian bookmakers & casinos
    'fonbet','1xbet','melbet','winline','olimp.bet','marathonbet',
    'vulkan','cazino','joycasino','slotv','pin-up','mostbet',
  ],
  drugs: [
    'erowid','bluelight','shroomery','tripsit',
    // Russian drug marketplaces (darknet references)
    'hydra','ramp','solaris',
  ],
  violence: [
    'bestgore','liveleak','goregrish',
  ],
  educational: [
    // International
    'wikipedia','khanacademy','coursera','edx','duolingo',
    'wolframalpha','britannica','ted.com','scholar.google','jstor',
    // Russian educational
    'ru.wikipedia','uchi.ru','foxford.ru','skysmart','учи.ру',
    'infourok','урок.рф','interneturok','videouroki','pedsovet',
  ],
  news: [
    // International
    'bbc.','cnn.','reuters.com','apnews.com','nytimes.com',
    'theguardian.com','lemonde.fr','lefigaro.fr','rfi.fr',
    // Russian news
    'rbc.ru','ria.ru','tass.ru','interfax.ru','lenta.ru',
    'gazeta.ru','kommersant.ru','iz.ru','mk.ru','aif.ru',
    'rt.com','vesti.ru','1tv.ru','ntv.ru',
  ],
  entertainment: [
    // International
    'youtube.com','netflix.com','spotify.com','twitch.tv',
    'tiktok.com','instagram.com','twitter.com','reddit.com',
    // Russian entertainment
    'vk.com','ok.ru','rutube.ru','кинопоиск','kinopoisk.ru',
    'ivi.ru','okko.tv','premier.one','more.tv','start.ru',
    'pikabu.ru','habr.com',
  ],
};

// ─── Russian TLD detection ────────────────────────────────────────────────────
const RUSSIAN_TLDS = ['.ru', '.рф', '.su', '.москва', '.moscow'];

function hasRussianTLD(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return RUSSIAN_TLDS.some(tld => lower.includes(tld));
}

// Detect if text contains Cyrillic characters
function hasCyrillic(text) {
  return /[\u0400-\u04FF]/.test(text);
}

// ─── TF.js state ─────────────────────────────────────────────────────────────
let tfReady = false;
let loadAttempted = false;

export async function loadToxicityModel() {
  if (loadAttempted) return tfReady;
  loadAttempted = true;
  try {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    tfReady = true;
    console.log('[SafeGuard AI] TensorFlow.js ready');
  } catch (e) {
    console.warn('[SafeGuard AI] TF.js unavailable, pure heuristic mode');
    tfReady = false;
  }
  return tfReady;
}

export function isModelLoaded() { return tfReady; }

// ─── Cyrillic keyword scoring ─────────────────────────────────────────────────
function scoreCyrillic(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CYRILLIC_RULES)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      scores[cat] = parseFloat(Math.min(0.97, (hits / 3) * 1.0).toFixed(4));
    }
  }
  return scores;
}

// ─── Latin keyword scoring ────────────────────────────────────────────────────
function scoreLatin(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [cat, rule] of Object.entries(LATIN_RULES)) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      scores[cat] = parseFloat(Math.min(0.97, (hits / 3) * rule.weight).toFixed(4));
    }
  }
  return scores;
}

// ─── Domain scoring ───────────────────────────────────────────────────────────
function scoreByDomain(url) {
  if (!url) return {};
  const lower = url.toLowerCase();
  for (const [cat, domains] of Object.entries(DOMAIN_RULES)) {
    for (const d of domains) {
      if (lower.includes(d)) return { [cat]: 0.97 };
    }
  }
  return {};
}

// ─── Semantic similarity (word overlap) ──────────────────────────────────────
const SEEDS_EN = {
  violence:     'violence killing weapons assault murder blood gore shoot stab',
  adult:        'pornographic sexual explicit adult nudity erotic naked',
  gambling:     'casino betting gambling poker slots wager jackpot',
  drugs:        'cocaine heroin marijuana drug overdose narcotics',
  hate:         'racism hate speech discrimination supremacy nazi',
  educational:  'education school learning university study academic course',
  entertainment:'movie music game streaming entertainment youtube',
  news:         'news article journalism press report breaking',
};

const SEEDS_RU = {
  violence:     'убийство оружие насилие кровь смерть война бомба теракт',
  adult:        'порно секс эротика обнажённый голый интим',
  gambling:     'казино ставки покер азартные букмекер джекпот',
  drugs:        'наркотики кокаин героин марихуана закладка передоз',
  hate:         'расизм нацист фашист дискриминация ненависть',
  educational:  'образование школа учёба университет урок наука',
  entertainment:'фильм музыка игра развлечение сериал кино',
  news:         'новости журналист пресса репортаж газета',
};

function scoreSimilarity(text, seeds) {
  const words = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const scores = {};
  for (const [cat, seed] of Object.entries(seeds)) {
    const seedWords = seed.split(' ');
    let overlap = 0;
    for (const w of seedWords) { if (words.has(w)) overlap++; }
    const sim = overlap / seedWords.length;
    if (sim > 0.05) scores[cat] = parseFloat((sim * 0.7).toFixed(4));
  }
  return scores;
}

// ─── Main classify function ───────────────────────────────────────────────────
export async function classifyContent({ text = '', url = '', title = '' }) {
  const combined = (title + ' ' + text).replace(/\s+/g, ' ').trim().slice(0, 4000);
  const isCyrillic = hasCyrillic(combined);
  const isRussianSite = hasRussianTLD(url);

  // 1. Domain check (highest priority)
  const domainScores = scoreByDomain(url);

  // 2. Language-appropriate keyword scoring
  const cyrillicScores = (isCyrillic || isRussianSite)
    ? scoreCyrillic(combined) : {};
  const latinScores = scoreLatin(combined);

  // 3. Semantic similarity
  const simScoresEN = combined.length > 50 ? scoreSimilarity(combined, SEEDS_EN) : {};
  const simScoresRU = (isCyrillic && combined.length > 50)
    ? scoreSimilarity(combined, SEEDS_RU) : {};

  // 4. Merge all scores (domain > cyrillic kw = latin kw > similarity)
  const merged = { ...simScoresEN, ...simScoresRU };
  for (const [cat, score] of Object.entries(latinScores)) {
    merged[cat] = Math.max(merged[cat] || 0, score);
  }
  for (const [cat, score] of Object.entries(cyrillicScores)) {
    merged[cat] = Math.max(merged[cat] || 0, score);
  }
  for (const [cat, score] of Object.entries(domainScores)) {
    merged[cat] = score; // domain is authoritative
  }

  // Boost for Russian sites: if .ru domain + any harmful signal, increase confidence
  if (isRussianSite) {
    for (const harmfulCat of ['violence', 'adult', 'gambling', 'drugs', 'hate']) {
      if (merged[harmfulCat]) merged[harmfulCat] = Math.min(0.97, merged[harmfulCat] * 1.1);
    }
  }

  // 5. Top category
  let topCat = 'safe';
  let topScore = 0;
  for (const [cat, score] of Object.entries(merged)) {
    if (cat !== 'safe' && score > topScore) { topScore = score; topCat = cat; }
  }

  const keyMap = {
    safe: 'safe', educational: 'educational', entertainment: 'entertainment',
    news: 'news_category', violence: 'violence_category', adult: 'adult_category',
    gambling: 'gambling_category', drugs: 'drugs_category', hate: 'hate_category',
  };

  return {
    category:    keyMap[topCat] || 'safe',
    rawCategory: topCat,
    confidence:  parseFloat(topScore.toFixed(3)),
    allScores:   merged,
    explanation: buildExplanation(topCat, topScore, isCyrillic || isRussianSite),
    modelUsed:   tfReady ? 'tensorflow+multilingual' : 'multilingual-heuristic',
    language:    isCyrillic ? 'ru' : 'en/fr',
    timestamp:   new Date().toISOString(),
  };
}

function buildExplanation(cat, score, isRussian) {
  const pct  = Math.round(score * 100);
  const lang = isRussian ? ' (Russian content)' : '';
  const msgs = {
    violence:     `Violent content detected${lang} (${pct}% confidence). Aggressive or harmful language found.`,
    adult:        `Adult content detected${lang} (${pct}% confidence). Not suitable for minors.`,
    gambling:     `Gambling content detected${lang} (${pct}% confidence). References to betting or casino.`,
    drugs:        `Drug-related content detected${lang} (${pct}% confidence). References to substances.`,
    hate:         `Hateful content detected${lang} (${pct}% confidence). Discrimination language found.`,
    educational:  `Educational content${lang} (${pct}% confidence).`,
    entertainment:`Entertainment content${lang} (${pct}% confidence).`,
    news:         `News/media content${lang} (${pct}% confidence).`,
    safe:         `No harmful content detected${lang}. Page appears safe.`,
  };
  return msgs[cat] || msgs.safe;
}

export async function applyFeedback(feedback) {
  console.log('[SafeGuard AI] Feedback:', feedback);
}

export function shouldBlock(result, profileFilters, settings) {
  const { category, confidence } = result;
  const threshold = profileFilters?.aiThreshold ?? settings?.aiThreshold ?? 0.75;
  const filterKeyMap = {
    violence_category: 'violence', adult_category: 'adult_content',
    gambling_category: 'gambling', drugs_category: 'drugs',
    hate_category: 'hate_speech', educational: 'education',
    entertainment: 'entertainment', news_category: 'news', safe: null,
  };
  const filterKey = filterKeyMap[category];
  if (!filterKey) return { block: false };
  const isBlocked = profileFilters?.categories?.[filterKey]?.blocked;
  if (isBlocked && confidence >= threshold) {
    return { block: true, reason: 'ai_category', category, confidence };
  }
  return { block: false };
}
