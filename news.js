(()=>{
const list=document.getElementById('newsList'),status=document.getElementById('newsStatus');let posts=[],category='전체';
function render(){list.replaceChildren();const visible=posts.filter(p=>category==='전체'||p.category===category).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||b.date.localeCompare(a.date));status.textContent=visible.length?'':'아직 등록된 소식이 없습니다.';for(const p of visible){const item=document.createElement('details');item.className='news-post';const summary=document.createElement('summary');const meta=document.createElement('span');meta.className='news-meta';meta.textContent=(p.pinned?'고정 · ':'')+p.category+' · '+p.date.replaceAll('-','.');const title=document.createElement('strong');title.textContent=p.title;summary.append(meta,title);const body=document.createElement('div');body.className='news-body';const text=document.createElement('p');text.textContent=p.body;body.append(text);if(p.link){const a=document.createElement('a');const url=new URL(p.link);if(url.protocol==='https:'){a.href=url.href;a.rel='noopener noreferrer';a.textContent=p.linkLabel+' ↗';body.append(a);}}item.append(summary,body);list.append(item);}}
document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
status.textContent='소식을 불러오는 중입니다.';fetch('news.json').then(r=>{if(!r.ok)throw Error('load');return r.json();}).then(data=>{posts=data;
const latest=[...posts].sort((a,b)=>b.date.localeCompare(a.date))[0];
document.getElementById('latestHeadline').textContent=latest?.title || '전체 소식 보기';
render();}).catch(()=>{status.textContent='소식을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';});
})();
