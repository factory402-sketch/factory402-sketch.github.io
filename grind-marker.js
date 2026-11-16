// The printed fiducial has a 10 mm black square and a centered 4 mm white opening.
const GrindMarker = (() => {
  function locate({width,height,data},recipeCard=false) {
    const total=width*height;
    const dark=new Uint8Array(total);
    for(let i=0;i<total;i++){
      const k=i*4;
      dark[i]=(.299*data[k]+.587*data[k+1]+.114*data[k+2])<105?1:0;
    }
    const seen=new Uint8Array(total),queue=new Int32Array(total),matches=[];
    for(let i=0;i<total;i++){
      if(!dark[i]||seen[i])continue;
      let left=width,right=0,top=height,bottom=0,start=0,end=1;
      queue[0]=i;seen[i]=1;
      while(start<end){
        const p=queue[start++],x=p%width,y=Math.floor(p/width);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        function visit(n){if(dark[n]&&!seen[n]){seen[n]=1;queue[end++]=n;}}
        if(x>0)visit(p-1);
        if(x+1<width)visit(p+1);
        if(y>0)visit(p-width);
        if(y+1<height)visit(p+width);
      }
      const w=right-left+1,h=bottom-top+1;
      if(recipeCard){
        const fill=end/(w*h);
        if(w<12||h<12||Math.abs(w/h-1)>.18||fill<.28||fill>.62)continue;
        const ink=(u,v)=>dark[(top+Math.floor(v*h))*width+left+Math.floor(u*w)];
        const axis=[.065,.22,.5,.78,.935];
        if(axis.every((t,i)=>ink(t,.5)===(i%2===0?1:0)&&ink(.5,t)===(i%2===0?1:0))){
          matches.push({x:left+w/2,y:top+h/2,w,h});
        }
        continue;
      }
      if(w<40||h<40||left===0||right===width-1||top===0||bottom===height-1||Math.abs(w/h-1)>.12)continue;
      if(end/(w*h)<.72||end/(w*h)>.90)continue;
      // Check both the hollow center and the surrounding ring at multiple positions.
      let correct=true;
      for(const u of [.12,.22,.4,.5,.6,.78,.88]){
        for(const v of [.12,.22,.4,.5,.6,.78,.88]){
          const ring=u<.3||u>.7||v<.3||v>.7;
          if(Boolean(dark[(top+Math.floor(v*h))*width+left+Math.floor(u*w)])!==ring)correct=false;
        }
      }
      if(correct)matches.push({left,top,w,h,side:Math.sqrt(end/.84)});
    }
    if(recipeCard)return cardRegion(matches,width,height);
    if(matches.length!==1)throw Error(matches.length?'기준 네모 한 개만 보이도록 다시 촬영해 주세요.':'기준 네모를 찾지 못했어요. 검은 테두리와 흰 중심이 선명하게 보이도록 수평으로 가까이 찍어주세요.');
    const marker=matches[0],side=marker.side;
    const x=Math.ceil(marker.left+marker.w+.1*side), y=Math.max(0,Math.round(marker.top-.9*side));
    const w=Math.min(width-x,Math.round(3.2*side)),h=Math.min(height-y,Math.round(marker.top+1.9*side)-y);
    if(w<side||h<side)throw Error('네모 오른쪽에 가루가 들어갈 여백을 두고 다시 찍어주세요.');
    return {marker,x,y,w,h,mmPerPixel:10/side};
  }
  function cardRegion(finders,width,height){
    const solutions=[];
    for(const a of finders){
      const near=finders.filter(f=>Math.abs(f.w/a.w-1)<.19&&Math.abs(f.h/a.h-1)<.19);
      for(const b of near){
        const dx=b.x-a.x;
        if(dx<2*a.w||dx>11*a.w||Math.abs(b.y-a.y)>.09*dx)continue;
        for(const c of near){
          const dy=c.y-a.y;
          if(Math.abs(dy/dx-1)>.09||Math.abs(c.x-a.x)>.09*dy)continue;
          const w=dx+(a.w+b.w)/2,h=dy+(a.h+c.h)/2;
          solutions.push({left:a.x-a.w/2,top:a.y-a.h/2,w,h,side:(w+h)/2});
        }
      }
    }
    if(solutions.length!==1)throw Error('카드 QR 한 개가 오른쪽 위에 선명하게 보이도록 카드를 세로로 세워 다시 찍어주세요.');
    const marker=solutions[0],{left,top,side}=marker;
    // Inset from the logo, the printed footer and the sides of the white card.
    const x=Math.ceil(left-1.67*side),y=Math.ceil(top+1.32*side);
    const w=Math.round(2.5*side),h=Math.round(3.35*side);
    if(x<0||y<0||x+w>width||y+h>height)throw Error('카드 가운데 흰 공간도 사진 안에 들어오게 찍어주세요.');
    return {marker,x,y,w,h,mmPerPixel:15/side};
  }
  return {locate};
})();
