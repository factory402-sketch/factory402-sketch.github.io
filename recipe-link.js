const validRecipeTds = value => Number.isFinite(value) && value >= 0 && value <= 100;
const recipeMemoText = value => typeof value === 'string' ? value.slice(0, 300) : '';
const RecipeLink = (() => {
  const root = 'https://leeu-brew-ratio.ovoidhazel2.chatgpt.site/';
  function make(recipe) {
    const data = {v:1, name:recipe.name, values:recipe.values};
    if (recipeMemoText(recipe.memo)) data.memo = recipeMemoText(recipe.memo);
    if (recipe.amounts?.length) data.amounts = recipe.amounts;
    if (recipe.temperatures?.length) data.temperatures = recipe.temperatures;
    if (validRecipeTds(recipe.tds)) data.tds = recipe.tds;
    if(recipe.profile==='ultra') data.profile='ultra';
    if (GrindAnalysis.valid(recipe.grind)) data.grind = recipe.grind;
    return root + '#recipe=' + encodeURIComponent(JSON.stringify(data));
  }
  function parse(input) {
    if (input.length > 12000) throw Error('length');
    const url = new URL(input.trim());
    if (url.origin + url.pathname !== root || !url.hash.startsWith('#recipe=')) throw Error('link');
    const record = JSON.parse(decodeURIComponent(url.hash.slice(8)));
    if (record.v !== 1 || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 512) throw Error('recipe');
    const temperatures = record.temperatures ? PourTemperatures.normalize(record.temperatures, record.values?.[2]) : [];
    const amounts = record.amounts ? PourAmounts.normalize(record.amounts, record.values?.[2]) : [];
    return {name:record.name.trim(), values:record.values, ...(recipeMemoText(record.memo) ? {memo:recipeMemoText(record.memo)} : {}), ...(amounts.length ? {amounts} : {}), ...(temperatures.length ? {temperatures} : {}), ...(validRecipeTds(record.tds) ? {tds:record.tds} : {}), ...(record.profile==='ultra'?{profile:'ultra'}:{}), ...(GrindAnalysis.valid(record.grind) ? {grind:record.grind} : {})};
  }
  return {make, parse};
})();
