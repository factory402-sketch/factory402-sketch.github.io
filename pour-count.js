/* 푸어 횟수 바로 설정 — 상단 모드 탭 옆 스테퍼.
   실제 값은 레시피 설정 다이얼로그의 #pourCount 하나로만 관리하고,
   이 스테퍼는 그 값을 바꾼 뒤 change 이벤트로 기존 로직(물량·온도·타이머)을 그대로 깨웁니다. */
(() => {
  const select = document.getElementById('pourCount');
  const output = document.getElementById('pourCountValue');
  const minus = document.getElementById('pourCountMinus');
  const plus = document.getElementById('pourCountPlus');
  if (!select || !output || !minus || !plus) return;
  const steps = Array.from(select.options, option => Number(option.value)).filter(Number.isFinite);
  if (!steps.length) return;
  const text = n => n + '회';

  function sync() {
    const n = Number(select.value);
    const label = text(n);
    if (output.textContent !== label) output.textContent = label;
    const locked = select.disabled;
    minus.disabled = locked || !(n > steps[0]);
    plus.disabled = locked || !(n < steps[steps.length - 1]);
  }

  function step(direction) {
    if (select.disabled) return;
    const n = Number(select.value);
    const index = steps.indexOf(n);
    const next = steps[Math.min(steps.length - 1, Math.max(0, (index < 0 ? 0 : index) + direction))];
    if (next === n) return sync();
    select.value = String(next);
    select.dispatchEvent(new Event('change', {bubbles: true}));
    sync();
  }

  minus.addEventListener('click', () => step(-1));
  plus.addEventListener('click', () => step(1));
  select.addEventListener('change', sync);
  // 보관함에서 레시피를 적용하거나 타이머 잠금이 걸릴 때도 표시를 맞춥니다.
  new MutationObserver(sync).observe(select, {attributes: true, attributeFilter: ['disabled']});
  ['input', 'change', 'click'].forEach(type => document.addEventListener(type, sync));
  document.getElementById('reset')?.addEventListener('click', sync);
  sync();
})();
