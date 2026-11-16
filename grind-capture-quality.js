// Image sharpness is a focus proxy, not a camera hardware focus lock.
const GrindCaptureQuality = {
  aligned(marker,width,height){
    const h=height*.84,w=h*.55,x=(width-w)/2+.61*w,y=(height-h)/2+.07*h;
    return Math.abs(marker.left-x)<=w*.08 && Math.abs(marker.top-y)<=h*.05 && Math.abs(marker.side-w*.28)<=w*.045;
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
      if(edge>55)strong++;
      const lap=gray(x-1,y)+gray(x+1,y)+gray(x,y-1)+gray(x,y+1)-4*c;
      energy+=lap*lap;total++;
    }
    return total>100 && strong/total>.045 && energy/total>180 ? energy/total : 0;
  }
};
