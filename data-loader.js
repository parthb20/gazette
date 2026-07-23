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
  scheme:       { label: 'Government schemes',       icon: '&#127970;', example: 'PM-KUSUM' },
  biodiversity: { label: 'Protected areas',           icon: '&#127795;', example: 'Kaziranga National Park' },
  indices:      { label: 'Indices & reports',         icon: '&#127760;', example: 'Human Development Index' },
  amendments:   { label: 'Constitutional amendments', icon: '&#9878;',   example: '73rd Amendment — Panchayati Raj' },
  history:      { label: 'Modern history',            icon: '&#127988;', example: 'Champaran Satyagraha' },
};

const TAB_PREFIX = { scheme:'Schemes', biodiversity:'Biodiversity', indices:'Indices', amendments:'Amendments', history:'History' };

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
  ],
  indices: [
    ['india_rank','rank','India rank','n'],
    ['countries_ranked','total','Countries ranked','n'],
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
};

const GAZETTE_CAT_ORDER = ['scheme','biodiversity','indices','amendments','history'];

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
          if(complete) pool.push(item);
        });

        CATS[key] = { label: META[key].label, icon: META[key].icon, example: META[key].example, pool: pool, fields: fields };
        SCHEDULE[key] = seededShuffle(pool.map(function(p){ return p.name; }), 'gazette-' + key);
      });

      const launchDate = new Date(LAUNCH_DATE_STR + 'T00:00:00Z');
      const LAUNCH_DAY = Math.floor(launchDate.getTime() / 86400000);

      return { CATS: CATS, CAT_ORDER: GAZETTE_CAT_ORDER, SCHEDULE: SCHEDULE, LAUNCH_DAY: LAUNCH_DAY };
    });
}

const gazetteReady = loadGazetteData();
