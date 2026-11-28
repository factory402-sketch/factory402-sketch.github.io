(()=>{
const el=id=>document.getElementById(id), clock=s=>{s=Math.floor(s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
let plan=[], finish=0, status='idle', elapsed=0, anchor=0, last=-1, audio=null, wake=null, audioGeneration=0;
// v3.4 · 작은 창(PiP) 타이머가 읽어 가는 상태 (pip-timer.js)
let brewTotal=0, brewCoffee=0;
const activeTones=new Set();
const speechOK='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const settings=['pourCount','bloom','interval','drain'];
function buildPlan(total,count,bloom,interval,drain){const rows=[];let prev=0;for(let i=0;i<count;i++){const cumulative=Math.round(total*(i+1)/count*100)/100;rows.push({at:i===0?0:bloom+(i-1)*interval,amount:Math.round((cumulative-prev)*100)/100,total:cumulative});prev=cumulative;}return {rows,end:rows.at(-1).at+drain};}
let dialState = '';
function showRound(count, active, time) {
  const round = Math.min(active + 1, count);
  el('brewRound').textContent = round + ' / ' + count;
  el('recipeProgress').textContent = clock(time) + ' · ' + round + ' / ' + count;
  const state = count + ':' + active + ':' + status;
  if (dialState === state) return;
  dialState = state;
  const circumference = 2 * Math.PI * 65;
  el('brewRing').innerHTML = Array.from({length:count}, (_, i) => {
    const angle = 360 * i / count;
    const radians = angle * Math.PI / 180;
    const css = i === active ? 'current' : i < active ? 'passed' : 'upcoming';
    return '<g class="' + css + '"><circle cx="80" cy="80" r="65" pathLength="' + circumference +
      '" stroke-dasharray="' + (circumference/count - 5) + ' ' + circumference +
      '" transform="rotate(' + (angle - 90 - 180/count + 900/circumference) + ' 80 80)"/>' +
      '<text x="' + (80 + 65*Math.sin(radians)) + '" y="' + (80 - 65*Math.cos(radians)) +
      '">' + (i < active ? '✓' : i+1) + '</text></g>';
  }).join('');
  document.querySelectorAll('#recipe li').forEach((row, i) => {
    row.classList.toggle('active', i === active);
    row.classList.toggle('passed', i < active);
    if (i === active) row.setAttribute('aria-current', 'step');
    else row.removeAttribute('aria-current');
    row.querySelector('.recipe-state').textContent = i < active ? '✓ 완료' :
      i === active ? (status === 'paused' ? '일시정지' : status === 'done' ? '마무리' : '진행 중') : '';
  });
}
function showPour(amount, temperature) {
  const pour = el('brewPour'), temp = el('brewTemperature');
  pour.hidden = amount == null;
  pour.textContent = amount == null ? '' : '+' + fmt(amount) + ' g';
  temp.hidden = temperature == null;
  temp.textContent = temperature == null ? '' : '물 온도 ' + fmt(temperature) + ' °C';
}
function snapshot(){
const live=status==='running'?elapsed+(Date.now()-anchor)/1000:elapsed;
const cap=finish>0?Math.max(0,Math.min(live,finish)):Math.max(0,live);
let k=-1;
if(plan.length&&status!=='idle'){for(let j=0;j<plan.length;j++)if(cap>=plan[j].at)k=j;if(k<0)k=0;}
if(status==='done')k=plan.length-1;
const s=k>=0?plan[k]:null,nx=k>=0?plan[k+1]:null;
return{status,elapsed:cap,finish,stages:plan.length,stage:k,
 cue:!plan.length?'레시피 확인':status==='done'?'추출 완료':k<0?'추출 준비':(k===0?'뜸 들이기':(k+1)+'차 푸어'),
 pour:s?s.amount:null,target:s?s.total:(plan[0]?plan[0].total:0),
 total:brewTotal,coffee:brewCoffee,ratio:brewCoffee>0?brewTotal/brewCoffee:null,
 temperature:s&&s.temperature!=null?s.temperature:null,
 nextIn:k<0?null:(nx?Math.max(0,nx.at-cap):Math.max(0,finish-cap)),
 nextLabel:k<0?null:(nx?'다음 푸어까지':'마무리 확인까지'),
 perPour:plan.map(r=>r.amount)};
}
function publish(){const snap=snapshot();window.brewTimerSnapshot=snap;try{window.dispatchEvent(new CustomEvent('brewtimer',{detail:snap}));}catch{}}
window.getBrewTimerSnapshot=snapshot;
function lock(on){document.querySelectorAll('.fields input:not(#sound):not(#voice),.fields select,.fields .presets button,.tabs button,.pour-count button').forEach(n=>n.disabled=on);}
function build(){if(status!=='idle')return;const c=Number(el('coffee').value),v=Number(el('second').value),r=calculate(c,v,mode);const n=Number(el('pourCount').value),b=Number(el('bloom').value),i=Number(el('interval').value),d=Number(el('drain').value);const total=mode==='ratio'?v:c*v;
const amounts=typeof PourAmounts === 'undefined' ? [] : PourAmounts.read();
const resolved=typeof PourAmounts === 'undefined' ? [] : PourAmounts.resolve(total,amounts);
const amountError=resolved===null ? '회차별 물량을 확인해 주세요. 빈 회차에 배분할 물이 필요하고, 총 물량은 1~100,000 g이어야 합니다.' : '';
if(typeof PourAmounts !== 'undefined'){
  el('pourAmountError').textContent=amountError;
  const ratio=total/c;
  const label=resolved!==null && r!==null && total>=1 && total<=100000
    ? '원두 : 물  1 : '+(ratio<.01?'< 0.01':fmt(ratio))+' · 총 물량 '+fmt(total)+' g'
    : '원두 : 물  —';
  if(el('pourRatioPreview').textContent!==label)el('pourRatioPreview').textContent=label;
}
const valid=resolved!==null&&r!==null&&total>=1&&total<=100000&&[2,3,4,5,6,10].includes(n)&&Number.isInteger(b)&&b>=10&&b<=120&&Number.isInteger(i)&&i>=10&&i<=120&&Number.isInteger(d)&&d>=15&&d<=180;
el('brewError').textContent=valid?'':amountError||'물 총량은 1~100,000g, 뜸·간격은 정수 10~120초, 마지막 대기는 정수 15~180초로 입력해 주세요.';el('start').disabled=!valid;
showPour(null,null);
el('recipeRatio').textContent=valid?'원두 '+fmt(c)+' g · 물 '+fmt(total)+' g · 1:'+fmt(total/c):'';
if(!valid){showRound(0,-1,0);plan=[];brewTotal=0;brewCoffee=0;el('recipe').innerHTML='';el('next').textContent='입력값을 확인해 주세요.';publish();return;}
const profile=window.activeBrewProfile==='ultra' && n===4 && b===45 && i===30 && d===70 ? window.BrewProfilesForTimer?.ultra : null;
const p=profile?profile.plan(total):buildPlan(total,n,b,i,d);plan=p.rows;finish=p.end;brewTotal=total;brewCoffee=c;
if(resolved.length){
  let cumulative=0;
  plan=plan.map((row,k)=>{
    cumulative+=Math.round(resolved[k]*100);
    return {...row,amount:resolved[k],total:cumulative/100};
  });
}
const temperatures=typeof PourTemperatures === 'undefined' ? [] : PourTemperatures.read();plan=plan.map((row,k)=>({...row,temperature:temperatures[k]}));el('recipe').innerHTML=plan.map((s,k)=>'<li data-step="'+k+'"><time>'+clock(s.at)+'</time><div>'+ (k===0?'1차 · 뜸 들이기':(k+1)+'차 푸어')+'<small>'+ (profile&&!resolved.length?profile.hints[k]:(k===0?'첫 물을 부으며 타이머 시작':'이 시점에 물붓기 시작'))+'</small><span class="recipe-state"></span>'+ (temperatures[k] != null ? '<small class="pour-temperature">물 온도 '+fmt(temperatures[k])+' °C</small>' : '')+'</div><div class="amount">+'+fmt(s.amount)+' g<small>누적 '+fmt(s.total)+' g</small></div></li>').join('')+'<li><time>'+clock(finish)+'</time><div>마무리 확인<small>물 빠짐을 보고 드리퍼 제거</small><span class="recipe-state"></span></div><div class="amount">'+fmt(total)+' g</div></li>';dialState='';showRound(plan.length,-1,0);el('next').textContent='총 '+fmt(total)+' g · '+n+'회 푸어 · 예상 '+clock(finish)+(profile?' · 96~98°C':'');publish();}
async function enableAudio(){
if(!el('sound').checked)return;
try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state!=='running')await audio.resume();if(audio.state!=='running')el('audioStatus').textContent='알림음을 사용할 수 없어요. 소리 미리 듣기를 다시 눌러주세요.';}catch{el('audioStatus').textContent='이 브라우저에서 알림음을 사용할 수 없어요.';}
}
function stopAlerts(){audioGeneration++;if(speechOK)window.speechSynthesis.cancel();for(const o of activeTones){try{o.stop();}catch{}}activeTones.clear();}
function beep(kind){if(!el('sound').checked||!audio||audio.state!=='running')return;
const notes=kind==='finish'?[660,880,1100]:kind==='start'?[660,880]:[880,880];
notes.forEach((hz,i)=>{try{const o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime+i*.22;o.connect(g);g.connect(audio.destination);o.frequency.value=hz;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.2,at+.015);g.gain.exponentialRampToValueAtTime(.001,at+.19);activeTones.add(o);o.onended=()=>{activeTones.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+.2);}catch{}});
}
function announce(text,kind='step',audioReady=null){
stopAlerts();const generation=audioGeneration;
// Speech must stay in the button's synchronous user-activation call stack.
// Only the tone waits for AudioContext readiness; stale tones are discarded.
if(audioReady)audioReady.then(()=>{if(generation===audioGeneration)beep(kind);});else beep(kind);
if(!el('voice').checked||!speechOK)return;
try{const u=new window.SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=1;u.volume=1;const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('ko'));if(voice)u.voice=voice;u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))el('audioStatus').textContent='음성 안내를 재생하지 못했어요. 알림음을 사용하거나 기기 음성 설정을 확인해 주세요.';};window.speechSynthesis.speak(u);}catch{el('audioStatus').textContent='음성 안내를 재생하지 못했어요.';}
}
if(!speechOK){el('voice').checked=false;el('voice').disabled=true;el('audioStatus').textContent='이 브라우저는 음성 안내를 지원하지 않아 알림음으로 안내합니다.';}
el('testSound').onclick=()=>{if(!el('sound').checked&&!el('voice').checked){el('audioStatus').textContent='알림음 또는 음성 안내를 켜주세요.';return;}const ready=enableAudio();announce('추출을 시작합니다. 첫 물을 천천히 부어주세요.','start',ready);};
el('sound').addEventListener('change',async()=>{stopAlerts();if(el('sound').checked)await enableAudio();});el('voice').addEventListener('change',stopAlerts);
async function keepAwake(){try{if('wakeLock'in navigator)wake=await navigator.wakeLock.request('screen');}catch{}}
function release(){if(wake){wake.release().catch(()=>{});wake=null;}}
function paint(audioReady=null){const t=status==='running'?elapsed+(Date.now()-anchor)/1000:elapsed;el('clock').textContent=clock(t);if(!plan.length||status==='idle'){publish();return;}
if(t>=finish){elapsed=finish;status='done';el('clock').textContent=clock(finish);el('cue').textContent='물 빠짐을 확인해 주세요';el('next').textContent='예상 시간이 되었어요. 드리퍼를 제거하면 추출 완료!';el('start').textContent='다시 추출';release();if(last!==plan.length){announce('예상 추출 시간이 되었습니다. 물 빠짐을 확인하고 드리퍼를 제거해 주세요.','finish');last=plan.length;window.showBrewMemo?.();}showRound(plan.length,plan.length,finish);showPour(null,null);publish();return;}
let k=0;for(let j=0;j<plan.length;j++)if(t>=plan[j].at)k=j;
if(k!==last){if(status==='running'){const p=plan[k];announce((k===0?'추출을 시작합니다. 뜸 들이기.':(k+1)+'차 푸어입니다.')+' 물 '+fmt(p.amount)+'그램을 부어, 누적 '+fmt(p.total)+'그램까지 맞춰주세요.',k===0?'start':'step',audioReady);}last=k;}
const s=plan[k];el('cue').textContent=(status==='paused'?'일시정지 · ':'')+(k===0?'뜸 들이기':(k+1)+'차 푸어');showPour(s.amount,s.temperature);const next=plan[k+1];el('next').textContent='목표 누적 '+fmt(s.total)+' g · '+(next?'다음 푸어까지 '+Math.ceil(next.at-t)+'초':'마무리 확인까지 '+Math.ceil(finish-t)+'초');showRound(plan.length,k,t);publish();}
function reset(){window.resetTimerMemo?.();stopAlerts();status='idle';elapsed=0;last=-1;release();lock(false);if(!speechOK)el('voice').disabled=true;el('clock').textContent='00:00';el('cue').textContent='준비되셨나요?';el('start').textContent='추출 시작';build();publish();}
el('start').onclick=()=>{if(status==='running'){elapsed+=(Date.now()-anchor)/1000;status='paused';stopAlerts();el('start').textContent='계속 추출';release();paint();return;}if(status==='done')reset();if(!plan.length)return;
const ready=enableAudio();const resumed=status==='paused';if(!resumed){window.recordBrewStart?.();window.captureBrewRecipe?.();}status='running';anchor=Date.now();lock(true);if(!speechOK)el('voice').disabled=true;el('start').textContent='일시정지';
if(resumed){announce('추출을 계속합니다.','step',ready);paint();}else paint(ready);
keepAwake();};el('reset').onclick=reset;
document.addEventListener('input',e=>{if(e.target.id!=='sound')build();});document.addEventListener('change',build);document.addEventListener('click',e=>{if(e.target.closest('.presets,.tabs'))build();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&status==='running'){paint();keepAwake();}});setInterval(()=>{if(status==='running')paint();},200);build();
})();
