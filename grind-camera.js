(() => {
  const el=id=>document.getElementById(id);
  const start=el('guideStart'),live=el('guideLive'),video=el('guideVideo'),hint=el('guideHint'),dialog=el('grindDialog');
  const level=el('guideLevel'),levelBubble=level?.querySelector('.guide-level-bubble'),levelReadout=level?.querySelector('.guide-level-readout');
  const probe=document.createElement('canvas');
  probe.width=768;probe.height=960;
  const context=probe.getContext('2d',{willReadFrequently:true});
  const LEVEL_LIMIT=3.5,LEVEL_SPAN=20,LEVEL_TRAVEL=16;
  let stream=null,session=0,timer=0,candidate=null,busy=false;
  let sensorBound=false,sensorActive=false,tilt=null,isLevel=true,beta0=0,gamma0=0;
  function state(name,text,progress=0){live.dataset.state=name;hint.textContent=text;el('guideProgress').value=progress;}
  // 원형 수평계: 센서 값이 없으면 'off'(흐린 한 점), 수평이면 초록, 기울면 앰버.
  function paintLevel(){
    if(!level)return;
    const on=sensorActive&&tilt!=null;
    level.dataset.level=on?(isLevel?'level':'tilt'):'off';
    if(levelReadout)levelReadout.textContent=on?(isLevel?'수평':tilt.toFixed(1)+'°'):'—';
    if(!levelBubble)return;
    if(!on){levelBubble.style.transform='translate(-50%,-50%)';return;}
    const unit=(Math.min(1,tilt/LEVEL_SPAN)*LEVEL_TRAVEL)/(tilt>0.01?tilt:1);
    levelBubble.style.transform='translate(calc(-50% + '+(gamma0*unit).toFixed(1)+'px), calc(-50% + '+(beta0*unit).toFixed(1)+'px))';
  }
  function onTilt(event){
    const beta=event?.beta,gamma=event?.gamma;
    if(typeof beta!=='number'||typeof gamma!=='number'||!Number.isFinite(beta)||!Number.isFinite(gamma))return;
sensorActive=true;beta0=beta;gamma0=gamma;tilt=Math.hypot(beta,gamma);isLevel=tilt<=LEVEL_LIMIT;paintLevel();
  }
  function bindTilt(){
    if(sensorBound)return;
    window.addEventListener('deviceorientation',onTilt);sensorBound=true;
  }
  function unbindTilt(){
    if(sensorBound)window.removeEventListener('deviceorientation',onTilt);
    sensorBound=false;sensorActive=false;tilt=null;isLevel=true;beta0=0;gamma0=0;paintLevel();
  }
  // iOS 13+ Safari는 사용자 제스처 안에서만 권한을 물을 수 있다. 거부·미지원이어도 촬영은 계속된다.
  async function requestTilt(){
    try{
      if(typeof DeviceOrientationEvent==='undefined')return;
      if(typeof DeviceOrientationEvent.requestPermission==='function')await DeviceOrientationEvent.requestPermission();
      bindTilt();
    }catch{}
  }
  function stop(){
    unbindTilt();
    session++;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());
    stream=null;video.srcObject=null;live.hidden=true;candidate=null;busy=false;start.disabled=false;
    el('guideSnap').disabled=false;dialog.classList.remove('camera-active');live.dataset.state='';
  }
  // Same center crop as object-fit:cover in the preview.
  function draw(target,ctx){
    const w=video.videoWidth,h=video.videoHeight,cw=Math.min(w,h*.8),ch=cw/.8;
    ctx.drawImage(video,(w-cw)/2,(h-ch)/2,cw,ch,0,0,target.width,target.height);
  }
  function captureFrame(){
    const frame=document.createElement('canvas');
    frame.height=Math.min(2048,video.videoHeight,Math.floor(video.videoWidth/.8));frame.width=Math.round(frame.height*.8);
    draw(frame,frame.getContext('2d'));
    return frame;
  }
  async function snap(frame){
    if(busy||!stream||video.readyState<2)return;
    busy=true;clearTimeout(timer);const token=session;
    frame ||= candidate?.frame ?? captureFrame();
    el('guideSnap').disabled=true;state('capturing','촬영 완료 · 분쇄도를 분석하고 있어요.',1);
    await new Promise(resolve=>setTimeout(resolve,500));
    if(token!==session)return;
    try{
      // 고해상도 프레임에서 QR을 놓치면 미리보기(768x960) 프레임으로 한 번 더 읽는다.
      const ok=GrindUI.captureFrame(frame)||(!!candidate&&GrindUI.captureFrame(probe));
      stop();start.textContent='다시 촬영';
      if(!ok&&!/QR/.test(el('grindStatus').textContent))el('grindStatus').textContent+=' 가루를 겹치지 않게 놓고 다시 촬영해 주세요.';
      (ok?el('grindResult'):el('grindStatus')).scrollIntoView({block:'nearest'});
    }catch{stop();el('grindStatus').textContent='사진을 분석하지 못했어요. 다시 촬영해 주세요.';}
  }
  function inspect(token){
    if(token!==session||busy)return;
    try{
      // 센서가 실제로 값을 보낼 때만 수평을 요구한다(데스크톱·권한 거부는 기존 그대로).
      if(sensorActive&&!isLevel){
        candidate=null;state('aligning','폰을 수평으로 맞춰 주세요 ('+(tilt??0).toFixed(1)+'°)');return;
      }
      let location=null,image=null,problem='';
      try{
        if(video.readyState<2)throw Error();
        draw(probe,context);
        image=context.getImageData(0,0,probe.width,probe.height);
        location=GrindMarker.locate(image,true);
      }catch(error){problem=error?.message||'';}
      if(!location){
        candidate=null;
        state('aligning',problem.includes('흰 공간')?'카드가 조금 가까워요 · 조금 더 멀리서 맞춰 주세요.':'카드를 흰 선에 맞춰 주세요 · QR은 오른쪽 위');
        return;
      }
      if(!GrindCaptureQuality.aligned(location,probe.width,probe.height)){
        candidate=null;state('aligning',GrindCaptureQuality.guidance(location,probe.width,probe.height));
        return;
      }
      const marker=location.marker,score=GrindCaptureQuality.sharpness(image,marker);
      if(!score){
        candidate=null;state('focusing','QR이 흐려요. 카드를 밝게 비춰 주세요.');
        return;
      }
      const now=performance.now(),previous=candidate;
      const stable=previous && now-previous.lastSeen<500 &&
        Math.hypot(marker.left-previous.marker.left,marker.top-previous.marker.top)<=18 &&
        Math.abs(marker.side-previous.marker.side)<=12;
      if(!stable){
        candidate={marker,firstSeen:now,lastSeen:now,score,frame:captureFrame()};
        state('steadying','QR이 보여요. 잠깐만 유지해 주세요.');
        return;
      }
      candidate.lastSeen=now;
      if(score>candidate.score){
        candidate.score=score;
        candidate.frame=captureFrame();
      }
      const progress=Math.min(1,(now-candidate.firstSeen)/250);
      state('ready','선명해요 · 자동 촬영 중',progress);
      if(progress>=1)void snap(candidate.frame);
    }catch{
      candidate=null;state('aligning','카드를 흰 선에 맞춰 주세요 · QR은 오른쪽 위');
    }finally{
      if(token===session)timer=setTimeout(()=>inspect(token),120);
    }
  }
  start.onclick=async()=>{
    stop();const token=session;start.disabled=true;
    await requestTilt();if(token!==session)return;
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920},aspectRatio:{ideal:4/3}}});
      if(token!==session){acquired.getTracks().forEach(track=>track.stop());return;}
      stream=acquired;live.hidden=false;dialog.classList.add('camera-active');video.srcObject=stream;
      state('aligning','카드를 흰 선에 맞춰 주세요 · QR은 오른쪽 위');
      const track=stream.getVideoTracks()[0];
      if(track.getCapabilities?.().focusMode?.includes('continuous'))track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
      await video.play();if(token!==session)return;dialog.scrollTop=0;inspect(token);
    }catch{if(token!==session)return;stop();el('grindStatus').textContent='카메라 접근을 허용하거나 아래 다른 방법에서 기본 카메라로 촬영해 주세요.';}
  };
  el('guideSnap').onclick=()=>void snap();el('guideStop').onclick=stop;
  dialog.addEventListener('close',stop);
  el('grindMethod').addEventListener('change',()=>{stop();start.hidden=el('grindMethod').value!=='card';});
  for(const id of ['grindFile','grindCamera'])el(id).addEventListener('click',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
})();
