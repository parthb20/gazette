/* CATS, CAT_ORDER, SCHEDULE, LAUNCH_DAY are filled in once
   data-loader.js finishes fetching and parsing the Excel file. */
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
}

/* ---------------- theme ---------------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gazette_theme', t);
  const btn = document.getElementById('themeToggle');
  if(btn) btn.innerHTML = t === 'dark' ? '&#9788;' : '&#9789;';
}
function initTheme(){
  applyTheme(localStorage.getItem('gazette_theme') || 'light');
}
initTheme();

/* ---------------- modals ---------------- */
function openModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.add('open');
}
function closeModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.remove('open');
}

/* ---------------- shared header wiring (theme / guide / feedback / streak) ---------------- */
function wireHeader(){
  const themeBtn = document.getElementById('themeToggle');
  if(themeBtn) themeBtn.addEventListener('click', function(){
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  const guideBtn = document.getElementById('guideBtn');
  if(guideBtn) guideBtn.addEventListener('click', function(){ openModal('guideModal'); track('guide_opened'); });

  const feedbackBtn = document.getElementById('feedbackBtn');
  if(feedbackBtn) feedbackBtn.addEventListener('click', function(){ openModal('feedbackModal'); track('feedback_opened'); });

  const streakBtn = document.getElementById('streakBtn');
  if(streakBtn) streakBtn.addEventListener('click', function(){
    const signedIn = isSignedUp();
    document.getElementById('streakModalCount').textContent = state.streak;
    document.getElementById('streakModalSignedOut').style.display = signedIn ? 'none' : 'block';
    document.getElementById('streakModalSignedIn').style.display = signedIn ? 'block' : 'none';
    openModal('streakModal');
    track('streak_badge_clicked', { signed_up: signedIn });
  });

  document.querySelectorAll('[data-close-modal]').forEach(function(btn){
    btn.addEventListener('click', function(){ closeModal(btn.getAttribute('data-close-modal')); });
  });
  document.querySelectorAll('.modal-overlay').forEach(function(ov){
    ov.addEventListener('click', function(e){ if(e.target === ov) ov.classList.remove('open'); });
  });

  const googleBtn = document.getElementById('googleSignInBtn');
  if(googleBtn) googleBtn.addEventListener('click', function(){
    track('google_signin_clicked');
    alert('Google sign-in isn\u2019t wired up yet. This is a placeholder for now.');
  });

  renderStreakBadge();
}
document.addEventListener('DOMContentLoaded', wireHeader);
