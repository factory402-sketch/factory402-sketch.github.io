const $=id=>document.getElementById(id);
let mode='ratio', water=300, target=15, copyText='';
const fmt=n=>Number(n.toFixed(2)).toLocaleString('ko-KR',{maximumFractionDigits:2});
function calculate(c,v,m){if(!Number.isFinite(c)||!Number.isFinite(v)||c<=0||v<=0||c>100000||v>100000)return null;return m==='ratio'?v/c:c*v;}
function update(){const c=Number($('coffee').value),v=Number($('second').value),r=calculate(c,v,mode);if(mode==='ratio')water=v;else target=v;
$('error').textContent=r===null?'0보다 크고 100,000 이하인 숫자를 입력해 주세요.':'';
$('copy').disabled=r===null;
for (const [id, value] of [['coffeePresets', c], ['secondPresets', v]]) {
  for (const button of $(id).children) {
    button.setAttribute('aria-pressed', Number(button.dataset.n) === value);
  }
}
if(r===null){$('result').textContent='—';$('explain').textContent='원두와 '+(mode==='ratio'?'물의 양':'비율')+'을 입력해 주세요.';$('equation').textContent='';return;}
const ratio=mode==='ratio'?r:v, w=mode==='ratio'?v:r;
const ratioDisplay=ratio>0&&ratio<0.01?'< 0.01':fmt(ratio);
$('result').innerHTML=mode==='ratio'?'1 : '+ratioDisplay:fmt(r)+' <small>g</small>';
$('explain').textContent=mode==='ratio'?'원두 1 g에 물 '+ratioDisplay+' g을 사용하는 비율이에요.':'원두 '+fmt(c)+' g을 1 : '+fmt(v)+' 비율로 추출해요.';
$('equation').textContent=fmt(c)+' g COFFEE + '+fmt(w)+' g WATER';
copyText='카페이유 추출 레시피\n원두 '+fmt(c)+' g · 물 '+fmt(w)+' g\n추출 비율 1 : '+ratioDisplay;

}
function setMode(m){mode=m;const is=m==='ratio';$('ratioTab').setAttribute('aria-selected',is);$('waterTab').setAttribute('aria-selected',!is);$('secondLabel').textContent=is?'붓는 물':'원하는 비율';$('secondEnglish').textContent=is?'WATER':'BREW RATIO';$('prefix').hidden=is;$('secondUnit').textContent=is?'g':'';$('second').value=is?water:target;$('resultLabel').textContent=is?'원두 : 물':'필요한 물의 양';$('secondPresets').innerHTML=(is?[150,225,300,450]:[10,12,15,17]).map(n=>'<button data-n="'+n+'">'+(is?n+' g':'1 : '+n)+'</button>').join('');update();}
$('ratioTab').onclick=()=>setMode('ratio');$('waterTab').onclick=()=>setMode('water');
$('coffee').oninput=update;$('second').oninput=update;
$('coffeePresets').onclick=e=>{if(e.target.dataset.n){$('coffee').value=e.target.dataset.n;update();}};
$('secondPresets').onclick=e=>{if(e.target.dataset.n){$('second').value=e.target.dataset.n;update();}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(copyText);$('copyLabel').textContent='복사 완료 ✓';}catch{$('copyLabel').textContent='복사할 수 없어요';}setTimeout(()=>$('copyLabel').textContent='결과 복사',2000);};setMode('ratio');
