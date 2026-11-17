// The printed fiducial has a 10 mm black square and a centered 4 mm white opening.
// A photographed card is never perfectly lit, so the ink test adapts: a dark
// QR printed on cream paper can read 100~150 in indoor light.
const GrindMarker = (() => {
  // Five steps instead of three: a real print sits right on one step's edge, and a
  // single step of difference decides whether the finder rings stay separate.
  const INK_LEVELS=[110,121,132,141,152];
  let preferred=INK_LEVELS[0];
  // The retry flag says whether another ink step can plausibly change the result.
  const fail=(message,retry)=>Object.assign(Error(message),{tryLooserInk:!!retry});
  function locate(image,recipeCard=false){
    const {width,height,data}=image,total=width*height;
    const gray=new Uint8Array(total);
    for(let i=0;i<total;i++){
      const k=i*4;
      gray[i]=(.299*data[k]+.587*data[k+1]+.114*data[k+2])|0;
    }
    const order=[preferred,...INK_LEVELS.filter(level=>level!==preferred)];
    const dark=new Uint8Array(total);
    let last=null,blocked=null;
    for(const level of order){
      for(let i=0;i<total;i++)dark[i]=gray[i]<level?1:0;
      try{
        const found=locateAt(dark,width,height,recipeCard);
        preferred=level;
        return found;
      }catch(error){
        // A geometry limit (the ground area falls outside the photo) does not improve
        // on another ink step, so it is kept as the message even if later steps fail.
        if(!error.tryLooserInk)blocked=error;
        last=error;
      }
    }
    throw blocked||last;
  }
  function locateAt(dark,width,height,recipeCard){
    const total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total),matches=[];
    for(let i=0;i<total;i++){
      if(!dark[i]||seen[i])continue;
      let left=width,right=0,top=height,bottom=0,start=0,end=1;
      queue[0]=i;seen[i]=1;
      while(start<end){
        const p=queue[start++],x=p%width,y=(p-x)/width;
        if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
        if(x>0&&dark[p-1]&&!seen[p-1]){seen[p-1]=1;queue[end++]=p-1;}
        if(x+1<width&&dark[p+1]&&!seen[p+1]){seen[p+1]=1;queue[end++]=p+1;}
        if(y>0&&dark[p-width]&&!seen[p-width]){seen[p-width]=1;queue[end++]=p-width;}
        if(y+1<height&&dark[p+width]&&!seen[p+width]){seen[p+width]=1;queue[end++]=p+width;}
      }
      const w=right-left+1,h=bottom-top+1,area=end,fill=area/(w*h);
      if(recipeCard){
        // QR finder: a square dark ring around a light gap and a dark core.
        if(w<12||h<12||Math.abs(w/h-1)>.26||fill<.22||fill>.80)continue;
        if(!finderShape(dark,width,left,top,w,h))continue;
        matches.push({x:left+w/2,y:top+h/2,w,h,left,top});
        continue;
      }
      if(w<40||h<40||left===0||right===width-1||top===0||bottom===height-1||Math.abs(w/h-1)>.12)continue;
      if(fill<.72||fill>.90)continue;
      // Check both the hollow center and the surrounding ring at multiple positions.
      let correct=true;
      for(const u of [.12,.22,.4,.5,.6,.78,.88]){
        for(const v of [.12,.22,.4,.5,.6,.78,.88]){
          const ring=u<.3||u>.7||v<.3||v>.7;
          if(Boolean(dark[(top+Math.floor(v*h))*width+left+Math.floor(u*w)])!==ring)correct=false;
        }
      }
      if(correct)matches.push({left,top,w,h,side:Math.sqrt(area/.84)});
    }
    if(recipeCard)return cardRegion(dark,width,height,matches);
    if(matches.length!==1)throw fail(matches.length?'기준 네모 한 개만 보이도록 다시 촬영해 주세요.':'기준 네모를 찾지 못했어요. 검은 테두리와 흰 중심이 선명하게 보이도록 수평으로 가까이 찍어주세요.',true);
    const marker=matches[0],side=marker.side;
    const x=Math.ceil(marker.left+marker.w+.1*side), y=Math.max(0,Math.round(marker.top-.9*side));
    const w=Math.min(width-x,Math.round(3.2*side)),h=Math.min(height-y,Math.round(marker.top+1.9*side)-y);
    if(w<side||h<side)throw Error('네모 오른쪽에 가루가 들어갈 여백을 두고 다시 찍어주세요.');
    return {marker,x,y,w,h,mmPerPixel:10/side};
  }
  // Run-length test along three lines of the finder: dark 1 : light 1 : dark 3 : light 1 : dark 1.
  // A printed ring loses a pixel here and there, so two of the three lines are enough, and
  // the center pair on its own still passes as before.
  const SCAN_LINES=[.5,.35,.65];
  function finderShape(dark,width,left,top,w,h){
    let rows=0,cols=0,centerRow=false,centerCol=false;
    for(let i=0;i<SCAN_LINES.length;i++){
      const y=top+Math.round(SCAN_LINES[i]*(h-1));
      if(runPattern(n=>dark[y*width+n],left,left+w-1)){rows++;if(!i)centerRow=true;}
    }
    if(rows<2&&!centerRow)return false;
    for(let i=0;i<SCAN_LINES.length;i++){
      const x=left+Math.round(SCAN_LINES[i]*(w-1));
      if(runPattern(n=>dark[n*width+x],top,top+h-1)){cols++;if(!i)centerCol=true;}
    }
    if(cols<2&&!centerCol)return false;
    return (centerRow&&centerCol)||(rows>=2&&cols>=2);
  }
  function runPattern(at,from,to){
    const runs=[];
    let current=at(from)?1:0,length=0;
    for(let i=from;i<=to;i++){
      const value=at(i)?1:0;
      if(value===current)length++;
      else{runs.push([current,length]);current=value;length=1;}
    }
    runs.push([current,length]);
    // Drop one-pixel breaks (print dots, JPEG ringing) before reading the ratios.
    const span=to-from+1,tol=span>=28?Math.max(1,Math.round(span*.02)):0;
    for(let guard=runs.length;tol&&guard>0&&runs.length>1;guard--){
      let cut=-1;
      for(let i=0;i<runs.length;i++)if(runs[i][1]<=tol){cut=i;break;}
      if(cut<0)break;
      if(!cut)runs[1][1]+=runs[0][1];
      else if(cut===runs.length-1)runs[cut-1][1]+=runs[cut][1];
      else runs[runs[cut-1][1]>=runs[cut+1][1]?cut-1:cut+1][1]+=runs[cut][1];
      runs.splice(cut,1);
    }
    while(runs.length&&!runs[0][0])runs.shift();
    while(runs.length&&!runs[runs.length-1][0])runs.pop();
    if(runs.length!==5)return false;
    const [edgeA,,core,,edgeB]=runs;
    if(!edgeA[0]||!edgeB[0]||!(runs[1][0]===0&&runs[2][0]===1&&runs[3][0]===0))return false;
    const edge=(edgeA[1]+edgeB[1])/2;
    if(edge<1||core[1]<2)return false;
    if(Math.min(edgeA[1],edgeB[1])/Math.max(edgeA[1],edgeB[1])<.45)return false;
    const ratio=core[1]/edge;
    if(ratio<2.1||ratio>4.8)return false;
    for(const gap of [runs[1][1],runs[3][1]]){
      const g=gap/edge;
      if(g<.4||g>1.9)return false;
    }
    return true;
  }
  function cardRegion(dark,width,height,finders){
    const solutions=[];
    for(const a of finders){
      const near=finders.filter(f=>Math.abs(f.w/a.w-1)<.24&&Math.abs(f.h/a.h-1)<.24);
      for(const b of near){
        const dx=b.x-a.x;
        if(dx<2*a.w||dx>11*a.w||Math.abs(b.y-a.y)>.12*dx)continue;
        for(const c of near){
          const dy=c.y-a.y;
          if(dy<2*a.h||Math.abs(dy/dx-1)>.12||Math.abs(c.x-a.x)>.12*dy)continue;
          const w=dx+(a.w+b.w)/2,h=dy+(a.h+c.h)/2;
          solutions.push({a,b,c,left:a.left,top:a.top,w,h,side:(w+h)/2});
        }
      }
    }
    if(!solutions.length)throw fail('카드 QR 한 개가 오른쪽 위에 선명하게 보이도록 카드를 세로로 세워 다시 찍어주세요.',true);
    // Coffee specks and printed letters can look like a finder, so a frame can yield
    // several readings. Take the one that behaves most like the card's QR instead of
    // sending the user back for another shot.
    let best=solutions[0],bestScore=Infinity;
    for(const solution of solutions){
      const score=solutionScore(dark,width,height,solution);
      if(score<bestScore){best=solution;bestScore=score;}
    }
    const marker=best,{left,top,side}=marker;
    // Inset from the logo, the printed footer and the sides of the white card.
    const x=Math.ceil(left-1.67*side),y=Math.ceil(top+1.32*side);
    const w=Math.round(2.5*side),h=Math.round(3.35*side);
    if(x<0||y<0||x+w>width||y+h>height)throw fail('카드 가운데 흰 공간도 사진 안에 들어오게 찍어주세요.',false);
    return {marker,x,y,w,h,mmPerPixel:15/side};
  }
  function solutionScore(dark,width,height,solution){
    const {a,b,c,side}=solution;
    let score=Math.abs(solution.w/solution.h-1)+.3*(Math.abs(b.w-a.w)+Math.abs(c.w-a.w))/a.w;
    // The 25-module QR is about half dark in its data area; a triple of stray specks is not.
    const ratio=moduleRatio(dark,width,height,a,side);
    if(ratio==null)return score+1;
    return score+2*Math.abs(ratio-.45);
  }
  function moduleRatio(dark,width,height,corner,side){
    const ms=side/25;
    const x0=Math.round(corner.left+8.5*ms),y0=Math.round(corner.top+8.5*ms);
    const x1=Math.round(corner.left+side-1.5*ms),y1=Math.round(corner.top+side-1.5*ms);
    if(x1-x0<8||y1-y0<8||x0<0||y0<0||x1>width||y1>height)return null;
    let on=0,count=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){on+=dark[y*width+x];count++;}
    return count?on/count:null;
  }
  return {locate};
})();
