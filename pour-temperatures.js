const PourTemperatures = (() => {
  function normalize(values, count) {
    if (!Array.isArray(values) || ![3, 4, 5, 10].includes(count)) return [];
    const temperatures = Array.from({length: count}, (_, i) => {
      const value = values[i];
      return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
    });
    return temperatures.some(value => value !== null) ? temperatures : [];
  }
  const group = document.getElementById('pourTemperatures');
  const count = document.getElementById('pourCount');
  function read() {
    return normalize(Array.from(group.querySelectorAll('input'), input => input.valueAsNumber), Number(count.value));
  }
  function render(values) {
    const inputs = Array.from({length: Number(count.value)}, (_, index) => {
      const label = document.createElement('label');
      label.textContent = index === 0 ? '1차 · 뜸 (°C)' : (index + 1) + '차 (°C)';
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.min = '0';
      input.max = '100';
      input.step = 'any';
      input.value = values?.[index] ?? '';
      label.append(input);
      return label;
    });
    group.replaceChildren(...inputs);
  }
  count.addEventListener('change', () => render(read()));
  render();
  return {normalize, read, render};
})();
