const MAX_GUESSES = 10;
const MAX_HINTS = 5;

function hslToRgb(h, s, l){
  s/=100; l/=100;
  const c = (1-Math.abs(2*l-1))*s;
  const x = c*(1-Math.abs((h/60)%2-1));
  const m = l-c/2;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function hueForT(t){
  // green (120deg) -> amber (38deg) -> red (4deg), staying vivid the whole way
  if(t <= 0.5) return 120 + (38-120) * (t/0.5);
  return 38 + (4-38) * ((t-0.5)/0.5);
}
/* Single source of truth for tile color, used for EVERY field type.
   t=0 -> exact, t=0.5 -> close, t=1 -> way off.
   Light and dark mode are tuned separately on purpose, not just inverted -
   light mode needs darker, more saturated text on pale backgrounds;
   dark mode needs lighter text on deeper backgrounds. */
function gradientStyleForT(t){
  t = Math.max(0, Math.min(1, t));
  const hue = hueForT(t);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const fg = isDark ? hslToRgb(hue, 72, 72) : hslToRgb(hue, 58, 32);
  const bg = isDark ? hslToRgb(hue, 40, 20) : hslToRgb(hue, 38, 95);
  return 'background:rgb('+bg.join(',')+');color:rgb('+fg.join(',')+');border-color:rgb('+fg.join(',')+');';
}
function tileT(f, gv, tv){
  if(gv === tv) return 0;
  if(f.t === 'n'){
    const relDist = Math.abs(gv - tv) / Math.max(Math.abs(tv), 1);
    return Math.min(1, relDist / 0.6);
  }
  return (f.g && f.g[gv] === f.g[tv]) ? 0.5 : 1;
}
function formatYear(v){
  return v < 0 ? (Math.abs(v) + ' BCE') : (v + ' CE');
}
function tickBadge(isExact){
  return isExact ? '<span class="tick"></span>' : '';
}
function paintGradientBars(){
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const stopAt = function(t){
    const rgb = isDark ? hslToRgb(hueForT(t), 72, 72) : hslToRgb(hueForT(t), 58, 32);
    return 'rgb('+rgb.join(',')+')';
  };
  document.querySelectorAll('.gbar').forEach(function(bar){
    bar.style.background = 'linear-gradient(90deg, '+stopAt(0)+', '+stopAt(0.5)+', '+stopAt(1)+')';
  });
}
function repaintAllTiles(){
  document.querySelectorAll('.stamp[data-t]').forEach(function(el){
    const t = parseFloat(el.getAttribute('data-t'));
    el.setAttribute('style', gradientStyleForT(t));
  });
}
window.repaintGradientBars = function(){ paintGradientBars(); repaintAllTiles(); };

function renderExampleTiles(c, containerId){
  const target = c.pool[0];
  const html = c.fields.map(function(f){
    const v = target[f.k];
    const displayVal = f.isYear ? formatYear(v) : v;
    return '<div class="stamp" data-t="0" style="'+gradientStyleForT(0)+'">'+tickBadge(true)+'<div class="val">'+displayVal+'</div><div class="lab">'+f.l+'</div></div>';
  }).join('');
  const el = document.getElementById(containerId);
  if(el){
    el.innerHTML = '<div class="tiles">'+html+'</div>';
    const nameEl = document.getElementById(containerId + 'Name');
    if(nameEl) nameEl.textContent = target.name;
  }
}

function initGame(key){
  const c = CATS[key];
  const cs = catState(key);
  const target = targetFor(key);
  track('puzzle_opened', { category:key });

  document.getElementById('gameCatName').textContent = c.label;
  document.getElementById('gameDesc').textContent = 'Type any ' + c.noun + ' below to start - there\u2019s no set question, you\u2019ll see clues after each guess.';
  document.getElementById('gnum').textContent = 0;
  document.getElementById('maxGuesses').textContent = MAX_GUESSES;
  renderExampleTiles(c, 'exampleTiles');

  const input = document.getElementById('guessInput');
  const suggestBox = document.getElementById('suggestBox');
  const rows = document.getElementById('rows');
  const resultCard = document.getElementById('resultCard');
  const emailBox = document.getElementById('signupBox');
  input.placeholder = 'Type any ' + c.noun + '...';

  if(isSignedUp() && emailBox) emailBox.style.display = 'none';

  function renderRow(guessName, num){
    const guessObj = c.pool.find(function(s){ return s.name === guessName; });
    const row = document.createElement('div');
    row.className = 'guess-row';
    const tilesHtml = c.fields.map(function(f){
      const gv = guessObj[f.k], tv = target[f.k];
      const t = tileT(f, gv, tv);
      const displayGv = f.isYear ? formatYear(gv) : gv;
      let val = displayGv;
      if(f.t === 'n' && gv !== tv){
        val = displayGv + ' ' + (gv < tv ? '&#8593;' : '&#8595;');
      }
      return '<div class="stamp" data-t="'+t+'" style="'+gradientStyleForT(t)+'">'+tickBadge(t===0)+'<div class="val">'+val+'</div><div class="lab">'+f.l+'</div></div>';
    }).join('');
    row.innerHTML = '<div class="glabel"><span class="num">'+num+'</span>'+guessName+'</div><div class="tiles">'+tilesHtml+'</div>';
    rows.insertBefore(row, rows.firstChild); // latest guess on top
  }

  function renderAnswerReveal(){
    const html = c.fields.map(function(f){
      const v = target[f.k];
      const displayVal = f.isYear ? formatYear(v) : v;
      return '<div class="stamp" data-t="0" style="'+gradientStyleForT(0)+'">'+tickBadge(true)+'<div class="val">'+displayVal+'</div><div class="lab">'+f.l+'</div></div>';
    }).join('');
    return '<div class="tiles">'+html+'</div>';
  }

  function finishUI(won){
    input.disabled = true;
    if(hintBtn) hintBtn.disabled = true;
    resultCard.style.display = 'block';
    resultCard.classList.toggle('lost', !won);
    resultCard.classList.toggle('won', won);
    const answerEl = document.getElementById('resultAnswer');
    if(won){
      document.getElementById('resultTitle').textContent = 'Solved in ' + cs.guesses.length + (cs.guesses.length>1 ? ' guesses' : ' guess');
      document.getElementById('resultBody').textContent = 'Today\u2019s ' + c.label.toLowerCase().replace(/s$/,'') + ' was:';
    } else {
      document.getElementById('resultTitle').textContent = 'So close! Here\u2019s today\u2019s answer';
      document.getElementById('resultBody').textContent = 'Today\u2019s ' + c.label.toLowerCase().replace(/s$/,'') + ' was:';
    }
    if(answerEl) answerEl.textContent = target.name;
    document.getElementById('resultStats').innerHTML = renderAnswerReveal();
    resultCard.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function registerWinForStreak(){
    if(state.lastWinDay === DAY) return;
    state.streak = (state.lastWinDay === DAY - 1) ? state.streak + 1 : 1;
    state.lastWinDay = DAY;
    renderStreakBadge();
  }

  function submitGuess(name){
    if(cs.done) return;
    cs.guesses.push(name);
    renderRow(name, cs.guesses.length);
    document.getElementById('gnum').textContent = Math.min(cs.guesses.length, MAX_GUESSES);

    const correct = name === target.name;
    track('guess_submitted', { category:key, guess_number: cs.guesses.length, correct: correct });

    if(correct){
      cs.done = true; cs.won = true;
      registerWinForStreak();
      finishUI(true);
      track('puzzle_solved', { category:key, guesses: cs.guesses.length });
    } else if(cs.guesses.length >= MAX_GUESSES){
      cs.done = true; cs.won = false;
      finishUI(false);
      track('puzzle_failed', { category:key });
    }
    saveState(state);
  }

  const hintBtn = document.getElementById('hintBtn');
  function renderHint(){
    const revealed = cs.hintsUsed;
    document.getElementById('hintDisplay').textContent = target.name.slice(0, revealed) + '\u2026';
    document.getElementById('hintProgress').textContent = revealed + '/' + MAX_HINTS;
    document.getElementById('hintCount').textContent = (MAX_HINTS - revealed);
    if(revealed >= MAX_HINTS || cs.done) hintBtn.disabled = true;
  }
  if(hintBtn){
    hintBtn.addEventListener('click', function(){
      if(cs.hintsUsed >= MAX_HINTS || cs.done) return;
      cs.hintsUsed++;
      saveState(state);
      track('hint_used', { category:key, hints_used: cs.hintsUsed });
      document.getElementById('hintBox').style.display = 'block';
      renderHint();
    });
    if(cs.hintsUsed > 0){ document.getElementById('hintBox').style.display = 'block'; renderHint(); }
  }

  input.addEventListener('input', function(){
    const q = input.value.trim().toLowerCase();
    suggestBox.innerHTML = '';
    if(!q){ suggestBox.style.display = 'none'; return; }
    const already = new Set(cs.guesses);
    const matches = c.pool.filter(function(s){ return fuzzyMatchesQuery(s, q) && !already.has(s.name); }).slice(0,6);
    if(!matches.length){ suggestBox.style.display = 'none'; return; }
    matches.forEach(function(m){
      const opt = document.createElement('div');
      opt.className = 'opt';
      opt.textContent = m.name;
      opt.addEventListener('click', function(){ submitGuess(m.name); suggestBox.style.display='none'; input.value=''; });
      suggestBox.appendChild(opt);
    });
    suggestBox.style.display = 'block';
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('.search-wrap')) suggestBox.style.display = 'none';
  });

  function buildShareText(){
    const siteUrl = window.location.href.split('?')[0].split('#')[0];
    if(cs.won){
      return `I just solved today's Gazette (${c.label}) in ${cs.guesses.length} guess${cs.guesses.length>1?'es':''}! Can you beat me?\n${siteUrl}`;
    }
    return `Today's Gazette (${c.label}) puzzle got me! Think you can solve it?\n${siteUrl}`;
  }

  document.getElementById('shareBtn').addEventListener('click', function(){
    const grid = buildShareText();
    track('share_copied', { category:key });

    function showFallback(){
      const box = document.getElementById('shareFallback');
      const ta = document.getElementById('shareFallbackText');
      ta.value = grid; box.style.display = 'block'; ta.focus(); ta.select();
    }
    function legacyCopy(){
      const ta = document.createElement('textarea');
      ta.value = grid; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      let ok = false;
      try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    const btn = document.getElementById('shareBtn');
    const old = btn.innerHTML;
    function copiedFeedback(){ btn.innerHTML = 'Copied'; setTimeout(function(){ btn.innerHTML = old; }, 1500); }

    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(grid).then(copiedFeedback).catch(function(){ if(legacyCopy()) copiedFeedback(); else showFallback(); });
    } else if(legacyCopy()){ copiedFeedback(); } else { showFallback(); }
  });

  const nativeShareBtn = document.getElementById('nativeShareBtn');
  if(nativeShareBtn){
    if(navigator.share){
      nativeShareBtn.addEventListener('click', function(){
        track('native_share', { category:key });
        navigator.share({ text: buildShareText() }).catch(function(){});
      });
    } else {
      nativeShareBtn.style.display = 'none';
    }
  }

  const emailBtn = document.getElementById('emailBtn');
  if(emailBtn){
    emailBtn.addEventListener('click', function(){
      const val = document.getElementById('emailInput').value.trim();
      if(!val || !val.includes('@')) return;
      captureEmail(val);
      emailBox.innerHTML = '<p>You\u2019re in. Tomorrow\u2019s puzzle will follow this streak.</p>';
    });
  }

  cs.guesses.forEach(function(gName, i){ renderRow(gName, i+1); });
  document.getElementById('gnum').textContent = Math.min(cs.guesses.length, MAX_GUESSES);
  if(cs.done) finishUI(cs.won);

  renderStreakBadge();
  paintGradientBars();
}
