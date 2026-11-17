const GrindUI = (() => {
  const el=id=>document.getElementById(id);
  const canvas=el('grindCanvas'), ctx=canvas.getContext('2d');
  const original=document.createElement('canvas'), source=original.getContext('2d',{willReadFrequently:true});
  let reference=null, points=[], measurement=null, crop=null, loadNumber=0;
  const hint=[
    '① 자에서 첫 번째 눈금을 눌러주세요.',
    '② 입력한 거리만큼 떨어진 두 번째 눈금을 눌러주세요.',
    '③ 가루만 있는 분석 영역의 왼쪽 위를 누르세요.',
    '④ 반대편 모서리를 누르세요. 자와 눈금은 영역 밖에 두세요.',
    '선을 확인하고 입자 분석을 누르세요.'
  ];
  function status(text){el('grindStatus').textContent=text;}
  function resetResult(){measurement=null;crop=null;el('grindResult').hidden=true;status('');}
  function redraw(){
    ctx.drawImage(original,0,0);
    ctx.lineWidth=Math.max(2,canvas.width/200);ctx.strokeStyle='#ff962a';
    if(points.length>=2){ctx.beginPath();ctx.moveTo(...points[0]);ctx.lineTo(...points[1]);ctx.stroke();}
    if(points.length===4){ctx.strokeStyle='#00b47a';ctx.strokeRect(points[2][0],points[2][1],points[3][0]-points[2][0],points[3][1]-points[2][1]);}
    for(const [x,y] of points){ctx.beginPath();ctx.fillStyle='#ff962a';ctx.arc(x,y,Math.max(3,canvas.width/150),0,2*Math.PI);ctx.fill();}
    el('grindStep').textContent=hint[points.length];el('grindUndo').disabled=!points.length;el('grindRun').disabled=points.length!==4;
  }
  function comparison(){
    if(!measurement)return;
    if(!reference){el('grindComparison').textContent='기준으로 저장할 수 있는 측정값입니다.';return;}
    // A basis saved by counting particles runs several times finer than the same grind
    // measured by area, so comparing the two would show a meaningless +150%.
    if(!GrindAnalysis.current(reference)){el('grindComparison').textContent='이전 방식의 기준값이에요. 새로 측정해 기준을 갱신해 주세요.';return;}
    const delta=100*(measurement.mid/reference.mid-1);
    const direction=delta>0?'굵게':'곱게';
    el('grindComparison').textContent=delta===0?'두 사진의 입자 굵기가 같습니다.':'기준 '+reference.mid+' μm에 비해 이번 사진의 입자 굵기는 '+Math.abs(delta).toFixed(1)+'% '+direction+' 측정됐어요.';
  }
  async function setReference(value){
    reference=GrindAnalysis.valid(value)?value:null;
    const ref=reference,box=el('grindReference');box.replaceChildren();
    if(!ref){box.textContent='현재 레시피에 저장된 비교 기준이 없습니다.';comparison();return;}
    const title=document.createElement('strong');title.textContent='레시피 기준 · '+ref.mid+' μm';
    const detail=document.createElement('p');detail.textContent=(ref.note?ref.note+' · ':'')+ref.n+'개 검출 · 면적 10–90% '+ref.lo+'–'+ref.hi+' μm'+(GrindAnalysis.current(ref)?'':' · 이전 방식');
    const clear=document.createElement('button');clear.textContent='현재 설정에서 기준 해제';clear.onclick=()=>setReference(null);
    box.append(title,detail,clear);comparison();
    if(!ref.photo)return;
    try {
      const res=await fetch('/api/grind-photo/'+ref.photo);
      if(!res.ok)throw Error();
      const gray=new Uint8Array(await res.arrayBuffer());
      if(gray.length!==128*128||reference!==ref)return;
      const thumb=document.createElement('canvas');thumb.width=thumb.height=128;thumb.setAttribute('aria-label','기준 입자 사진');
      const c=thumb.getContext('2d'),pic=c.createImageData(128,128);
      for(let i=0;i<gray.length;i++){pic.data.fill(gray[i],4*i,4*i+3);pic.data[4*i+3]=255;}
      c.putImageData(pic,0,0);box.insertBefore(thumb,clear);
    } catch {if(reference===ref)detail.append(' · 사진을 불러오지 못했습니다.');}
  }
  let manual=false;
  const cardMode=()=>el('grindMethod').value==='card';
  el('grindMethod').onchange=()=>{
    ++loadNumber;resetResult();el('grindControls').hidden=true;
    el('grindCardHint').hidden=!cardMode();el('grindSquareHint').hidden=cardMode();
  };
  function mode(isManual){
    manual=isManual;
    el('grindManualFields').hidden=el('grindManualActions').hidden=!manual;
    el('grindManual').hidden=manual;
  }
  el('grindManual').onclick=()=>{mode(true);points=[];resetResult();redraw();};
  el('grindCamera').onchange=el('grindFile').onchange=async event=>{
    const ticket=++loadNumber;const file=event.target.files[0];event.target.value='';mode(false);
    points=[];resetResult();el('grindPhotoOpt').checked=false;el('grindControls').hidden=true;
    if(!file)return;
    if(file.size>25*1024*1024){status('25MB 이하의 사진을 선택해 주세요.');return;}
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();if(ticket!==loadNumber)return;
      readFrame(image,image.naturalWidth,image.naturalHeight);
    }catch {if(ticket===loadNumber)status('사진을 읽지 못했어요. JPG 또는 PNG로 다시 선택해 주세요.');}
    finally{URL.revokeObjectURL(url);}
  };
  // A 2048px capture keeps every print dot, so a QR ring can break into pieces there
  // while it was steady in the 768px preview. If the original frame is not read, look
  // again at preview resolution and map the region back: the pixels measured stay full size.
  function locateFrame(recipe){
    const W=original.width,H=original.height;
    try{
      return GrindMarker.locate(source.getImageData(0,0,W,H),recipe);
    }catch(error){
      const k=Math.min(1,768/Math.max(W,H));
      if(k>.72)throw error;
      const w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
      const small=document.createElement('canvas');
      small.width=w;small.height=h;
      const ctx=small.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingQuality='high';
      ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(original,0,0,w,h);
      let found;
      try{
        found=GrindMarker.locate(ctx.getImageData(0,0,w,h),recipe);
      }catch{throw error;}
      const back=value=>value/k;
      const x=Math.max(0,Math.round(back(found.x))),y=Math.max(0,Math.round(back(found.y)));
      const cw=Math.min(W-x,Math.round(back(found.w))),ch=Math.min(H-y,Math.round(back(found.h)));
      if(cw<40||ch<40)throw error;
      const {marker}=found;
      return {
        marker:{left:back(marker.left),top:back(marker.top),w:back(marker.w),h:back(marker.h),side:back(marker.side)},
        x,y,w:cw,h:ch,mmPerPixel:found.mmPerPixel*k
      };
    }
  }
  function readFrame(image,width,height){
      const scale=Math.min(1,2048/Math.max(width,height));
      canvas.width=original.width=Math.max(1,Math.round(width*scale));
      canvas.height=original.height=Math.max(1,Math.round(height*scale));
      source.fillStyle='#fff';source.fillRect(0,0,original.width,original.height);source.drawImage(image,0,0,original.width,original.height);
      el('grindControls').hidden=false;redraw();
      try{
        const {marker,x,y,w,h,mmPerPixel}=locateFrame(cardMode());
        ctx.strokeStyle='#f39828';ctx.strokeRect(marker.left,marker.top,marker.w,marker.h);
        ctx.strokeStyle='#00966c';ctx.strokeRect(x,y,w,h);
        analyze(x,y,w,h,mmPerPixel);
        status((cardMode()?'카드 QR 14 mm':'기준 네모 10 mm')+'를 인식했어요. 초록색 영역의 가루를 측정했습니다.');
        return true;
      }catch(error){window.recordFeature?.('grind_fail');status(error.message);return false;}
  }
  function captureFrame(image){
    ++loadNumber;mode(false);points=[];resetResult();el('grindPhotoOpt').checked=false;
    return readFrame(image,image.width,image.height);
  }
  canvas.onclick=e=>{
    if(!manual||points.length>=4)return;
    const b=canvas.getBoundingClientRect();
    points.push([Math.min(canvas.width-1,Math.max(0,Math.round((e.clientX-b.left)*canvas.width/b.width))),
      Math.min(canvas.height-1,Math.max(0,Math.round((e.clientY-b.top)*canvas.height/b.height)))]);
    resetResult();redraw();
  };
  el('grindUndo').onclick=()=>{points.pop();resetResult();redraw();};
  el('grindScale').oninput=()=>{resetResult();redraw();};
  el('grindRun').onclick=()=>{
    resetResult();redraw();
    try{
      const mm=Number(el('grindScale').value),span=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]);
      if(!(mm>=1&&mm<=100&&span>=25))throw Error('실제 길이는 1~100mm로 입력하고, 사진에서 충분히 떨어진 두 눈금을 찍어주세요.');
      const [a,b]=points.slice(2),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);
      if(w<40||h<40)throw Error('분석 영역을 조금 더 넓게 지정해 주세요.');
      analyze(x,y,w,h,mm/span);
    }catch(error){window.recordFeature?.('grind_fail');measurement=null;status(error.message);}
  };
  // 분쇄도 참고 가이드 — 실물 스케일 자(200~1700 μm) 기준.
  // 측정값 위치를 수평 바에 표시하고, 같은 비율의 점·구간별 추출 도구를 하이라이트한다.
  const guideLow=200, guideHigh=1700;
  const bands=[
    {name:'극세분',lo:200,hi:400},
    {name:'중세분',lo:500,hi:800},
    {name:'중조분',lo:900,hi:1100},
    {name:'조분',lo:1200,hi:1700}
  ];
  const tools=[
    {name:'터키쉬 · 에스프레소',lo:200,hi:400},
    {name:'모카포트',lo:300,hi:600},
    {name:'사이폰',lo:500,hi:1100,tag:'중세분'},
    {name:'드립머신 · 아메리카노',lo:600,hi:1200},
    {name:'핸드드립 (푸어오버)',lo:700,hi:1200,tag:'중조분'},
    {name:'프렌치프레스',lo:800,hi:1400},
    {name:'콜드브루',lo:1000,hi:1600,tag:'조분'}
  ];
  const at=v=>Math.max(0,Math.min(100,100*(v-guideLow)/(guideHigh-guideLow)));
  function buildGuide(){
    const dots=el('ggDots'),list=el('ggTools');
    if(!dots||!list||dots.dataset.built==='1')return;
    const bandEls=[...el('grindGuide').querySelectorAll('.gg-band')];
    bands.forEach((b,k)=>{
      const band=bandEls[k];
      if(band){band.style.left=at(b.lo)+'%';band.style.width=(at(b.hi)-at(b.lo))+'%';}
      const item=document.createElement('li');item.className='gg-dot';
      const dot=document.createElement('i');
      const mid=(b.lo+b.hi)/2, size=Math.round(6+32*(mid-guideLow)/(guideHigh-guideLow));
      dot.style.width=dot.style.height=size+'px';
      const name=document.createElement('span');name.textContent=b.name;
      const range=document.createElement('em');range.textContent=b.lo+'–'+b.hi;
      item.append(dot,name,range);dots.append(item);
    });
    tools.forEach(t=>{
      const item=document.createElement('li');item.className='gg-tool';
      const name=document.createElement('span');name.className='gg-tool-name';name.textContent=t.name;
      if(t.tag){const tag=document.createElement('small');tag.textContent=t.tag;name.append(tag);}
      const range=document.createElement('span');range.className='gg-tool-range';
      range.textContent=t.lo+'–'+t.hi+' μm';
      const track=document.createElement('span');track.className='gg-tool-track';
      const fill=document.createElement('i');
      fill.style.left=at(t.lo)+'%';fill.style.width=(at(t.hi)-at(t.lo))+'%';
      track.append(fill);item.append(name,range,track);list.append(item);
    });
    dots.dataset.built=list.dataset.built='1';
  }
  function showGuide(value){
    if(!el('grindGuide'))return;
    buildGuide();
    const v=Number(value);
    if(!(v>0)){el('ggValue').textContent='';return;}
    const capped=Math.round(v);
    const inside=capped>=guideLow&&capped<=guideHigh;
    const band=bands.find(b=>capped>=b.lo&&capped<=b.hi);
    // 기준 구간 사이(빈틈) 값은 좌우 구간을 '~'로 이어 보여 준다. (예: 868 → 중세분~중조분)
    const lower=[...bands].reverse().find(b=>b.hi<capped);
    const upper=bands.find(b=>b.lo>capped);
    const label=band?band.name:(lower&&upper?lower.name+'~'+upper.name:(lower?lower.name:upper?upper.name:''));
    el('ggValue').textContent=capped+' μm'+(label?' · '+label:inside?'':' · 범위 밖');
    const mark=el('ggMark');mark.hidden=false;mark.style.left=at(capped)+'%';
    const lit=band?[band]:[lower,upper].filter(Boolean);
    el('ggDots').querySelectorAll('.gg-dot').forEach((dot,k)=>{
      dot.dataset.active=lit.includes(bands[k])?'true':'false';
    });
    el('ggTools').querySelectorAll('.gg-tool').forEach((item,k)=>{
      const t=tools[k];item.dataset.active=capped>=t.lo&&capped<=t.hi?'true':'false';
    });
    const foot=el('ggFoot');
    if(foot)foot.textContent='지금 측정값('+capped+' μm)이 들어가는 구간을 앰버로 표시했어요. 사진에서 잰 입자 크기 기준의 참고값이며, 같은 분쇄도라도 그라인더·원두에 따라 조금씩 달라집니다.';
  }
  function analyze(x,y,w,h,mmPerPixel){
      const result=GrindAnalysis.measure(source.getImageData(x,y,w,h),mmPerPixel);
      measurement={n:result.n,lo:result.lo,mid:result.mid,hi:result.hi,note:'',metric:result.metric};
      if(!GrindAnalysis.valid(measurement))throw Error('측정 범위를 벗어났어요. 눈금과 영역을 다시 확인해 주세요.');
      crop={x,y,w,h};ctx.strokeStyle='#00a878';ctx.lineWidth=1;
      for(const [l,t,cw,ch] of result.marks)ctx.strokeRect(x+l,y+t,cw,ch);
      el('grindSize').textContent='입자 굵기 '+result.mid+' μm';el('grindSpread').textContent=result.n+'개 검출 · 면적 10–90% '+result.lo+'–'+result.hi+' μm';
      el('grindResult').hidden=false;comparison();showGuide(result.mid);window.recordFeature?.('grind_ok');
  }
  async function withMeasurement(onReady){
    if(!measurement||!crop)return;
    const snapshot=measurement,ref={...measurement,note:el('grindNote').value.trim().slice(0,60)};
    el('grindSave').disabled=el('grindAttach').disabled=true;
    try{
      if(el('grindPhotoOpt').checked){
        const {x,y,w,h}=crop;const thumb=document.createElement('canvas');thumb.width=thumb.height=128;
        const c=thumb.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,128,128);
        const k=128/Math.max(w,h);c.drawImage(original,x,y,w,h,(128-w*k)/2,(128-h*k)/2,w*k,h*k);
        const data=c.getImageData(0,0,128,128).data;
        const gray=Uint8Array.from({length:128*128},(_,i)=>Math.round(.299*data[4*i]+.587*data[4*i+1]+.114*data[4*i+2]));
        const res=await fetch('/api/grind-photo',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:gray});
        if(!res.ok)throw Error();ref.photo=(await res.json()).id;
      }
      if(snapshot!==measurement)return;
      await onReady(ref);
    }catch{status('사진을 저장하지 못했어요. 사진 공유를 끄면 측정값만 담을 수 있어요.');}
    finally{el('grindSave').disabled=el('grindAttach').disabled=false;}
  };
  el('grindAttach').onclick=()=>withMeasurement(async ref=>{await setReference(ref);status('현재 추출 설정에 기준을 적용했어요.');});
  setReference(null);
  return {captureFrame,setReference,withMeasurement,guide:showGuide,get reference(){return reference;}};
})();
