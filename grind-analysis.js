// Sizes are equivalent-circle diameters of isolated 2D silhouettes. The reported
// percentile is weighted by silhouette area (mass), not by particle count: the same ink
// splits into more pieces at higher capture resolution, so a count median falls as the
// photo gets sharper while the area-weighted D50 stays put (real card: 1.39x -> 1.03x).
const GrindAnalysis = (() => {
  // Recipes saved before v3.2 counted particles; their numbers are not comparable.
  const METRIC='area-v1';
  // Under 120 µm a speck is paper grain, a print dot or a JPEG artefact rather than
  // coffee: it is <1% of the ink area on a card photo, so dropping it leaves D50 alone.
  const NOISE_UM=120;
  // The same guard in pixels, so a photo where the grind is only a few pixels wide is
  // still refused instead of being reported as very fine.
  const MIN_WEIGHTED_PX=4;
  function measure(image, mmPerPixel) {
    const {width:w,height:h,data}=image;
    if (!(mmPerPixel>0) || !Number.isFinite(mmPerPixel)) throw Error('자의 두 눈금을 다시 지정하세요.');
    if (w<40 || h<40) throw Error('가루가 있는 영역을 더 넓게 선택하세요.');
    const gray=new Uint8Array(w*h), hist=new Uint32Array(256);
    let total=0;
    for(let i=0;i<gray.length;i++){
      const j=i*4, level=Math.round(.299*data[j]+.587*data[j+1]+.114*data[j+2]);
      gray[i]=level;hist[level]++;total+=level;
    }
    let best=0,threshold=0,weight=0,sum=0;
    for(let t=0;t<255;t++){
      weight+=hist[t];sum+=t*hist[t];
      const other=gray.length-weight;
      if(!weight || !other)continue;
      const score=weight*other*(sum/weight-(total-sum)/other)**2;
      if(score>best){best=score;threshold=t;}
    }
    if(!best)throw Error('입자와 흰 배경을 구분할 수 없어요.');
    // Otsu can split the paper's own shading when the ground is sparse. Keep the
    // threshold below the paper level so a light gradient is not read as particles.
    let median=0,enough=0;
    for(let t=0;t<256;t++){enough+=hist[t];if(enough>=gray.length/2){median=t;break;}}
    threshold=Math.min(threshold,median-24);
    if(threshold<8)threshold=8;
    const mask=gray.map(v=>v<=threshold?1:0);
    const dark=mask.reduce((a,b)=>a+b,0);
    const darkSum=hist.slice(0,threshold+1).reduce((sum,count,level)=>sum+count*level,0);
    const lightMean=(total-darkSum)/(gray.length-dark);
    if(lightMean<115 || lightMean-darkSum/dark<26)throw Error('밝은 곳에서 흰 종이와 가루가 뚜렷하게 보이도록 다시 촬영해 주세요.');
    if(dark/gray.length>.40)throw Error('가루를 더 얇게 흩어 놓고 흰 종이만 배경에 담아 주세요.');
    const queue=new Int32Array(w*h),diameters=[],areas=[],marks=[];
    for(let i=0;i<mask.length;i++){
      if(!mask[i])continue;
      let head=0,tail=1,edge=false,minX=w,maxX=0,minY=h,maxY=0;
      queue[0]=i;mask[i]=0;
      while(head<tail){
        const p=queue[head++],x=p%w,y=Math.floor(p/w);
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        if(!x||!y||x===w-1||y===h-1)edge=true;
        for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++){
          for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
            const n=yy*w+xx;if(mask[n]){mask[n]=0;queue[tail++]=n;}
          }
        }
      }
      const bw=maxX-minX+1,bh=maxY-minY+1;
      if(edge||tail<4||Math.max(bw,bh)>5*Math.min(bw,bh))continue;
      const d=2*Math.sqrt(tail/Math.PI);
      if(d*mmPerPixel*1000<NOISE_UM)continue;
      diameters.push(d);areas.push(tail);marks.push([minX,minY,bw,bh]);
    }
    if(diameters.length<20)throw Error('분리되어 보이는 입자가 20개 미만이에요. 가루를 조금 더 넓게 흩어 놓고 다시 찍어주세요.');
    const n=diameters.length;
    // Walk the diameters from fine to coarse, adding area, and read the size at which
    // the accumulated area passes the wanted share of the total ink.
    const order=diameters.map((_,index)=>index).sort((a,b)=>diameters[a]-diameters[b]);
    let ink=0;
    for(let index=0;index<n;index++)ink+=areas[index];
    const weighted=p=>{
      let acc=0;
      for(const index of order){
        acc+=areas[index];
        if(acc>=ink*p)return diameters[index];
      }
      return diameters[order[n-1]];
    };
    if(weighted(.5)<MIN_WEIGHTED_PX)throw Error('입자가 너무 작게 찍혔어요. 더 가까이서 선명하게 촬영해 주세요.');
    const micron=p=>Math.round(weighted(p)*mmPerPixel*1000);
    return {n,lo:micron(.1),mid:micron(.5),hi:micron(.9),marks,metric:METRIC};
  }
  function valid(ref){
    return ref && [ref.lo,ref.mid,ref.hi,ref.n].every(Number.isSafeInteger) &&
      ref.lo>0 && ref.lo<=ref.mid && ref.mid<=ref.hi && ref.hi<100000 &&
      ref.n>=20 && ref.n<=1000000 && (!ref.photo||/^[a-f0-9]{64}$/.test(ref.photo)) &&
      typeof ref.note==='string' && ref.note.length<=60;
  }
  // An older recipe still loads and shows its own numbers, but it may not be compared
  // with an area-weighted measurement.
  const current=ref=>valid(ref)&&ref.metric===METRIC;
  return {measure, valid, current, METRIC};
})();
