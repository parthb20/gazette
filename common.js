/* CATS, CAT_ORDER, SCHEDULE, LAUNCH_DAY are filled in once
   data-loader.js finishes fetching and parsing the Excel file —
   see the gazetteReady.then(...) block at the bottom of each page. */
var CATS, CAT_ORDER, SCHEDULE, LAUNCH_DAY;

const DAY = Math.floor(Date.now() / 86400000);

function targetFor(key){
  const schedule = SCHEDULE[key];
  const pool = CATS[key].pool;
  const dayIndex = DAY - LAUNCH_DAY;
  const idx = ((dayIndex % schedule.length) + schedule.length) % schedule.length;
  const name = schedule[idx];
  return pool.find(function(s){ return s.name === name; });
}

const SKEY = 'gazette_state_v1';
function loadState(){
  try{ return JSON.parse(localStorage.getItem(SKEY)) || {}; }catch(e){ return {}; }
}
function saveState(s){ localStorage.setItem(SKEY, JSON.stringify(s)); }
let state = loadState();
if(!state.day || state.day !== DAY){
  state = { day: DAY, streak: state.streak || 0, lastWinDay: state.lastWinDay || null, progress: {} };
  saveState(state);
}
function catState(key){
  if(!state.progress[key]) state.progress[key] = { guesses: [], done:false, won:false };
  return state.progress[key];
}
function tileClass(f, gv, tv){
  if(gv === tv) return 'hit';
  if(f.t === 'c' && f.g[gv] === f.g[tv]) return 'near';
  return 'miss';
}

function renderStreakBadge(){
  const el = document.getElementById('streakVal');
  if(el) el.textContent = state.streak;
  const pn = document.getElementById('puzzleNo');
  if(pn) pn.textContent = 'Roll no. ' + String(DAY % 10000).padStart(4,'0');
}
