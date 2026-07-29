/* ---------------------------------------------------------------
   Reads database/gazette_database.xlsx directly in the browser
   (using the vendored SheetJS library) and builds the same
   CATS / CAT_ORDER / SCHEDULE / LAUNCH_DAY structures the rest of
   the site expects. No build step — edit the Excel file, upload it,
   done. Every visitor's browser parses it fresh on page load.

   IMPORTANT: fetch() of a local file only works when served over
   http(s) — via GitHub Pages, or `python3 -m http.server` while
   testing locally. It will NOT work if you just double-click
   index.html and open it as a file:// URL — that's a browser
   security restriction, not a bug in this code.
------------------------------------------------------------------ */

const LAUNCH_DATE_STR = '2026-07-23'; // day 1, for the "Roll no." counter
const DB_URL = 'database/gazette_database.xlsx';

const META = {
  scheme:       { label: 'Government schemes',       icon: '&#127970;', example: 'PM-KUSUM',
                  hint: 'Guess the government scheme', desc: 'Guess a real central government scheme from clues about when it launched, which ministry runs it, and who it targets.' },
  biodiversity: { label: 'Protected areas',           icon: '&#127795;', example: 'Kaziranga National Park',
                  hint: 'Guess the national park or reserve', desc: 'Guess a national park or protected area from clues about its state, size, and famous species.' },
  indices:      { label: 'Indices & reports',         icon: '&#127760;', example: 'Human Development Index',
                  hint: 'Guess the global index or report', desc: 'Guess a global index or report from clues about India\u2019s rank, who publishes it, and when it started.' },
  amendments:   { label: 'Constitutional amendments', icon: '&#9878;',   example: '73rd Amendment: Panchayati Raj',
                  hint: 'Guess the constitutional amendment', desc: 'Guess a constitutional amendment from clues about its number, year, subject, and the government that passed it.' },
  history:      { label: 'Modern history',            icon: '&#127988;', example: 'Champaran Satyagraha',
                  hint: 'Guess the freedom movement or event', desc: 'Guess a movement or event from the freedom struggle from clues about its year, leader, and region.' },
  ancient_history: { label: 'Ancient history',        icon: '&#127961;', example: 'Maurya Empire',
                  hint: 'Guess the ancient dynasty or era', desc: 'Guess an ancient Indian dynasty or era from clues about when it ruled, its capital region, and what it\u2019s known for.' },
  medieval_history: { label: 'Medieval history',      icon: '&#127984;', example: 'Mughal Empire',
                  hint: 'Guess the medieval dynasty or empire', desc: 'Guess a medieval Indian dynasty or empire from clues about when it ruled, its founder, and its capital.' },
  rivers:       { label: 'Rivers of India',           icon: '&#127754;', example: 'Ganga',
                  hint: 'Guess the Indian river', desc: 'Guess an Indian river from clues about its length, where it originates, and which sea it flows into.' },
  mountains:    { label: 'Mountains & peaks',         icon: '&#9968;',   example: 'Kangchenjunga',
                  hint: 'Guess the mountain peak or range', desc: 'Guess an Indian mountain peak from clues about its height, range, and state.' },
};

const SUBJECTS = {
  history:     { label: 'History',              icon: '&#127963;', leaves: ['ancient_history','medieval_history','history'] },
  geography:   { label: 'Geography',             icon: '&#127757;', leaves: ['rivers','mountains'] },
  polity:      { label: 'Polity',                icon: '&#9878;',   leaves: ['amendments'] },
  economy:     { label: 'Economy',               icon: '&#127970;', leaves: ['scheme'] },
  environment: { label: 'Environment & Ecology', icon: '&#127795;', leaves: ['biodiversity'] },
  current_affairs: { label: 'Current Affairs',   icon: '&#127760;', leaves: ['indices'] },
};

const LEAF_TO_SUBJECT = {};
Object.keys(SUBJECTS).forEach(function(sk){ SUBJECTS[sk].leaves.forEach(function(lk){ LEAF_TO_SUBJECT[lk] = sk; }); });

const TAB_PREFIX = { scheme:'Schemes', biodiversity:'Biodiversity', indices:'Indices', amendments:'Amendments', history:'History',
  ancient_history:'AncientHistory', medieval_history:'MedievalHistory', rivers:'Rivers', mountains:'Mountains' };

// [excel_column, js_key, display_label, 'n' or 'c']
const FIELD_MAPS = {
  scheme: [
    ['year_launched','year','Year launched','n'],
    ['ministry','ministry','Ministry','c'],
    ['sector','sector','Sector','c'],
    ['target_group','tgroup','Target group','c'],
    ['states_covered','states','States covered','n'],
    ['budget_cr','budget','Budget (rs cr)','n'],
  ],
  biodiversity: [
    ['year_established','year','Year established','n'],
    ['state','state','State','c'],
    ['area_sq_km','area','Area (sq km)','n'],
    ['famous_species','species','Famous species','c'],
    ['area_type','ptype','Protected area type','c'],
  ],
  indices: [
    ['india_rank','rank','India rank','n'],
    ['countries_ranked','total','Total countries ranked','n'],
    ['year_started','year','Year started','n'],
    ['publishing_body','body','Publishing body','c'],
  ],
  amendments: [
    ['amendment_number','number','Amendment number','n'],
    ['year_passed','year','Year passed','n'],
    ['subject_area','subject','Subject area','c'],
    ['government_in_power','pm','Government in power','c'],
  ],
  history: [
    ['year','year','Year','n'],
    ['leader','leader','Leader','c'],
    ['event_type','type','Event type','c'],
    ['region','region','Region','c'],
  ],
  ancient_history: [
    ['start_year','year','Start year','n','y'],
    ['end_year','endYear','End year','n','y'],
    ['capital_region','region','Capital / region','c'],
    ['notable_for','notable','Notable for','c'],
  ],
  medieval_history: [
    ['start_year','year','Start year','n','y'],
    ['end_year','endYear','End year','n','y'],
    ['founder','founder','Founder','c'],
    ['capital','capital','Capital','c'],
  ],
  rivers: [
    ['length_km','length','Length (km)','n'],
    ['origin_state','origin','Origin','c'],
    ['river_system','system','River system','c'],
    ['falls_into','sea','Falls into','c'],
  ],
  mountains: [
    ['height_m','height','Height (m)','n'],
    ['range','range','Range','c'],
    ['state','state','State','c'],
  ],
};

const GAZETTE_CAT_ORDER = ['scheme','biodiversity','indices','amendments','history','ancient_history','medieval_history','rivers','mountains'];

/* Deterministic seeded shuffle — same seed always produces the same
   order, so every visitor's browser computes the identical daily
   rotation independently (critical: nobody's random() can disagree). */
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seedStr){
  const out = arr.slice();
  const rng = mulberry32(xmur3(seedStr)());
  for(let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadGazetteData(){
  return fetch(DB_URL)
    .then(function(resp){
      if(!resp.ok) throw new Error('Could not fetch ' + DB_URL + ' (HTTP ' + resp.status + ')');
      return resp.arrayBuffer();
    })
    .then(function(buf){
      const wb = XLSX.read(buf, { type: 'array' });
      const CATS = {};
      const SCHEDULE = {};

      GAZETTE_CAT_ORDER.forEach(function(key){
        const prefix = TAB_PREFIX[key];
        const fmap = FIELD_MAPS[key];
        const entrySheet = wb.Sheets[prefix + '_Entries'];
        const groupSheet = wb.Sheets[prefix + '_Groups'];
        if(!entrySheet || !groupSheet){
          throw new Error('Missing sheet "' + prefix + '_Entries" or "' + prefix + '_Groups" in the workbook');
        }
        const entries = XLSX.utils.sheet_to_json(entrySheet, { defval: null });
        const groupsRaw = XLSX.utils.sheet_to_json(groupSheet, { defval: null });

        const groupLookup = {};
        groupsRaw.forEach(function(g){
          if(!g.field_name) return;
          if(!groupLookup[g.field_name]) groupLookup[g.field_name] = {};
          groupLookup[g.field_name][g.value] = g.group;
        });

        const fields = fmap.map(function(m){
          const f = { k: m[1], l: m[2], t: m[3] };
          if(f.t === 'c') f.g = groupLookup[m[0]] || {};
          if(m[4] === 'y') f.isYear = true;
          return f;
        });

        const pool = [];
        entries.forEach(function(row){
          if(!row.name) return;
          const item = { name: row.name };
          let complete = true;
          for(let i = 0; i < fmap.length; i++){
            const col = fmap[i][0], jsKey = fmap[i][1];
            const val = row[col];
            if(val === null || val === undefined || val === ''){ complete = false; break; }
            item[jsKey] = val;
          }
          if(row.aliases){
            item.aliases = String(row.aliases).split(',').map(function(a){ return a.trim().toLowerCase(); }).filter(Boolean);
          } else {
            item.aliases = [];
          }
          if(complete) pool.push(item);
        });

        CATS[key] = { label: META[key].label, icon: META[key].icon, example: META[key].example, hint: META[key].hint, desc: META[key].desc, pool: pool, fields: fields };
        SCHEDULE[key] = seededShuffle(pool.map(function(p){ return p.name; }), 'gazette-' + key);
      });

      const launchDate = new Date(LAUNCH_DATE_STR + 'T00:00:00Z');
      const LAUNCH_DAY = Math.floor(launchDate.getTime() / 86400000);

      return { CATS: CATS, CAT_ORDER: GAZETTE_CAT_ORDER, SCHEDULE: SCHEDULE, LAUNCH_DAY: LAUNCH_DAY, SUBJECTS: SUBJECTS, LEAF_TO_SUBJECT: LEAF_TO_SUBJECT };
    });
}

function levenshtein(a, b){
  const m = a.length, n = b.length;
  if(m === 0) return n;
  if(n === 0) return m;
  const dp = new Array(n + 1);
  for(let j = 0; j <= n; j++) dp[j] = j;
  for(let i = 1; i <= m; i++){
    let prev = dp[0];
    dp[0] = i;
    for(let j = 1; j <= n; j++){
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1]);
      prev = tmp;
    }
  }
  return dp[n];
}
/* Fuzzy-matches a query against a pool item's name/aliases: exact substring
   always matches; otherwise allows small typos (distance tolerance scales
   with query length so short queries aren't matched too loosely). */
function fuzzyMatchesQuery(item, query){
  const q = query.toLowerCase().trim();
  if(!q) return false;
  const candidates = [item.name.toLowerCase()].concat(item.aliases || []);
  for(let i = 0; i < candidates.length; i++){
    const cand = candidates[i];
    if(cand.includes(q)) return true;
    const words = cand.split(/\s+/);
    const tolerance = q.length <= 4 ? 1 : (q.length <= 8 ? 2 : 3);
    for(let w = 0; w < words.length; w++){
      if(Math.abs(words[w].length - q.length) <= tolerance && levenshtein(words[w], q) <= tolerance) return true;
    }
    if(Math.abs(cand.length - q.length) <= tolerance && levenshtein(cand, q) <= tolerance) return true;
  }
  return false;
}

const gazetteReady = loadGazetteData();
