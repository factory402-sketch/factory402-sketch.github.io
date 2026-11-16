(() => {
  const el=id=>document.getElementById(id);
  const start=el('guideStart'),live=el('guideLive'),video=el('guideVideo'),hint=el('guideHint'),dialog=el('grindDialog');
  const probe=document.createElement('canvas');
  probe.width=768;probe.height=960;
  const context=probe.getContext('2d',{willReadFrequently:true});
  let stream=null,session=0,timer=0,candidate=null,busy=false;
  function state(name,text,progress=0){live.dataset.state=name;hint.textContent=text;el('guideProgress').value=progress;}
  function stop(){
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
      const ok=GrindUI.captureFrame(frame);stop();start.textContent='다시 촬영';
      if(!ok)el('grindStatus').textContent+=' 가루를 겹치지 않게 놓고 다시 촬영해 주세요.';
      (ok?el('grindResult'):el('grindStatus')).scrollIntoView({block:'nearest'});
    }catch{stop();el('grindStatus').textContent='사진을 분석하지 못했어요. 다시 촬영해 주세요.';}
  }
  function inspect(token){
    if(token!==session||busy)return;
    try{
      if(video.readyState<2)throw Error();draw(probe,context);
      const image=context.getImageData(0,0,probe.width,probe.height);
      const {marker}=GrindMarker.locate(image,true);
      if(!GrindCaptureQuality.aligned(marker,probe.width,probe.height))throw Error();
      const score=GrindCaptureQuality.sharpness(image,marker);
      if(!score){
        candidate=null;state('focusing','QR이 흐려요. 카드를 밝게 비춰 주세요.');
      }else{
        const now=performance.now();
        const previous=candidate;
        const stable=previous && now-previous.lastSeen<350 &&
          Math.hypot(marker.left-previous.marker.left,marker.top-previous.marker.top)<=9 &&
          Math.abs(marker.side-previous.marker.side)<=6;
        if(!stable){
          candidate={marker,firstSeen:now,lastSeen:now,score,frame:captureFrame()};
        }else{
          candidate.lastSeen=now;
          if(score>candidate.score){
            candidate.score=score;
            candidate.frame=captureFrame();
          }
          const progress=Math.min(1,(now-candidate.firstSeen)/350);
          state('ready','선명해요 · 자동 촬영 중',progress);
          if(progress>=1){void snap(candidate.frame);return;}
        }
        if(!stable)state('steadying','QR이 보여요. 잠깐만 유지해 주세요.');
      }
    }catch{candidate=null;state('aligning','카드를 흰 선에 맞춰 주세요 · QR은 오른쪽 위');}
    timer=setTimeout(()=>inspect(token),120);
  }
  start.onclick=async()=>{
    stop();const token=session;start.disabled=true;
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1920}}});
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
