(() => {
  const storageKey = 'cafeleeu.favoriteRecipes.v1';
  const fields = ['coffee', 'second', 'pourCount', 'bloom', 'interval', 'drain'];
  const recipes = [
    {name:BrewProfiles.ultra.name, values:[...BrewProfiles.ultra.values], profile:'ultra'},
    {
      name:'하이플럭스 High Fast 필터',
      values:[15, 220, 5, 35, 25, 40],
      amounts:[30, 30, 30, 30, 100],
      temperatures:[92, 92, 92, 92, 92],
      memo:'High Fast(155) · 15 g 조금 굵게 · 91–92 ℃ · 플라스틱 드리퍼 · 린싱 60 ml. 30 g씩 4회, 마지막 100 g은 멜로드립이나 교반 적게. 30–40초 뜸 뒤엔 시간 재지 말고 물이 거의 다 빠지면 다음 물. 진하게 30·30·30·30·30·70(6회). 너무 진하면 바이패스 5–15 ml. 산미는 린싱 200 ml까지, 내추럴→코니컬·워시드→플랫바텀.',
      guide:'5차 100 g을 30 g·70 g으로 나눠 부으면 6회 진하게(30·30·30·30·30·70)가 됩니다. 바로 아래 「진하게 6회」 레시피를 적용하면 푸어 6회로 그대로 따라갈 수 있어요. 바이패스는 추출 후 컵에 물을 더하는 방식입니다.'
    },
    {
      name:'하이플럭스 High Fast · 진하게 6회',
      values:[15, 220, 6, 35, 25, 40],
      amounts:[30, 30, 30, 30, 30, 70],
      temperatures:[92, 92, 92, 92, 92, 92],
      memo:'High Fast(155) · 15 g 조금 굵게 · 91–92 ℃ · 플라스틱 드리퍼 · 린싱 60 ml. 진하게 30 g씩 5회, 마지막 70 g(6회). 30–40초 뜸 뒤엔 시간 재지 말고 물이 거의 다 빠지면 다음 물. 마지막 푸어는 멜로드립이나 교반 적게. 너무 진하면 바이패스 5–15 ml. 산미는 린싱 200 ml까지, 내추럴→코니컬·워시드→플랫바텀.',
      guide:'5회 기본(30·30·30·30·100)에서 30 g을 한 번 더 붓고 마지막을 70 g으로 줄인 진하게 버전입니다. 타이머·원형 다이얼이 6단계로 나옵니다.'
    },
    {name:'데일리 핸드드립', values:[20, 300, 5, 40, 30, 45]},
    {name:'가볍게 즐기는 한 잔', values:[15, 255, 3, 40, 35, 45]},
    {name:'조금 더 진한 한 잔', values:[15, 180, 3, 30, 30, 45]},
    {
      name:'소량 푸어오버 · 더블 블루밍 10 g',
      values:[10, 160, 4, 30, 30, 20],
      amounts:[20, 20, 70, 50],
      finishRange:'1:40–2:00'
    },
    {
      name:'소량 푸어오버 · 더블 블루밍 12 g',
      values:[12, 190, 4, 30, 30, 30],
      amounts:[25, 25, 85, 55],
      finishRange:'1:50–2:10'
    }
  ];
  function valid(recipe) {
    if (!recipe || typeof recipe.name !== 'string' || !recipe.name.trim() || !Array.isArray(recipe.values) || recipe.values.length !== fields.length) return false;
    const [coffee, water, count, bloom, interval, drain] = recipe.values;
    return coffee > 0 && coffee <= 100000 && water >= 1 && water <= 100000 &&
      recipe.values.every(Number.isFinite) && [2,3,4,5,6,10].includes(count) &&
      [bloom, interval].every(n => Number.isInteger(n) && n >= 10 && n <= 120) &&
      Number.isInteger(drain) && drain >= 15 && drain <= 180;
  }
  function saved() {
    try {
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(list) ? list.filter(valid) : [];
    } catch { return []; }
  }
  function message(text) { $('recipeStatus').textContent = text; }
  function write(list, feedback) {
    try { localStorage.setItem(storageKey, JSON.stringify(list)); render(); message(feedback); return true; }
    catch { message('브라우저에 저장할 수 없어요. 저장 공간과 브라우저 설정을 확인해 주세요.'); }
  }
  function save(recipe) {
    const list = saved();
    if (list.some(item => item.name === recipe.name)) return message('같은 이름의 즐겨찾기가 있습니다. 다른 이름을 사용해 주세요.');
    if(write([...list, recipe], recipe.name + ' 저장 완료')) { window.recordFeature?.('save'); return true; }
  }
  let appliedName = '';
  const memoDraftKey = 'cafeleeu.recipeMemoDraft.v1';
  function syncMemo() {
    $('recipeMemoCount').textContent = $('recipeMemo').value.length + ' / 300';
    try { localStorage.setItem(memoDraftKey, $('recipeMemo').value); } catch {}
  }
  try { $('recipeMemo').value = recipeMemoText(localStorage.getItem(memoDraftKey)); } catch {}
  syncMemo();
  $('recipeMemo').addEventListener('input', () => {
    syncMemo();
    $('recipeMemoStatus').textContent = '작성 중인 메모입니다. 보관함 저장 또는 아래 메모 저장 버튼으로 레시피에 기록해 주세요.';
  });
  $('saveAppliedMemo').onclick = () => {
    const list = saved(), index = list.findIndex(r => r.name === appliedName);
    if (index < 0) {
      $('recipeMemoStatus').textContent = '저장된 레시피를 적용하거나, 보관함에서 현재 설정을 새 레시피로 저장해 주세요.';
      return;
    }
    list[index] = {...list[index], memo:recipeMemoText($('recipeMemo').value)};
    $('recipeMemoStatus').textContent = write(list, '메모 저장 완료') ? '「' + appliedName + '」의 메모를 저장했어요.' : '메모를 저장하지 못했어요. 저장 공간을 확인해 주세요.';
  };
  function apply(recipe) {
    if ($('coffee').disabled) return message('레시피를 바꾸려면 타이머를 초기화해 주세요.');
    window.recordFeature?.('apply');
    appliedName = recipe.name;
    $('recipeMemo').value = recipeMemoText(recipe.memo);
    syncMemo();
    $('recipeMemoStatus').textContent = '「' + recipe.name + '」의 메모 · 공유 링크와 QR에도 포함됩니다.';
    window.activeBrewProfile=recipe.profile==='ultra'?'ultra':null;
    GrindUI.setReference(recipe.grind);
    setMode('ratio');
    fields.forEach((id, index) => { $(id).value = recipe.values[index]; });
    PourTemperatures.render(recipe.temperatures);
    PourAmounts.render(recipe.amounts);
    PourAmounts.sync();
    $('second').dispatchEvent(new Event('input', {bubbles:true}));
    $('favoritesDialog').close();
    $('start').focus();
  }
  function button(label, action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.onclick = action; return b;
  }
  function card(recipe, personal) {
    const row = document.createElement('article');
    const title = document.createElement('strong');
    title.textContent = recipe.name;
    const info = document.createElement('p');
    const [coffee, water, count, bloom, interval, drain] = recipe.values;
    info.textContent = coffee+' g · 물 '+water+' g · '+count+'회 푸어 · 뜸 '+bloom+'초 · 간격 '+interval+'초 · 마무리 '+drain+'초';
    const controls = document.createElement('div');
    const bookmarked = saved().some(r => r.name === recipe.name && String(r.values) === String(recipe.values) && r.profile === recipe.profile);
    if(recipe.profile==='ultra'){
      info.textContent=coffee+' g · 물 '+water+' g · 4회 푸어 · 0:00 / 0:45 / 1:15 / 1:50';
      const guide=document.createElement('p');guide.textContent=BrewProfiles.ultra.note+' · 단계별 붓기 안내는 적용 후 전체 순서에서 확인하세요.';
      row.append(guide);
    }
    if (recipe.finishRange) {
      info.textContent = coffee + ' g · 물 ' + water + ' g · 1:' + fmt(water / coffee) +
        ' · 4회 푸어 · 목표 ' + recipe.finishRange;
      const guide = document.createElement('p');
      guide.textContent = '첫 두 회차는 블루밍 · 워시드 92–94°C / 발효·무산소·내추럴 89–91°C · 물이 5–10 mL 남았을 때 드리퍼 제거 · David Jim (LOT61)';
      row.append(guide);
    }
    if (recipe.guide) {
      const guide = document.createElement('p');
      guide.className = 'recipe-guide';
      guide.textContent = recipe.guide;
      row.append(guide);
    }
    controls.append(button('적용', () => apply(recipe)));
    controls.append(button('레시피 QR', () => showRecipeQR(recipe, message)));
    if (personal) {
      controls.append(button('공유', () => share(recipe)));
      controls.append(button('메모 편집', () => editMemo(row, recipe)));
      controls.append(button('TDS 기록', () => editTds(row, recipe)));
      controls.append(button('이름 변경', () => editName(row, recipe)));
    }
    if (personal) controls.append(button('삭제', () => write(saved().filter(r => r.name !== recipe.name), '즐겨찾기에서 삭제했어요.')));
    else {
      const b = button(bookmarked ? '★ 저장됨' : '☆ 즐겨찾기', () => save(recipe));
      b.disabled = bookmarked; controls.append(b);
    }
    if (GrindAnalysis.valid(recipe.grind)) info.textContent += ' · 분쇄도 기준 '+recipe.grind.mid+' μm';
    if (personal || validRecipeTds(recipe.tds)) {
      const tds = document.createElement('p');
      tds.textContent = validRecipeTds(recipe.tds) ? '측정 TDS ' + recipe.tds.toLocaleString('ko-KR', {
        minimumFractionDigits: 2, maximumFractionDigits: 10
      }) + '%' : '측정 TDS 미기록';
      row.append(tds);
    }
    if (recipeMemoText(recipe.memo)) {
      const memo = document.createElement('p'); memo.className = 'recipe-memo-text';
      memo.textContent = recipeMemoText(recipe.memo); row.append(memo);
    }
    row.prepend(title, info); row.append(controls); return row;
  }
  function editMemo(row, recipe) {
    const existing = row.querySelector('.memo-form');
    if (existing) { existing.querySelector('textarea').focus(); return; }
    const form = document.createElement('form'); form.className = 'memo-form';
    const label = document.createElement('label'); label.textContent = '레시피 메모 · 최대 300자';
    const input = document.createElement('textarea'); input.rows = 3; input.maxLength = 300;
    input.value = recipeMemoText(recipe.memo); label.append(input);
    const submit = document.createElement('button'); submit.textContent = '메모 저장';
    form.append(label, submit, button('취소', () => form.remove()));
    form.onsubmit = event => {
      event.preventDefault(); const list = saved();
      const index = list.findIndex(r => r.name === recipe.name && r.values.every((v,i) => v === recipe.values[i]));
      if (index < 0) { render(); message('목록이 변경됐어요. 다시 확인해 주세요.'); return; }
      const memo = recipeMemoText(input.value); list[index] = {...list[index], memo};
      if (write(list, '레시피 메모를 저장했어요.') && appliedName === recipe.name) { $('recipeMemo').value = memo; syncMemo(); }
    };
    row.append(form); input.focus();
  }
  function editTds(row, recipe) {
    const existing = row.querySelector('.tds-form');
    if (existing) { existing.querySelector('input').focus(); return; }
    const form = document.createElement('form');
    form.className = 'rename-form tds-form';
    const label = document.createElement('label');
    label.textContent = '측정 TDS (%) · 비워 두면 기록 삭제';
    const input = document.createElement('input');
    const template = $('recipeTds');
    for (const attr of ['type', 'inputmode', 'min', 'max', 'step']) {
      input.setAttribute(attr, template.getAttribute(attr));
    }
    input.value = validRecipeTds(recipe.tds) ? recipe.tds : '';
    label.append(input);
    const submit = document.createElement('button');
    submit.textContent = '저장';
    form.append(label, submit, button('취소', () => form.remove()));
    form.onsubmit = event => {
      event.preventDefault();
      const list = saved();
      const index = list.findIndex(item => item.name === recipe.name &&
        item.values.every((value, i) => value === recipe.values[i]));
      if (index < 0) { render(); message('레시피가 변경됐어요. 목록을 다시 확인해 주세요.'); return; }
      const updated = list[index];
      if (input.value === '') delete updated.tds;
      else if (validRecipeTds(input.valueAsNumber)) updated.tds = input.valueAsNumber;
      else return;
      write(list, input.value === '' ? 'TDS 기록을 삭제했어요.' : '측정 TDS를 저장했어요.');
    };
    row.append(form);
    input.focus();
    input.select();
  }
  function editName(row, recipe) {
    const existing = row.querySelector('.rename-form');
    if (existing) { existing.querySelector('input').focus(); return; }
    const form = document.createElement('form');
    form.className = 'rename-form';
    const label = document.createElement('label');
    label.textContent = '새 레시피 이름';
    const input = document.createElement('input');
    input.value = recipe.name;
    input.maxLength = 512;
    label.append(input);
    const feedback = document.createElement('span');
    feedback.setAttribute('role', 'status');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = '저장';
    const cancel = button('취소', () => form.remove());
    form.append(label, submit, cancel, feedback);
    form.onsubmit = event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) { feedback.textContent = '이름을 입력해 주세요.'; input.focus(); return; }
      if (name === recipe.name) { form.remove(); return; }
      const list = saved();
      if (list.some(item => item.name === name)) {
        feedback.textContent = '이미 사용 중인 이름이에요. 다른 이름을 입력해 주세요.';
        return;
      }
      const index = list.findIndex(item => item.name === recipe.name &&
        item.values.every((value, i) => value === recipe.values[i]));
      if (index < 0) { render(); message('레시피가 변경됐어요. 목록을 다시 확인해 주세요.'); return; }
      list[index] = {...list[index], name};
      if (write(list, '레시피 이름을 변경했어요.') && appliedName === recipe.name) appliedName = name;
    };
    row.append(form);
    input.focus();
    input.select();
  }
  async function share(recipe, feedback = $('shareFeedback'), field = $('manualShareLink')) {
    window.recordFeature?.('share');
    const url = RecipeLink.make(recipe);
    field.hidden = true;
    feedback.textContent = '';
    if (navigator.share) {
      try {
        await navigator.share({title: '카페이유 · ' + recipe.name, url});
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      feedback.textContent = '공유 링크를 복사했어요. 메시지에 붙여넣어 주세요.';
    } catch {
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      feedback.textContent = '선택된 링크를 복사해 보내주세요.';
    }
  }
  function saveReceived(recipe) {
    const list = saved();
    let name = recipe.name;
    for (let number = 2; list.some(item => item.name === name); number++) {
      const existing = list.find(item => item.name === name);
      if (recipeMemoText(existing.memo) === recipeMemoText(recipe.memo) && existing.profile === recipe.profile && existing.tds === recipe.tds && String(existing.amounts || []) === String(recipe.amounts || []) && String(existing.temperatures || []) === String(recipe.temperatures || []) && JSON.stringify(existing.grind || null) === JSON.stringify(recipe.grind || null) && existing.values.every((value, i) => value === recipe.values[i])) {
        $('shareFeedback').textContent = name + '은 이미 보관함에 있어요.';
        return;
      }
      name = recipe.name + ' (' + number + ')';
    }
    if (write([...list, {...recipe, name}], '저장 완료')) {
      window.recordFeature?.('save');
      $('shareFeedback').textContent = name + '을 내 즐겨찾기에 저장했어요.';
    } else {
      $('shareFeedback').textContent = '저장하지 못했어요. 기기의 저장 공간을 확인해 주세요.';
    }
  }
  function preview(input) {
    const dialog = $('favoritesDialog');
    document.querySelectorAll('dialog[open]').forEach(other => {
      if (other !== dialog) other.close();
    });
    if (!dialog.open) dialog.showModal();
    $('received').hidden = true;
    $('receivedCard').replaceChildren();
    try {
      const recipe = RecipeLink.parse(input);
      if (!valid(recipe)) throw Error('settings');
      window.recordFeature?.('import_recipe');
      const row = card(recipe, false);
      row.lastElementChild.replaceChildren(
        button('내 즐겨찾기에 저장', () => saveReceived(recipe)),
        button('바로 적용', () => apply(recipe))
      );
      if (recipe.grind) row.lastElementChild.append(button('내 원두와 비교', () => {
        apply(recipe);
        if (!$('favoritesDialog').open) $('grindDialog').showModal();
      }));
      $('receivedCard').append(row);
      $('received').hidden = false;
      $('shareFeedback').textContent = '';
      $('received').scrollIntoView({block:'nearest'});
    } catch {
      $('shareFeedback').textContent = '레시피 링크가 올바르지 않아요. 받은 링크 전체를 다시 붙여넣어 주세요.';
    }
  }
  $('importLinkForm').onsubmit = event => {
    event.preventDefault();
    preview($('incomingLink').value);
  };
  function readAddress() {
    if (location.hash.startsWith('#recipe=')) preview(location.href);
  }
  window.addEventListener('hashchange', readAddress);
  function searchRecipes() {
    const query = $('recipeSearchInput').value.trim().normalize('NFKC').toLocaleLowerCase('ko-KR');
    const results = $('recipeSearchResults'), status = $('recipeSearchStatus');
    results.replaceChildren(); results.hidden = !query;
    if (!query) { status.textContent = '추천 레시피와 이 기기에 저장한 레시피를 찾아보세요.'; return; }
    const terms = query.split(/\s+/);
    const entries = [...saved().map(recipe => ({recipe, personal:true})), ...recipes.map(recipe => ({recipe, personal:false}))];
    const matches = entries.filter(({recipe}) => {
      const text = (recipe.name + ' ' + recipeMemoText(recipe.memo)).normalize('NFKC').toLocaleLowerCase('ko-KR');
      return terms.every(term => text.includes(term));
    });
    status.textContent = matches.length ? matches.length + '개 레시피를 찾았어요.' : '검색 결과가 없어요. 이름이나 메모의 다른 단어로 검색해 주세요.';
    for (const {recipe, personal} of matches) {
      const row = document.createElement('article');
      const tag = document.createElement('small'); tag.textContent = personal ? '내 보관함' : '추천 레시피';
      const title = document.createElement('strong'); title.textContent = recipe.name;
      const info = document.createElement('p'); info.textContent = '원두 ' + recipe.values[0] + ' g · 물 ' + recipe.values[1] + ' g';
      row.append(tag, title, info);
      if (recipeMemoText(recipe.memo)) { const memo = document.createElement('p'); memo.className = 'search-memo'; memo.textContent = recipeMemoText(recipe.memo); row.append(memo); }
      const controls = document.createElement('div');
      controls.append(button('바로 적용', () => {
        if ($('coffee').disabled) { status.textContent = '레시피를 바꾸려면 타이머를 초기화해 주세요.'; return; }
        apply(recipe); status.textContent = '「' + recipe.name + '」을 적용했어요.';
      }), button('레시피 QR', () => showRecipeQR(recipe, text => { status.textContent = text; })));
      row.append(controls); results.append(row);
    }
  }
  let finishedRecipe = null, finishedTarget = null, brewedAppliedName = '';
  window.captureBrewRecipe = () => {
    brewedAppliedName = appliedName;
    finishedRecipe = currentRecipe(appliedName || '내 추출 레시피');
    finishedTarget = saved().find(r => r.name === appliedName) || null;
    window.resetTimerMemo();
    $('brewMemoFeedback').textContent = '';
    $('brewEndMemo').value = recipeMemoText(finishedRecipe?.memo);
    let name = finishedRecipe?.name || '내 추출 레시피';
    const list = saved();
    for (let n = 2; list.some(r => r.name === name); n++) name = (finishedRecipe?.name || '내 추출 레시피').slice(0,30) + ' (' + n + ')';
    $('brewMemoName').value = name.slice(0,40);
  };
  window.showBrewMemo = () => {
    if (!finishedRecipe) return;
    $('reopenBrewMemo').dataset.complete = 'true';
    $('timerMemoLabel').textContent = '메모 남기기';
    $('brewMemoRecipe').textContent = finishedRecipe.name;
    $('brewMemoNameLabel').hidden = Boolean(finishedTarget);
    $('brewMemoName').required = !finishedTarget;
    $('brewMemoSave').textContent = finishedTarget ? '적용한 레시피에 메모 저장' : '레시피와 메모 함께 저장';
    document.querySelectorAll('dialog[open]').forEach(d => { if (d !== $('brewMemoDialog')) d.close(); });
    if (!$('brewMemoDialog').open) $('brewMemoDialog').showModal();
  };
  window.resetTimerMemo = () => {
    $('reopenBrewMemo').dataset.complete = 'false';
    $('timerMemoLabel').textContent = '메모';
  };
  $('reopenBrewMemo').onclick = () => {
    if ($('reopenBrewMemo').dataset.complete === 'true') { window.showBrewMemo(); return; }
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    $('settingsDialog').showModal();
    $('recipeMemo').focus();
    $('recipeMemo').scrollIntoView({block:'nearest'});
  };
  $('brewMemoForm').onsubmit = event => {
    event.preventDefault();
    if (!finishedRecipe) return;
    const list = saved(), memo = recipeMemoText($('brewEndMemo').value);
    const feedback = $('brewMemoFeedback');
    let name;
    if (finishedTarget) {
      const index = list.findIndex(r => r.name === finishedTarget.name && r.values.every((v,i) => v === finishedTarget.values[i]));
      if (index < 0) {
        finishedTarget = null; $('brewMemoNameLabel').hidden = false; $('brewMemoName').required = true;
        $('brewMemoSave').textContent = '레시피와 메모 함께 저장';
        feedback.textContent = '원래 레시피가 변경되거나 삭제됐어요. 새 이름으로 저장해 주세요.'; return;
      }
      name = list[index].name; list[index] = {...list[index], memo};
    } else {
      name = $('brewMemoName').value.trim();
      if (!name) { feedback.textContent = '레시피 이름을 입력해 주세요.'; return; }
      if (list.some(r => r.name === name)) { feedback.textContent = '같은 이름이 있어요. 다른 이름으로 저장해 주세요.'; return; }
      list.push({...finishedRecipe, name, memo});
    }
    if (!write(list, '추출 메모 저장 완료')) { feedback.textContent = '저장하지 못했어요. 기기 저장 공간을 확인해 주세요.'; return; }
    finishedTarget = list.find(r => r.name === name);
    finishedRecipe = {...finishedRecipe, name, memo};
    if (appliedName === brewedAppliedName) {
      appliedName = name; brewedAppliedName = name; $('recipeMemo').value = memo; syncMemo();
      $('recipeMemoStatus').textContent = '「' + name + '」의 추출 메모를 저장했어요.';
    }
    $('brewMemoNameLabel').hidden = true; $('brewMemoName').required = false;
    $('brewMemoSave').textContent = '메모 수정 저장';
    feedback.textContent = '「' + name + '」에 저장했어요. 보관함에서 다시 볼 수 있습니다.';
    window.recordFeature?.('save');
  };
  $('recipeSearchInput').addEventListener('input', searchRecipes);
  $('recipeSearchForm').onsubmit = event => { event.preventDefault(); searchRecipes(); };
  function render() {
    searchRecipes();
    $('recommended').replaceChildren(...recipes.map(r => card(r, false)));
    const list = saved();
    const target = $('grindTarget'), selected = target.value;
    target.replaceChildren(new Option('현재 추출 설정으로 새 레시피 만들기', ''));
    list.forEach(recipe => target.add(new Option(recipe.name, recipe.name)));
    target.value = list.some(recipe => recipe.name === selected) ? selected : '';
    $('grindNameLabel').hidden = Boolean(target.value);
    $('savedRecipes').replaceChildren(...list.map(r => card(r, true)));
    if (!list.length) $('savedRecipes').textContent = '저장한 레시피가 아직 없어요.';
  }
  function currentRecipe(name) {
    const values = fields.map(id => Number($(id).value));
    if (mode === 'water') values[1] *= values[0];
    const profile=window.activeBrewProfile==='ultra' && values.slice(2).every((v,i)=>v===BrewProfiles.ultra.values[i+2])?'ultra':null;
    const amounts = PourAmounts.read();
    if ($('pourAmountError').textContent) return null;
    const temperatures = PourTemperatures.read();
    return {name, values, ...(recipeMemoText($('recipeMemo').value) ? {memo:recipeMemoText($('recipeMemo').value)} : {}), ...(amounts.length ? {amounts} : {}), ...(temperatures.length ? {temperatures} : {}), ...(profile?{profile}:{}), ...(GrindUI.reference ? {grind:GrindUI.reference} : {})};
  }
  $('grindTarget').onchange = () => { $('grindNameLabel').hidden = Boolean($('grindTarget').value); };
  $('grindSave').onclick = () => {
    const existing = $('grindTarget').value;
    const name = existing || $('grindRecipeName').value.trim();
    const status = $('grindStatus');
    if (!name) { status.textContent = '새 레시피 이름을 입력해 주세요.'; $('grindRecipeName').focus(); return; }
    const settings = currentRecipe(name);
    if (!existing && !valid(settings)) { status.textContent = '메인의 원두·물·푸어 설정을 확인해 주세요.'; return; }
    GrindUI.withMeasurement(async grind => {
      const list = saved(), index = list.findIndex(recipe => recipe.name === name);
      if (existing && index < 0) { status.textContent = '레시피 목록이 변경됐어요. 다시 선택해 주세요.'; return; }
      if (!existing && index >= 0) { status.textContent = '같은 이름이 있어요. 기존 레시피를 선택하거나 새 이름을 입력해 주세요.'; return; }
      const recipe = {...(existing ? list[index] : settings), grind};
      if (existing) list[index] = recipe;
      else list.push(recipe);
      if (!write(list, name + ' 저장 완료')) { status.textContent = '저장하지 못했어요. 기기의 저장 공간을 확인해 주세요.'; return; }
      window.recordFeature?.('grind_save');
      window.recordFeature?.('save');
      if (!existing || appliedName === name) { appliedName = name; GrindUI.setReference(grind); }
      $('grindTarget').value = name;
      $('grindNameLabel').hidden = true;
      status.textContent = '「' + name + '」에 분쇄도 ' + grind.mid + ' μm를 저장했어요.';
    });
  };
  $('currentQR').onclick = () => {
    const recipe = currentRecipe(appliedName || '내 추출 레시피');
    const feedback = text => { $('currentShareFeedback').textContent = text; };
    if (!valid(recipe)) return feedback('원두량·물량과 푸어 설정을 확인해 주세요.');
    feedback('');
    showRecipeQR(recipe, feedback);
  };
  $('shareCurrent').onclick = () => {
    const recipe = currentRecipe(appliedName || '내 추출 레시피');
    const feedback = $('currentShareFeedback');
    const field = $('currentShareLink');
    if (!valid(recipe)) {
      field.hidden = true;
      feedback.textContent = '원두량·물량과 푸어 설정을 확인해 주세요.';
      return;
    }
    share(recipe, feedback, field);
  };
  $('saveRecipe').onsubmit = event => {
    event.preventDefault();
    const recipe = currentRecipe($('recipeName').value.trim());
    if (!valid(recipe)) return message('레시피 이름과 원두·물·푸어 설정을 확인해 주세요.');
    const tds = $('recipeTds').valueAsNumber;
    if (validRecipeTds(tds)) recipe.tds = tds;
    if (save(recipe)) appliedName = recipe.name;
  };
  window.addEventListener('storage', event => { if (event.key === storageKey) render(); });
  $('copyStore').onclick = async () => {
    const url = document.querySelector('.store-link').href;
    try { await navigator.clipboard.writeText(url); $('storeStatus').textContent = '스토어 주소를 복사했어요.'; }
    catch { $('storeStatus').textContent = url; }
  };
  render();
  readAddress();
})();
