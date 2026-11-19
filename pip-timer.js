/* ==========================================================================
   카페이유 · 추출 도우미 — 추출 타이머 작은 창(PiP)  v3.9
   --------------------------------------------------------------------------
   · 오프스크린 Canvas(480×270, ☕ 에스프레소 & 오트)에 실시간 추출 상태를 그린다.
     경과 시간 · 현재 푸어 단계 · 목표 누적 물량 · 다음 푸어 카운트다운.
   · PC 크롬처럼 Document PiP 를 지원하면 작은 HTML 타이머 창을 띄운다.
     (창을 클릭하면 본 화면으로 돌아오고 작은 창은 닫힌다)
   · 모바일 Safari / Android Chrome: canvas.captureStream(5) → <video> → PiP.
     Safari 는 소리 트랙이 있어야 PiP 버튼이 열리므로 무음 트랙을 붙인다.
   · 인앱 브라우저 등 미지원 환경에서는 안내 문구만 띄우고 본 화면은 그대로 둔다.
   · iOS 홈 화면 웹앱(standalone)은 iOS 정책상 PiP 자체가 열리지 않으므로,
     «홈 화면에 설치한 뒤»를 권하지 않고 Safari 로 여는 방법을 안내한다.
     그 안내에는 「Safari에서 열기」(지금 레시피 그대로)와 「주소 복사」 버튼을 함께 둔다.
   · iOS standalone 에서 같은 주소의 링크(target=_blank)는 앱 안의 브라우저로 열려 PiP 를
     쓸 수 없으므로, 「Safari에서 열기」는 iOS 17+ 의 x-safari- 스킴으로 Safari 를 연다.
   · PiP 는 화면만 복제한다 — 본 화면의 타이머 상태는 건드리지 않으므로
     PiP 를 닫으면(lavepictureinpicture) 그대로 이어진다.
   ========================================================================== */
(() => {
  'use strict';

  const btn = document.getElementById('pipTimer');
  const note = document.getElementById('pipStatus');
  if (!btn) return;

  const W = 480, H = 270;
  const FAMILY = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';
  const font = (weight, size) => weight + ' ' + size + 'px ' + FAMILY;
  const C = {
    cream: '#FBF3E9',
    soft: '#D9C4B4',
    faint: 'rgba(217,196,180,.72)',
    amber: '#E4B489',
    dial: '#F4D0A6',
    gold: '#C87A44',
    track: '#56362B',
    passed: '#A8744C',
  };

  /* ---------- 도우미 ---------------------------------------------------- */
  function letter(ctx, value) {
    try { ctx.letterSpacing = value; } catch (e) { /* 미지원 브라우저 */ }
  }
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function clockStr(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function num(value) {
    if (value == null || !isFinite(value)) return '—';
    const rounded = Math.round(value * 10) / 10;
    return String(rounded);
  }
  // 글자가 정해진 폭을 넘으면 폰트를 줄여 한 줄에 맞춘다.
  function fit(ctx, text, max, weight, size) {
    let s = size;
    for (;;) {
      ctx.font = font(weight, s);
      if (ctx.measureText(text).width <= max || s <= 8) return s;
      s -= 0.5;
    }
  }
  function fitText(ctx, text, max, weight, size) {
    const s = fit(ctx, text, max, weight, size);
    ctx.font = font(weight, s);
    return s;
  }

  /* ---------- 상태 ------------------------------------------------------ */
  function fallbackState() {
    const text = id => (document.getElementById(id)?.textContent || '').trim();
    const parts = text('clock').split(':');
    const elapsed = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : 0;
    const round = text('brewRound').match(/(\d+)\s*\/\s*(\d+)/);
    const rows = document.querySelectorAll('#recipe li[data-step]');
    const total = rows.length ? Number((rows[rows.length - 1].querySelector('.amount')?.textContent || '').replace(/[^\d.]/g, '')) : 0;
    const stage = round ? Number(round[1]) - 1 : -1;
    return {
      status: text('start') === '일시정지' ? 'running' : 'idle',
      elapsed, finish: 0, stages: round ? Number(round[2]) : 0, stage,
      cue: text('cue'), pour: null, target: 0, total, coffee: 0, ratio: null,
      temperature: null, nextIn: null, nextLabel: null, perPour: [],
    };
  }
  function currentState() {
    const snap = window.brewTimerSnapshot;
    if (snap && typeof snap === 'object' && 'stages' in snap) return snap;
    if (typeof window.getBrewTimerSnapshot === 'function') {
      try { return window.getBrewTimerSnapshot(); } catch (e) { /* 아래 fallback */ }
    }
    return fallbackState();
  }
  function stateKey(s) {
    return [
      s.status, Math.floor(s.elapsed || 0), s.stage, s.stages,
      Math.round((s.pour || 0) * 10), Math.round((s.target || 0) * 10), Math.round((s.total || 0) * 10),
      s.nextIn == null ? '' : Math.ceil(s.nextIn), s.temperature == null ? '' : s.temperature,
    ].join('|');
  }

  /* ---------- 캔버스 (480×270, 에스프레소 & 오트) ----------------------- */
  function draw(ctx, s) {
    const idle = s.status === 'idle' || !s.stages;
    const done = s.status === 'done';
    const stages = Math.max(1, s.stages || 0);
    const active = idle ? -1 : (s.stage == null ? -1 : s.stage);
    const total = s.total || 0;
    const target = s.target || 0;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 바탕 + 앰버 글로우
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#4C3126');
    bg.addColorStop(.55, '#3A261E');
    bg.addColorStop(1, '#20110D');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    let glow = ctx.createRadialGradient(W * .88, -30, 8, W * .88, -30, 260);
    glow.addColorStop(0, 'rgba(236,176,122,.34)');
    glow.addColorStop(1, 'rgba(236,176,122,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    glow = ctx.createRadialGradient(-10, H + 12, 6, -10, H + 12, 220);
    glow.addColorStop(0, 'rgba(255,238,214,.13)');
    glow.addColorStop(1, 'rgba(255,238,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 머리글
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    letter(ctx, '1.1px');
    ctx.font = font(700, 10.5);
    ctx.fillStyle = C.faint;
    ctx.fillText('카페이유 · 추출 타이머', 22, 25);
    letter(ctx, '0px');

    // 상태 배지
    const label = done ? '추출 완료' : s.status === 'running' ? '추출 중' : s.status === 'paused' ? '일시정지' : '준비';
    ctx.font = font(700, 11);
    const bw = ctx.measureText(label).width + 22, bh = 21, bx = W - 22 - bw, by = 14;
    roundRect(ctx, bx, by, bw, bh, 10.5);
    ctx.fillStyle = s.status === 'running' ? 'rgba(244,208,166,.20)' : 'rgba(255,243,225,.09)';
    ctx.fill();
    ctx.strokeStyle = s.status === 'running' ? 'rgba(244,208,166,.55)' : 'rgba(255,243,225,.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = s.status === 'running' ? C.dial : C.soft;
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + .5);

    // 푸어 링
    const cx = 104, cy = 150, r = 60, lw = 12;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    const seg = (Math.PI * 2) / stages;
    const gap = Math.min(0.09, seg * 0.14);
    for (let i = 0; i < stages; i++) {
      const a0 = -Math.PI / 2 + i * seg + gap / 2;
      const a1 = a0 + seg - gap;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      const isActive = i === active;
      ctx.strokeStyle = i < active ? C.passed : isActive ? C.dial : C.track;
      if (isActive) {
        ctx.save();
        ctx.shadowColor = 'rgba(244,208,166,.55)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }
    }

    // 가운데: 경과 시간 · 푸어 단계
    ctx.textAlign = 'center';
    const clockText = clockStr(done ? s.finish : s.elapsed);
    fitText(ctx, clockText, 110, 750, 40);
    ctx.fillStyle = C.cream;
    ctx.fillText(clockText, cx, cy - 6);
    const stageText = idle ? stages + '회 푸어' : (Math.min(stages, Math.max(1, active + 1))) + ' / ' + stages + ' 푸어';
    ctx.font = font(700, 11.5);
    ctx.fillStyle = idle ? C.faint : C.soft;
    ctx.fillText(stageText, cx, cy + 24);

    // 오른쪽 열
    const left = 192, max = W - 22 - left;
    ctx.textAlign = 'left';
    letter(ctx, '.9px');
    ctx.font = font(700, 9.5);
    ctx.fillStyle = 'rgba(228,180,137,.9)';
    ctx.fillText(idle ? '레시피 요약' : done ? '마무리' : s.status === 'paused' ? '일시정지됨' : '지금 단계', left, 62);
    letter(ctx, '0px');

    fitText(ctx, s.cue || '추출 준비', max, 750, 23);
    ctx.fillStyle = C.cream;
    ctx.fillText(s.cue || '추출 준비', left, 92);

    // 큰 숫자 — 추출 중에는 이번에 부을 양, 준비 상태에는 레시피 요약
    if (idle) {
      const summary = (s.coffee ? num(s.coffee) + ' g → ' : '') + num(total) + ' g' + (s.ratio ? ' · 1:' + (Math.round(s.ratio * 10) / 10) : '');
      fitText(ctx, summary, max, 750, 24);
      ctx.fillStyle = C.dial;
      ctx.fillText(summary, left, 122);
    } else {
      const amount = done ? '추출 완료' : '+' + num(s.pour) + ' g';
      fitText(ctx, amount, max, 750, 27);
      ctx.fillStyle = done ? C.amber : C.dial;
      ctx.fillText(amount, left, 122);
    }

    // 목표 누적 물량
    const targetText = idle
      ? stages + '회 푸어 · 예상 ' + clockStr(s.finish)
      : '목표 누적 ' + num(target) + ' / ' + num(total) + ' g';
    fitText(ctx, targetText, max, 650, 12.5);
    ctx.fillStyle = C.soft;
    ctx.fillText(targetText, left, 148);

    // 누적 진행 바
    const barW = Math.min(max, 268), barY = 163, barH = 7;
    roundRect(ctx, left, barY, barW, barH, 3.5);
    ctx.fillStyle = 'rgba(255,243,225,.14)';
    ctx.fill();
    const frac = idle ? 0 : Math.max(0, Math.min(1, total > 0 ? target / total : 0));
    if (frac > 0) {
      roundRect(ctx, left, barY, Math.max(3, barW * frac), barH, 3.5);
      const g2 = ctx.createLinearGradient(left, 0, left + barW, 0);
      g2.addColorStop(0, C.gold);
      g2.addColorStop(1, C.dial);
      ctx.fillStyle = g2;
      ctx.fill();
    }

    // 다음 안내
    const nextText = idle
      ? '추출 시작을 누르면 여기서 실시간으로 보여요'
      : done
        ? '물 빠짐을 확인하고 드리퍼를 제거하세요'
        : (s.nextLabel || '다음 푸어까지') + ' ' + Math.ceil(Math.max(0, s.nextIn || 0)) + '초';
    fitText(ctx, nextText, max, 700, 12.5);
    ctx.fillStyle = idle ? C.faint : C.amber;
    ctx.fillText(nextText, left, 192);

    if (!idle && !done && s.temperature != null) {
      fitText(ctx, '물 온도 ' + num(s.temperature) + ' °C', max, 650, 11);
      ctx.fillStyle = C.faint;
      ctx.fillText('물 온도 ' + num(s.temperature) + ' °C', left, 212);
    }

    // 바닥
    ctx.font = font(600, 9);
    ctx.fillStyle = 'rgba(217,196,180,.55)';
    ctx.fillText('cafe.leeu 추출 도우미 · v3.9', 22, 250);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(217,196,180,.5)';
    ctx.fillText(idle ? '준비' : done ? '완료' : '작은 창', W - 22, 250);

    ctx.restore();
  }

  /* ---------- 안내 문구 ------------------------------------------------- */
  const SITE_ROOT = 'https://factory402-sketch.github.io/';
  let noteTimer = null;
  let noteInteractive = false;
  let noteShownAt = 0;

  // 지금 보고 있는 주소(레시피 #recipe=… 포함). 배포 주소가 아니면 기본 주소로.
  function pageUrl() {
    try {
      if (/^https?:$/.test(location.protocol) && location.href) return location.href;
    } catch (e) { /* 주소를 못 읽는 환경 */ }
    return SITE_ROOT;
  }
  // iOS standalone 에서는 같은 주소의 링크를 눌러도 앱 안의 브라우저가 열린다(PiP 불가).
  // iOS 17+ 에서는 x-safari- 스킴이 Safari 앱을 열어 준다.
  function safariUrl(url) {
    return isIos() ? 'x-safari-' + url : url;
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* 아래 textarea 방식으로 */ }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
    document.body.appendChild(area);
    try {
      area.select();
      area.setSelectionRange(0, area.value.length);
      return document.execCommand('copy') !== false;
    } catch (e) {
      return false;
    } finally {
      area.remove();
    }
  }
  function buildActions() {
    const url = pageUrl();
    const row = document.createElement('div');
    row.className = 'pip-status-actions';

    const safari = document.createElement('a');
    safari.className = 'pip-status-btn primary';
    safari.href = safariUrl(url);
    safari.dataset.url = url;
    safari.target = '_blank';
    safari.rel = 'noopener noreferrer';
    safari.textContent = 'Safari에서 열기';
    row.appendChild(safari);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'pip-status-btn';
    copy.textContent = '주소 복사';
    copy.addEventListener('click', async () => {
      const ok = await copyText(url);
      copy.textContent = ok ? '복사됨 ✓' : '복사 실패';
      copy.classList.toggle('is-done', ok);
      clearTimeout(copy.copiedTimer);
      copy.copiedTimer = setTimeout(() => {
        copy.textContent = '주소 복사';
        copy.classList.remove('is-done');
      }, 2000);
    });
    row.appendChild(copy);
    return row;
  }
  function showNote(message, options) {
    if (!note) return;
    const actions = !!(options && options.actions);
    note.textContent = '';
    const text = document.createElement('span');
    text.className = 'pip-status-msg';
    text.textContent = message;
    note.appendChild(text);
    if (actions) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pip-status-close';
      close.setAttribute('aria-label', '안내 닫기');
      close.textContent = '×';
      close.addEventListener('click', hideNote);
      note.appendChild(close);
      note.appendChild(buildActions());
    }
    note.dataset.actions = actions ? 'true' : 'false';
    note.hidden = false;
    noteInteractive = actions;
    noteShownAt = Date.now();
    clearTimeout(noteTimer);
    // 버튼이 있는 안내는 사용자가 닫을 때까지 둔다. 버튼이 없으면 예전처럼 9초.
    if (!actions) noteTimer = setTimeout(hideNote, 9000);
  }
  function hideNote() {
    if (!note) return;
    note.hidden = true;
    noteInteractive = false;
    clearTimeout(noteTimer);
  }
  // 버튼이 있는 안내는 바깥을 누르거나 Esc 로도 닫힌다 (연 그 클릭은 무시).
  document.addEventListener('click', event => {
    if (!note || note.hidden || !noteInteractive) return;
    if (Date.now() - noteShownAt < 250) return;
    if (note.contains(event.target)) return;
    hideNote();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideNote();
  });
  function inAppName() {
    const ua = navigator.userAgent;
    if (/KAKAOTALK/i.test(ua)) return '카카오톡';
    if (/Instagram|FBAN|FBAV|FB_IAB/i.test(ua)) return '인스타그램·페이스북';
    if (/NAVER\(inapp/i.test(ua)) return '네이버 앱';
    if (/Line\//i.test(ua)) return '라인';
    if (/everytimeApp/i.test(ua)) return '에브리타임';
    return '앱 안의 브라우저';
  }
  function isInApp() {
    return /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|everytimeApp/i.test(navigator.userAgent);
  }
  function isIos() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  // 홈 화면에 설치한 웹앱(standalone)인지 — iOS 는 이 컨테이너에서 PiP 를 막는다.
  function isStandalone() {
    try {
      if (window.navigator.standalone === true) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* 판별 불가 */ }
    return false;
  }
  function isIosStandalone() {
    return isIos() && isStandalone();
  }
  const TEXT_IOS_STANDALONE =
    '아이폰 홈 화면 웹앱에서는 iOS 정책상 작은 창(PiP)이 지원되지 않아요. Safari 브라우저에서 열면 사용할 수 있으며, 타이머는 이 화면에서 그대로 이어집니다.';
  const TEXT_UNSUPPORTED =
    '이 브라우저에서는 작은 창(PiP)을 지원하지 않아요. Safari나 Chrome에서 열어 주세요. 타이머는 이 화면에서 그대로 이어집니다.';
  const TEXT_INAPP =
    () => inAppName() + ' 안에서는 작은 창을 열 수 없어요. 오른쪽 위 ··· → "다른 브라우저로 열기"(Safari·Chrome)로 연 뒤 다시 눌러 주세요.';
  const TEXT_PLAY =
    '영상 재생이 막혀 작은 창을 열지 못했어요. 한 번 더 누르거나, 화면을 켜 둔 채 이 화면에서 계속 사용해 주세요.';

  /* ---------- PiP 열림 상태 표시 --------------------------------------- */
  function mark(active) {
    btn.dataset.active = active ? 'true' : 'false';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.title = active ? '작은 창 닫기' : '작은 창(PiP)으로 띄우기';
  }

  /* ---------- ① Document PiP (PC 크롬 등) ------------------------------ */
  let htmlPip = null;

  function pipStyles() {
    return `
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; }
      body {
        background: radial-gradient(120% 90% at 88% -15%, rgba(236,176,122,.34), rgba(236,176,122,0) 60%),
                    radial-gradient(90% 80% at -10% 110%, rgba(255,238,214,.12), rgba(255,238,214,0) 62%),
                    linear-gradient(158deg, #4C3126 0%, #3A261E 46%, #20110D 100%);
        color: #FBF3E9;
        font-family: ${FAMILY};
        cursor: pointer;
        user-select: none;
        overflow: hidden;
      }
      .pip { height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 12px 15px 10px; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10.5px; }
      .brand { color: rgba(217,196,180,.86); font-weight: 700; letter-spacing: .11em; }
      .pill { padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(255,243,225,.24); color: #D9C4B4; font-weight: 700; }
      .pill[data-state="running"] { border-color: rgba(244,208,166,.55); background: rgba(244,208,166,.18); color: #F4D0A6; }
      .pill[data-state="done"] { border-color: rgba(244,208,166,.55); background: rgba(244,208,166,.22); color: #F4D0A6; }
      .body { flex: 1 1 auto; display: flex; align-items: center; gap: 14px; min-height: 0; }
      .dial { --p: 0; position: relative; flex: none; width: 112px; height: 112px; border-radius: 50%;
        background: conic-gradient(#F4D0A6 calc(var(--p) * 1turn), #56362B 0); display: grid; place-items: center; }
      .dial::after { content: ''; position: absolute; inset: 12px; border-radius: 50%; background: #3A261E; }
      .dial-in { position: relative; z-index: 1; display: grid; justify-items: center; gap: 1px; }
      #clock { font-size: 34px; font-weight: 750; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
      #round { font-size: 10.5px; font-weight: 700; color: #D9C4B4; font-variant-numeric: tabular-nums; }
      .info { min-width: 0; flex: 1 1 auto; display: grid; gap: 2px; }
      #cap { font-size: 9.5px; font-weight: 700; letter-spacing: .09em; color: rgba(228,180,137,.9); }
      #cue { font-size: 21px; font-weight: 750; letter-spacing: -.01em; line-height: 1.2; word-break: keep-all; }
      #amount { font-style: normal; font-size: 24px; font-weight: 750; color: #F4D0A6; font-variant-numeric: tabular-nums; line-height: 1.15; }
      #target { font-size: 11.5px; color: #D9C4B4; font-variant-numeric: tabular-nums; }
      .bar { height: 6px; margin: 3px 0 1px; border-radius: 3px; background: rgba(255,243,225,.14); overflow: hidden; }
      .bar i { display: block; height: 100%; width: 0; border-radius: 3px; background: linear-gradient(90deg, #C87A44, #F4D0A6); transition: width .25s linear; }
      #nextline { font-size: 11.5px; font-weight: 650; color: #E4B489; font-variant-numeric: tabular-nums; word-break: keep-all; }
      .foot { display: flex; justify-content: space-between; gap: 8px; font-size: 9px; color: rgba(217,196,180,.55); }
      @media (max-height: 210px) {
        .pip { gap: 4px; padding: 8px 12px 7px; }
        .dial { width: 86px; height: 86px; }
        .dial::after { inset: 9px; }
        #clock { font-size: 26px; }
        #cue { font-size: 17px; }
        #amount { font-size: 19px; }
        .foot { display: none; }
      }`;
  }

  function buildPipDocument(pipWindow) {
    const doc = pipWindow.document;
    doc.title = '카페이유 · 추출 타이머';
    const style = doc.createElement('style');
    style.textContent = pipStyles();
    doc.head.appendChild(style);
    doc.body.innerHTML =
      '<div class="pip">' +
        '<div class="top"><span class="brand">카페이유 · 추출 타이머</span><span class="pill" id="pill">준비</span></div>' +
        '<div class="body">' +
          '<div class="dial" id="dial"><div class="dial-in"><b id="clock">00:00</b><span id="round">— / — 푸어</span></div></div>' +
          '<div class="info">' +
            '<span id="cap">레시피 요약</span>' +
            '<b id="cue">추출 준비</b>' +
            '<em id="amount">—</em>' +
            '<span id="target">—</span>' +
            '<div class="bar"><i id="fill"></i></div>' +
            '<span id="nextline">추출 시작을 누르면 실시간으로 갱신돼요</span>' +
          '</div>' +
        '</div>' +
        '<div class="foot"><span>클릭하면 본 화면으로 돌아갑니다</span><span>v3.9</span></div>' +
      '</div>';
    const q = id => doc.getElementById(id);
    return { doc, dial: q('dial'), pill: q('pill'), clock: q('clock'), round: q('round'), cap: q('cap'), cue: q('cue'), amount: q('amount'), target: q('target'), fill: q('fill'), nextline: q('nextline') };
  }

  function updateHtml(refs, s) {
    const idle = s.status === 'idle' || !s.stages;
    const done = s.status === 'done';
    const stages = Math.max(1, s.stages || 0);
    const total = s.total || 0;
    const target = s.target || 0;
    refs.clock.textContent = clockStr(done ? s.finish : s.elapsed);
    refs.round.textContent = idle ? stages + '회 푸어'
      : (Math.min(stages, Math.max(1, (s.stage || 0) + 1))) + ' / ' + stages + ' 푸어';
    refs.pill.textContent = done ? '추출 완료' : s.status === 'running' ? '추출 중' : s.status === 'paused' ? '일시정지' : '준비';
    refs.pill.dataset.state = done ? 'done' : s.status;
    refs.cap.textContent = idle ? '레시피 요약' : done ? '마무리' : s.status === 'paused' ? '일시정지됨' : '지금 단계';
    refs.cue.textContent = s.cue || '추출 준비';
    refs.amount.textContent = idle
      ? (s.coffee ? num(s.coffee) + ' g → ' : '') + num(total) + ' g' + (s.ratio ? ' · 1:' + (Math.round(s.ratio * 10) / 10) : '')
      : done ? '추출 완료' : '+' + num(s.pour) + ' g';
    refs.target.textContent = idle
      ? stages + '회 푸어 · 예상 ' + clockStr(s.finish)
      : '목표 누적 ' + num(target) + ' / ' + num(total) + ' g' + (s.temperature != null && !done ? ' · ' + num(s.temperature) + ' °C' : '');
    const frac = idle ? 0 : Math.max(0, Math.min(1, total > 0 ? target / total : 0));
    refs.fill.style.width = (frac * 100).toFixed(1) + '%';
    refs.nextline.textContent = idle
      ? '추출 시작을 누르면 실시간으로 갱신돼요'
      : done
        ? '물 빠짐을 확인하고 드리퍼를 제거하세요'
        : (s.nextLabel || '다음 푸어까지') + ' ' + Math.ceil(Math.max(0, s.nextIn || 0)) + '초';
    const elapsedFrac = s.finish > 0 ? Math.max(0, Math.min(1, (s.elapsed || 0) / s.finish)) : 0;
    refs.dial.style.setProperty('--p', done ? '1' : elapsedFrac.toFixed(3));
  }

  async function openHtmlPip() {
    const dp = window.documentPictureInPicture;
    if (!dp || typeof dp.requestWindow !== 'function') throw new Error('no documentPictureInPicture');
    let pipWindow;
    try {
      pipWindow = await dp.requestWindow({ width: 470, height: 286 });
    } catch (e) {
      try { pipWindow = await dp.requestWindow(); } catch (e2) { throw new Error('pip-window-blocked'); }
    }
    const refs = buildPipDocument(pipWindow);
    const tick = () => updateHtml(refs, currentState());
    tick();
    htmlPip = { pipWindow, refs, timer: setInterval(tick, 500) };
    const close = () => {
      if (htmlPip && htmlPip.pipWindow === pipWindow) { clearInterval(htmlPip.timer); htmlPip = null; }
      mark(false);
    };
    pipWindow.addEventListener('pagehide', close);
    pipWindow.addEventListener('unload', close);
    pipWindow.document.addEventListener('click', () => {
      try { window.focus(); } catch (e) { /* 무시 */ }
      try { pipWindow.close(); } catch (e) { /* 무시 */ }
      close();
    });
    mark(true);
    return htmlPip;
  }
  function closeHtmlPip() {
    if (!htmlPip) return;
    const { pipWindow, timer } = htmlPip;
    clearInterval(timer);
    htmlPip = null;
    try { pipWindow.close(); } catch (e) { /* 무시 */ }
    mark(false);
  }

  /* ---------- ② 영상 PiP (모바일 Safari · Android Chrome) -------------- */
  let videoPip = null;
  let audioCtx = null;

  function addSilentAudio(stream) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ac = new AC();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const dest = ac.createMediaStreamDestination();
      gain.gain.value = 0.0001; // Safari 는 소리 트랙이 있어야 PiP 로 띄울 수 있다
      osc.connect(gain);
      gain.connect(dest);
      try { osc.start(); } catch (e) { /* 무시 */ }
      const tracks = dest.stream.getAudioTracks();
      if (tracks.length) {
        tracks.forEach(t => { t.enabled = true; stream.addTrack(t); });
        audioCtx = ac;
        if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
        return;
      }
      ac.close && ac.close();
    } catch (e) { /* 소리 트랙 없이 계속 */ }
  }

  function ensureVideo() {
    if (videoPip) return videoPip;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-2d');
    if (!canvas.captureStream) throw new Error('no-capture-stream');
    const stream = canvas.captureStream(5);
    addSilentAudio(stream);
    const video = document.createElement('video');
    video.className = 'brew-pip-video';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.srcObject = stream;
    document.body.appendChild(video);
    videoPip = { canvas, ctx, video, stream, timer: null, key: '' };
    draw(ctx, currentState());
    return videoPip;
  }

  function startVideoLoop(vp) {
    stopVideoLoop(vp);
    const tick = () => {
      const s = currentState();
      const key = stateKey(s);
      if (key !== vp.key) { vp.key = key; draw(vp.ctx, s); }
    };
    tick();
    vp.timer = setInterval(tick, 250);
    vp.tick = tick;
  }
  function stopVideoLoop(vp) {
    if (vp && vp.timer) { clearInterval(vp.timer); vp.timer = null; }
  }
  function teardownVideo() {
    if (!videoPip) return;
    const { video, stream, timer } = videoPip;
    if (timer) clearInterval(timer);
    try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* 무시 */ }
    try { video.pause(); } catch (e) { /* 무시 */ }
    video.srcObject = null;
    video.remove();
    if (audioCtx) { try { audioCtx.close(); } catch (e) { /* 무시 */ } audioCtx = null; }
    videoPip = null;
    mark(false);
  }

  function tryWebkitPip(video) {
    if (typeof video.webkitSetPresentationMode !== 'function') return false;
    try {
      const supported = typeof video.webkitSupportsPresentationMode === 'function'
        ? video.webkitSupportsPresentationMode('picture-in-picture')
        : true;
      if (!supported) return false;
      video.webkitSetPresentationMode('picture-in-picture');
      return true;
    } catch (e) {
      return false;
    }
  }

  // 영상이 그려질 준비(readyState ≥ 2)를 기다린다 — Safari 는 준비 전 요청을 조용히 무시한다.
  function videoReady(video, timeout) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('canplay', finish);
        resolve();
      };
      const timer = setTimeout(finish, timeout || 1200);
      video.addEventListener('loadeddata', finish);
      video.addEventListener('canplay', finish);
    });
  }
  async function webkitPipWhenReady(video) {
    if (typeof video.webkitSetPresentationMode !== 'function') return false;
    await videoReady(video, 900);
    if (tryWebkitPip(video)) return true;
    if (video.readyState >= 2) {
      await new Promise(r => setTimeout(r, 180));
      if (tryWebkitPip(video)) return true;
    }
    return false;
  }

  async function openVideoPip() {
    const vp = ensureVideo();
    draw(vp.ctx, currentState());
    const listen = () => {
      vp.video.addEventListener('enterpictureinpicture', () => startVideoLoop(vp), { once: true });
      vp.video.addEventListener('leavepictureinpicture', () => { stopVideoLoop(vp); teardownVideo(); }, { once: true });
    };
    listen();
    let playResult = null;
    try { playResult = vp.video.play(); } catch (e) { playResult = Promise.reject(e); }
    const playSettled = Promise.resolve(playResult).catch(() => {});
    const playStarted = Promise.race([playSettled, new Promise(r => setTimeout(r, 700))]);

    if (document.pictureInPictureEnabled && typeof vp.video.requestPictureInPicture === 'function') {
      try {
        await vp.video.requestPictureInPicture();
        startVideoLoop(vp);
        mark(true);
        return;
      } catch (error) {
        // Safari 는 재생이 시작된 뒤에 열어야 한다 (준비 전 요청은 조용히 실패).
        await playStarted;
        if (await webkitPipWhenReady(vp.video)) { startVideoLoop(vp); mark(true); return; }
        throw error;
      }
    }
    await playStarted;
    if (await webkitPipWhenReady(vp.video)) {
      startVideoLoop(vp);
      mark(true);
      return;
    }
    throw new Error('unsupported');
  }

  /* ---------- 클릭 ------------------------------------------------------ */
  let busy = false;
  async function onOpen(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (busy) return;
    busy = true;
    // 버튼이 있는 안내가 떠 있으면 「작은 창」을 다시 누르는 것으로 닫는다.
    if (note && !note.hidden && noteInteractive) { hideNote(); busy = false; return; }
    hideNote();
    try {
      if (htmlPip) { closeHtmlPip(); return; }
      // iOS 홈 화면 웹앱은 iOS 정책상 PiP 가 열리지 않는다 — 설치를 권하지 않고 이유를 짚어 준다.
      if (isIosStandalone() && !document.pictureInPictureElement) {
        showNote(TEXT_IOS_STANDALONE, { actions: true });
        return;
      }
      if (document.pictureInPictureElement) {
        try { await document.exitPictureInPicture(); } catch (e) { /* 무시 */ }
        teardownVideo();
        return;
      }
      const forced = window.__pipForceMode;
      if (forced !== 'video' && 'documentPictureInPicture' in window) {
        try { await openHtmlPip(); return; } catch (e) { /* 영상 PiP 로 넘어간다 */ }
      }
      try {
        await openVideoPip();
      } catch (error) {
        teardownVideo();
        if (isIosStandalone()) showNote(TEXT_IOS_STANDALONE, { actions: true });
        else if (isInApp()) showNote(TEXT_INAPP());
        else if (error && (error.name === 'NotSupportedError' || error.name === 'NotAllowedError')) showNote(TEXT_PLAY);
        else showNote(TEXT_UNSUPPORTED);
      }
    } finally {
      busy = false;
    }
  }
  btn.addEventListener('click', onOpen);

  /* 상태가 바뀌면 즉시 다시 그린다 (1초 폴링과 별개로 바로 반영) */
  window.addEventListener('brewtimer', () => {
    if (videoPip && videoPip.tick) videoPip.tick();
    if (htmlPip) updateHtml(htmlPip.refs, currentState());
  });

  /* 화면이 다시 보일 때(다른 앱에서 돌아옴) 상태를 한 번 맞춘다 */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (videoPip && videoPip.tick) videoPip.tick();
    if (htmlPip) updateHtml(htmlPip.refs, currentState());
  });

  /* ---------- 테스트 · 미리보기용 --------------------------------------- */
  let debugCanvas = null;
  window.brewPip = {
    state: currentState,
    supported() {
      const probe = document.createElement('video');
      return {
        html: 'documentPictureInPicture' in window,
        video: !!(document.pictureInPictureEnabled && probe.requestPictureInPicture) ||
          typeof probe.webkitSetPresentationMode === 'function',
        canvasStream: !!document.createElement('canvas').captureStream,
        inApp: isInApp(),
        ios: isIos(),
        standalone: isStandalone(),
        iosStandalone: isIosStandalone(),
      };
    },
    render(target) {
      const canvas = target || debugCanvas || (debugCanvas = document.createElement('canvas'));
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      draw(ctx, currentState());
      return canvas;
    },
    preview() {
      return window.brewPip.render().toDataURL('image/png');
    },
    note: showNote,
    open() { return onOpen(); },
    close() {
      if (htmlPip) closeHtmlPip();
      if (videoPip) teardownVideo();
    },
  };

  mark(false);
})();
