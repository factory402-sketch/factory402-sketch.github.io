// The browser identifier rotates at midnight in Seoul.
(() => {
  const storageKey = 'cafeleeu.daily-browser.v1';
  let fallback;
  function identity(day) {
    try {
      const previous = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (previous?.day === day && previous.id) return previous.id;
      const entry = {day, id: crypto.randomUUID()};
      localStorage.setItem(storageKey, JSON.stringify(entry));
      return entry.id;
    } catch {
      if (fallback?.day !== day) fallback = {day, id: crypto.randomUUID()};
      return fallback.id;
    }
  }
  async function record(event) {
    if (document.visibilityState !== 'visible') return;
    try {
      const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0,10);
      const id = identity(day);
      if (sessionStorage.getItem(storageKey + event) === id) return;
      const response = await fetch('/api/usage', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({event, id}), keepalive:true});
      if (response.ok) sessionStorage.setItem(storageKey + event, id);
    } catch { /* Counting must never interrupt brewing. */ }
  }
  window.recordFeature = event => {
    try {
      const body=JSON.stringify({event,id:crypto.randomUUID()});
      if(navigator.sendBeacon?.('/api/usage',new Blob([body],{type:'application/json'}))) return;
      fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
    } catch { /* Analytics must not delay an action. */ }
  };
  window.recordBrewStart = () => {record('brew');window.recordFeature('brew_start');};
  const dialogs={grindDialog:'grind_open',settingsDialog:'settings',recipeDialog:'steps',audioDialog:'audio',favoritesDialog:'library',newsDialog:'news',helpDialog:'help',installDialog:'install',beansDialog:'beans'};
  const actions={guideStart:'guide',grindCamera:'camera',copy:'copy',testSound:'sound_test',sendQR:'qr_send',downloadQR:'qr_download',printQR:'qr_print'};
  function clicked(e){
    if(e.type==='auxclick' && e.button!==1)return;
    const target=e.target.closest('a,button,input');
    if(!target)return;
    let event=dialogs[target.dataset.open]||actions[target.id];
    if(target.matches('.water-pick a'))event='ad_water';
    if(target.matches('.ad-contact'))event='ad_contact';
    if(target.matches('.store-link'))event='store';
    if(target.closest('.presets'))event=mode==='ratio'?'ratio':'water';
    if(event)window.recordFeature(event);
  }
  document.addEventListener('click',clicked,true);
  document.addEventListener('auxclick',clicked,true);
  document.addEventListener('change',e=>{
    if(e.target.id==='grindFile' && e.target.files.length)window.recordFeature('upload');
    if(['coffee','second'].includes(e.target.id) && !document.getElementById('copy').disabled)window.recordFeature(mode==='ratio'?'ratio':'water');
  });
  window.addEventListener('pageshow', () => record('visit'));
  document.addEventListener('visibilitychange', () => record('visit'));
  setInterval(() => record('visit'), 60000);
})();
