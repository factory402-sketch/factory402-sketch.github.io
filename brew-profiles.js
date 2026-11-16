const BrewProfiles = {
  ultra: {
    name:'울트라 라이트 로스팅',
    values:[15,245,4,45,30,70],
    note:'96~98°C · 코만단테 C40 18~21클릭부터 조정 · 목표 2:50~3:15',
    hints:['45g을 붓고 충분히 적신 뒤 스월링, 45초 뜸','75g을 원형으로 붓기 · 초반 교반','65g을 낮은 물줄기로 부드럽게 붓기','60g을 중앙 위주로 붓고 가볍게 스월링'],
    plan(total){
      const amounts=[45,75,65,60], times=[0,45,75,110];
      let previous=0;
      const rows=amounts.map((amount,i)=>{
        const cumulative=Math.round(amounts.slice(0,i+1).reduce((a,b)=>a+b,0)/245*total*100)/100;
        const row={at:times[i],amount:Math.round((cumulative-previous)*100)/100,total:cumulative};
        previous=cumulative;return row;
      });
      return {rows,end:180};
    }
  }
};
window.activeBrewProfile=null;

window.BrewProfilesForTimer=BrewProfiles;
