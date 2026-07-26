const MAX_GUESSES = 10;
const MAX_HINTS = 5;

function parseThemeColor(varName){
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const hex = v.replace('#','');
  return [0,2,4].map(function(i){ return parseInt(hex.substr(i,2),16); });
}
function lerpColor(c1, c2, t){
  return [0,1,2].map(function(i){ return Math.round(c1[i] + (c2[i]-c1[i]) * t); });
}
function numericGradientStyle(relDist){
  relDist = Math.max(0, Math.min(1, relDist));
  const green = parseThemeColor('--stamp-green'), amber = parseThemeColor('--stamp-amber'), red = parseThemeColor('--stamp-red');
  const greenBg = parseThemeColor('--stamp-green-bg'), amberBg = parseThemeColor('--stamp-amber-bg'), redBg = parseThemeColor('--stamp-red-bg');
  let fg, bg;
  if(relDist <= 0.5){
    const t = relDist / 0.5;
    fg = lerpColor(green, amber, t); bg = lerpColor(greenBg, amberBg, t);
  } else {
    const t = (relDist - 0.5) / 0.5;
    fg = lerpColor(amber, red, t); bg = lerpColor(amberBg, redBg, t);
  }
  return 'background:rgb('+bg.join(',')+');color:rgb('+fg.join(',')+');border-color:rgb('+fg.join(',')+');';
}

function formatYear(v){
  return v < 0 ? (Math.abs(v) + ' BCE') : (v + ' CE');
}

function renderExampleTiles(c, containerId){
  const target = c.pool[0];
  const html = c.fields.map(function(f){
    const v = target[f.k];
    const displayVal = f.isYear ? formatYear(v) : v;
    return '<div class="stamp hit"><div class="val">'+displayVal+'</div><div class="lab">'+f.l+'</div></div>';
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
  document.getElementById('gameDesc').textContent = c.desc;
  document.getElementById('gnum').textContent = 0;
  document.getElementById('maxGuesses').textContent = MAX_GUESSES;
  renderExampleTiles(c, 'exampleTiles');

  const input = document.getElementById('guessInput');
  const suggestBox = document.getElementById('suggestBox');
  const rows = document.getElementById('rows');
  const resultCard = document.getElementById('resultCard');
  const emailBox = document.getElementById('signupBox');
  input.placeholder = 'Type your guess...';

  if(isSignedUp() && emailBox) emailBox.style.display = 'none';

  function renderRow(guessName, num){
    const guessObj = c.pool.find(function(s){ return s.name === guessName; });
    const row = document.createElement('div');
    row.className = 'guess-row';
    const tilesHtml = c.fields.map(function(f){
      const gv = guessObj[f.k], tv = target[f.k];
      if(f.t === 'n'){
        const displayGv = f.isYear ? formatYear(gv) : gv;
        if(gv === tv) return '<div class="stamp hit"><div class="val">'+displayGv+'</div><div class="lab">'+f.l+'</div></div>';
        const relDist = Math.abs(gv - tv) / Math.max(Math.abs(tv), 1);
        const arrow = gv < tv ? '&#8593;' : '&#8595;';
        return '<div class="stamp" style="'+numericGradientStyle(relDist)+'"><div class="val">'+displayGv+' '+arrow+'</div><div class="lab">'+f.l+'</div></div>';
      }
      const cls = tileClass(f, gv, tv);
      return '<div class="stamp '+cls+'"><div class="val">'+gv+'</div><div class="lab">'+f.l+'</div></div>';
    }).join('');
    row.innerHTML = '<div class="glabel"><span class="num">'+num+'</span>'+guessName+'</div><div class="tiles">'+tilesHtml+'</div>';
    rows.insertBefore(row, rows.firstChild); // latest guess on top
  }

  function finishUI(won){
    input.disabled = true;
    if(hintBtn) hintBtn.disabled = true;
    resultCard.style.display = 'block';
    resultCard.classList.toggle('lost', !won);
    resultCard.classList.toggle('won', won);
    if(won){
      document.getElementById('resultTitle').textContent = 'Solved in ' + cs.guesses.length + (cs.guesses.length>1 ? ' guesses' : ' guess');
      document.getElementById('resultBody').textContent = 'Today\u2019s ' + c.label.toLowerCase().replace(/s$/,'') + ' was ' + target.name + '.';
    } else {
      document.getElementById('resultTitle').textContent = 'Out of guesses';
      document.getElementById('resultBody').textContent = 'Today\u2019s answer was ' + target.name + '. Back tomorrow for a new one.';
    }
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
    const maskedChars = target.name.split('').map(function(ch, i){
      if(ch === ' ' || ch === '-' || ch === ':') return ch;
      return i < revealed ? ch : '_';
    });
    // reveal letters left-to-right skipping spaces for the "revealed count"
    let shown = 0, out = [];
    for(let i = 0; i < target.name.length; i++){
      const ch = target.name[i];
      if(ch === ' ' || ch === '-' || ch === ':'){ out.push(ch); continue; }
      if(shown < revealed){ out.push(ch); shown++; } else { out.push('_'); }
    }
    document.getElementById('hintDisplay').textContent = out.join('');
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

  function buildGrid(){
    let grid = 'Gazette - ' + c.label + '\n';
    cs.guesses.forEach(function(gName){
      const guessObj = c.pool.find(function(s){ return s.name === gName; });
      const line = c.fields.map(function(f){
        const cls = tileClass(f, guessObj[f.k], target[f.k]);
        return cls === 'hit' ? '\u{1F7E9}' : cls === 'near' ? '\u{1F7E8}' : '\u{1F7E5}';
      }).join('');
      grid += line + '\n';
    });
    grid += cs.won ? (cs.guesses.length + '/' + MAX_GUESSES) : ('X/' + MAX_GUESSES);
    return grid;
  }

  document.getElementById('shareBtn').addEventListener('click', function(){
    const grid = buildGrid();
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
        navigator.share({ text: buildGrid() }).catch(function(){});
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
}
