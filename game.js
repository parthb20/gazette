function initGame(key){
  const c = CATS[key];
  const cs = catState(key);
  const target = targetFor(key);
  track('puzzle_opened', { category:key });

  document.getElementById('gameCatName').textContent = c.label;
  document.getElementById('exampleHint').innerHTML = 'Type anything to get started — e.g. <b>"' + c.example + '"</b>';

  const input = document.getElementById('guessInput');
  const suggestBox = document.getElementById('suggestBox');
  const rows = document.getElementById('rows');
  const resultCard = document.getElementById('resultCard');
  const emailBox = document.getElementById('signupBox');
  input.placeholder = 'Type your guess... e.g. ' + c.example;

  if(isSignedUp() && emailBox) emailBox.style.display = 'none';

  function renderRow(guessName, num){
    const guessObj = c.pool.find(function(s){ return s.name === guessName; });
    const row = document.createElement('div');
    row.className = 'guess-row';
    const tilesHtml = c.fields.map(function(f){
      const gv = guessObj[f.k], tv = target[f.k];
      const cls = tileClass(f, gv, tv);
      let val = gv;
      if(f.t === 'n' && cls === 'miss'){
        val = gv + ' ' + (gv < tv ? '&#8593;' : '&#8595;');
      }
      return '<div class="stamp '+cls+'"><div class="val">'+val+'</div><div class="lab">'+f.l+'</div></div>';
    }).join('');
    row.innerHTML = '<div class="glabel"><span class="num">'+num+'</span>'+guessName+'</div><div class="tiles">'+tilesHtml+'</div>';
    rows.appendChild(row);
  }

  function finishUI(won){
    input.disabled = true;
    resultCard.style.display = 'block';
    if(won){
      resultCard.classList.remove('lost');
      document.getElementById('resultTitle').textContent = 'Solved in ' + cs.guesses.length + (cs.guesses.length>1 ? ' guesses' : ' guess');
      document.getElementById('resultBody').textContent = 'Today\u2019s ' + c.label.toLowerCase().replace(/s$/,'') + ' was ' + target.name + '.';
    } else {
      resultCard.classList.add('lost');
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
    document.getElementById('gnum').textContent = Math.min(cs.guesses.length, 6);

    const correct = name === target.name;
    track('guess_submitted', { category:key, guess_number: cs.guesses.length, correct: correct });

    if(correct){
      cs.done = true; cs.won = true;
      registerWinForStreak();
      finishUI(true);
      track('puzzle_solved', { category:key, guesses: cs.guesses.length });
    } else if(cs.guesses.length >= 6){
      cs.done = true; cs.won = false;
      finishUI(false);
      track('puzzle_failed', { category:key });
    }
    saveState(state);
  }

  input.addEventListener('input', function(){
    const q = input.value.trim().toLowerCase();
    suggestBox.innerHTML = '';
    if(!q){ suggestBox.style.display = 'none'; return; }
    const already = new Set(cs.guesses);
    const matches = c.pool.filter(function(s){ return s.name.toLowerCase().includes(q) && !already.has(s.name); }).slice(0,6);
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

  document.getElementById('shareBtn').addEventListener('click', function(){
    let grid = 'Gazette \u2014 ' + c.label + ' \u2014 Roll no. ' + String(DAY % 10000).padStart(4,'0') + '\n';
    cs.guesses.forEach(function(gName){
      const guessObj = c.pool.find(function(s){ return s.name === gName; });
      const line = c.fields.map(function(f){
        const cls = tileClass(f, guessObj[f.k], target[f.k]);
        return cls === 'hit' ? '\u{1F7E9}' : cls === 'near' ? '\u{1F7E8}' : '\u{1F7E5}';
      }).join('');
      grid += line + '\n';
    });
    grid += cs.won ? (cs.guesses.length + '/6') : 'X/6';
    track('share_copied', { category:key });

    function showFallback(){
      const box = document.getElementById('shareFallback');
      const ta = document.getElementById('shareFallbackText');
      ta.value = grid;
      box.style.display = 'block';
      ta.focus();
      ta.select();
    }
    function legacyCopy(){
      const ta = document.createElement('textarea');
      ta.value = grid;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      let ok = false;
      try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    const btn = document.getElementById('shareBtn');
    const old = btn.innerHTML;
    function copiedFeedback(){
      btn.innerHTML = 'Copied';
      setTimeout(function(){ btn.innerHTML = old; }, 1500);
    }

    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(grid).then(copiedFeedback).catch(function(){
        if(legacyCopy()) copiedFeedback(); else showFallback();
      });
    } else if(legacyCopy()){
      copiedFeedback();
    } else {
      showFallback();
    }
  });

  const emailBtn = document.getElementById('emailBtn');
  if(emailBtn){
    emailBtn.addEventListener('click', function(){
      const val = document.getElementById('emailInput').value.trim();
      if(!val || !val.includes('@')) return;
      captureEmail(val);
      emailBox.innerHTML = '<p>You\u2019re in \u2014 tomorrow\u2019s puzzle will follow this streak.</p>';
    });
  }

  // restore any progress made earlier today
  cs.guesses.forEach(function(gName, i){ renderRow(gName, i+1); });
  document.getElementById('gnum').textContent = Math.min(cs.guesses.length, 6);
  if(cs.done) finishUI(cs.won);

  renderStreakBadge();
}
