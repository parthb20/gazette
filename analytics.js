/* ---------------------------------------------------------------
   ANALYTICS
   Works with zero backend today (events land in localStorage so
   you can inspect them via gazette_analytics_log). The moment you
   set ANALYTICS_ENDPOINT to a real URL, every event also gets
   POSTed there — see the note at the bottom of this file for the
   fastest way to stand that endpoint up.
------------------------------------------------------------------ */
const ANALYTICS_ENDPOINT = null; // e.g. 'https://your-project.supabase.co/functions/v1/track'

function getAnonId(){
  let id = localStorage.getItem('gazette_anon_id');
  if(!id){
    id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('gazette_anon_id', id);
  }
  return id;
}
function isSignedUp(){ return !!localStorage.getItem('gazette_email'); }

function track(event, props){
  const payload = Object.assign({
    event: event,
    anon_id: getAnonId(),
    signed_up: isSignedUp(),
    email: isSignedUp() ? localStorage.getItem('gazette_email') : null,
    day: (typeof DAY !== 'undefined' ? DAY : null),
    ts: new Date().toISOString()
  }, props || {});

  const log = JSON.parse(localStorage.getItem('gazette_analytics_log') || '[]');
  log.push(payload);
  localStorage.setItem('gazette_analytics_log', JSON.stringify(log.slice(-300)));

  if(ANALYTICS_ENDPOINT){
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(){});
  }
}

function captureEmail(email){
  localStorage.setItem('gazette_email', email);
  track('email_captured', { email: email });
}

/*
  FASTEST WAYS TO GET A REAL ANALYTICS_ENDPOINT:
  1. Supabase (recommended): create a free project, add a "events" table
     (event text, anon_id text, signed_up bool, email text, day int, ts timestamptz),
     write a one-line Edge Function that inserts the JSON body into it,
     paste that function's URL above. Query the table any time to see
     signed-up vs anonymous activity side by side.
  2. Google Apps Script + Sheet: fastest zero-cost option if you'd rather
     see events land directly in a spreadsheet. Create a Sheet, add an
     Apps Script "doPost" that appends e.data to a row, deploy as a Web
     App, paste the deployed URL above.
*/
