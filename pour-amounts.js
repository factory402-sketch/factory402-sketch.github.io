const PourAmounts = (() => {
  const group = $('pourAmounts');
  const count = $('pourCount');
  function normalize(values, size) {
    if (!Array.isArray(values) || ![2, 3, 4, 5, 6, 10].includes(size)) return [];
    const amounts = Array.from({length: size}, (_, i) => {
      const value = values[i];
      return Number.isFinite(value) && value >= .01 && value <= 100000 &&
        Math.abs(value * 100 - Math.round(value * 100)) < 1e-8 ? value : null;
    });
    return amounts.some(value => value !== null) ? amounts : [];
  }
  function read() {
    return normalize(Array.from(group.querySelectorAll('input'), input => input.valueAsNumber), Number(count.value));
  }
  function complete(values) {
    return values.length > 0 && values.every(value => value !== null);
  }
  function sum(values) {
    return values.reduce((total, value) => total + Math.round((value ?? 0) * 100), 0) / 100;
  }
  function render(values) {
    group.replaceChildren(...Array.from({length: Number(count.value)}, (_, i) => {
      const label = document.createElement('label');
      label.textContent = i === 0 ? '1차 · 뜸 (g)' : (i + 1) + '차 (g)';
      const input = document.createElement('input');
      Object.assign(input, {type:'number', inputMode:'decimal', min:'.01', max:'100000', step:'.01', value:values?.[i] ?? ''});
      label.append(input);
      return label;
    }));
  }
  function sync() {
    const values = read();
    const total = sum(values), coffee = Number($('coffee').value);
    const fixed = complete(values) && total >= 1 && total <= 100000;
    $('second').readOnly = fixed;
    $('secondPresets').toggleAttribute('inert', fixed);
    if (!fixed) return;
    water = total;
    if (coffee > 0 && coffee <= 100000) target = total / coffee;
    $('second').value = mode === 'ratio' ? water : target;
    update();
  }
  function resolve(total, values) {
    if (Array.from(group.querySelectorAll('input')).some(input => !input.validity.valid)) return null;
    const remaining = Math.round(total * 100) - Math.round(sum(values) * 100);
    const blanks = values.filter(value => value === null).length;
    if (!values.length) return [];
    if (!blanks) return remaining === 0 && sum(values) >= 1 && sum(values) <= 100000 ? values : null;
    if (remaining < blanks) return null;
    let distributed = 0;
    return values.map(value => {
      if (value !== null) return value;
      const before = Math.round(remaining * distributed / blanks);
      distributed++;
      return (Math.round(remaining * distributed / blanks) - before) / 100;
    });
  }
  group.addEventListener('input', sync);
  // 푸어 횟수가 바뀌면 회차별 물량은 새 횟수 기준으로 다시 나눠야 하므로 비웁니다.
  // (예: 2회 40/260 g에서 3회로 늘리면 3차에 남은 물이 없어 합계가 맞지 않습니다.)
  count.addEventListener('change', () => { render(); sync(); });
  $('coffee').addEventListener('input', sync);
  $('coffeePresets').addEventListener('click', sync);
  $('ratioTab').addEventListener('click', sync);
  $('waterTab').addEventListener('click', sync);
  render();
  return {normalize, read, render, sync, resolve};
})();
