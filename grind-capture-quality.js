// Image sharpness is a focus proxy, not a camera hardware focus lock.
const GrindCaptureQuality = {
  frame(width,height){
    const h=height*.84,w=h*.55;
    return {x:(width-w)/2,y:(height-h)/2,w,h};
  },
  aligned(location,width,height){
    const marker=location.marker||location;
    const frame=this.frame(width,height),{w,h}=frame;
    if(Math.abs(marker.left-(frame.x+.61*w))>w*.15)return false;
    if(Math.abs(marker.top-(frame.y+.07*h))>h*.12)return false;
    if(Math.abs(marker.side-w*.28)>w*.10)return false;
    // The ground area has to be inside the guide, otherwise the photo cannot be measured.
    if(Number.isFinite(location.x)&&Number.isFinite(location.y)){
      const margin=Math.min(w,h)*.02;
      if(location.x<frame.x-margin||location.y<frame.y-margin)return false;
      if(location.x+location.w>frame.x+w+margin||location.y+location.h>frame.y+h+margin)return false;
    }
    return true;
  },
  // Where to move the card, for the live guide text.
  guidance(location,width,height){
    const marker=location.marker||location;
    const frame=this.frame(width,height),{w,h}=frame;
    const dx=marker.left-(frame.x+.61*w),dy=marker.top-(frame.y+.07*h),size=marker.side/(w*.28);
    if(Math.abs(dx)>w*.15)return dx<0?'카드를 오른쪽으로 옮겨 주세요.':'카드를 왼쪽으로 옮겨 주세요.';
    if(Math.abs(dy)>h*.12)return dy<0?'카드를 아래로 내려 주세요.':'카드를 위로 올려 주세요.';
    if(size<.85)return '카드를 조금 더 가까이 대주세요.';
    if(size>1.15)return '카드를 조금 더 멀리 대주세요.';
    if(Number.isFinite(location.y)&&location.y+location.h>frame.y+h)return '카드를 조금 더 멀리 대주세요.';
    return '카드를 흰 선 안에 맞춰 주세요 · QR은 오른쪽 위';
  },
  sharp({data,width,height},marker){
    return this.sharpness({data,width,height}, marker) > 0;
  },
  sharpness({data,width,height},marker){
    const x0=Math.max(1,Math.ceil(marker.left)),y0=Math.max(1,Math.ceil(marker.top));
    const x1=Math.min(width-1,Math.floor(marker.left+marker.side)),y1=Math.min(height-1,Math.floor(marker.top+marker.side));
    const gray=(x,y)=>{const i=4*(y*width+x);return (data[i]+data[i+1]+data[i+2])/3;};
    let strong=0,total=0,energy=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const c=gray(x,y),edge=Math.max(Math.abs(c-gray(x+1,y)),Math.abs(c-gray(x,y+1)));
      if(edge>45)strong++;
      const lap=gray(x-1,y)+gray(x+1,y)+gray(x,y-1)+gray(x,y+1)-4*c;
      energy+=lap*lap;total++;
    }
    return total>100 && strong/total>.02 && energy/total>85 ? energy/total : 0;
  }
};
