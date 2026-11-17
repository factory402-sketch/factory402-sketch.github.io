// 방문·기능 이용 통계를 Google Apps Script 웹 앱(카페이유 추출 도우미 이용 통계)으로 보냅니다.
// 브라우저 식별자는 한국 시간 자정에 새로 만들어지고, 하루 동안 같은 브라우저는 한 번만 집계됩니다.
(() => {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbz8Jac2dwNcuvRgb37x5Q5om7KePl0lIU03tNuXHvKexcI1jrmCIkC9lNQ831GicPnlGg/exec';
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

  // 통계 전송은 어떤 경우에도 화면 동작을 막지 않습니다.
  function send(payload) {
    const body = JSON.stringify(payload);
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body,
        keepalive: true
      }).catch(() => {});
      return true;
    } catch { /* 아래 sendBeacon으로 재시도합니다. */ }
    try {
      return !!navigator.sendBeacon?.(ENDPOINT, new Blob([body], {type: 'text/plain;charset=utf-8'}));
    } catch { return false; }
  }

  function record(event) {
    if (document.visibilityState !== 'visible') return;
    try {
      const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const id = identity(day);
      if (sessionStorage.getItem(storageKey + event) === id) return;
      if (send({event, id})) sessionStorage.setItem(storageKey + event, id);
    } catch { /* Counting must never interrupt brewing. */ }
  }

  window.recordFeature = event => {
    try { send({event, id: crypto.randomUUID()}); } catch { /* Analytics must not delay an action. */ }
  };
  window.recordBrewStart = () => {record('brew'); window.recordFeature('brew_start');};

  const dialogs = {grindDialog: 'grind_open', settingsDialog: 'settings', recipeDialog: 'steps', audioDialog: 'audio', favoritesDialog: 'library', newsDialog: 'news', helpDialog: 'help', installDialog: 'install', beansDialog: 'beans', shopDialog: 'shop'};
  const actions = {guideStart: 'guide', grindCamera: 'camera', copy: 'copy', testSound: 'sound_test', sendQR: 'qr_send', downloadQR: 'qr_download', printQR: 'qr_print'};
  function clicked(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const target = e.target.closest('a,button,input');
    if (!target) return;
    let event = dialogs[target.dataset.open] || actions[target.id];
    if (target.matches('.water-pick a')) event = 'ad_water';
    if (target.matches('.ad-contact')) event = 'ad_contact';
    if (target.matches('.store-link')) event = 'store';
    if (target.closest('.presets')) event = mode === 'ratio' ? 'ratio' : 'water';
    if (event) window.recordFeature(event);
  }
  document.addEventListener('click', clicked, true);
  document.addEventListener('auxclick', clicked, true);
  document.addEventListener('change', e => {
    if (e.target.id === 'grindFile' && e.target.files.length) window.recordFeature('upload');
    if (['coffee', 'second'].includes(e.target.id) && !document.getElementById('copy').disabled) window.recordFeature(mode === 'ratio' ? 'ratio' : 'water');
  });
  window.addEventListener('pageshow', () => record('visit'));
  document.addEventListener('visibilitychange', () => record('visit'));
  setInterval(() => record('visit'), 60000);
})();
