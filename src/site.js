/* Couloirs Arabes — site layer: URL state, scroll-spy, progress, mobile tabs,
   share sheet, live results polling, table cards. Runs after the app script and
   reads its globals (LANG, POOL, CITY, RECPOOL, RESULTS, COTE_UPDATED, renderAll…). */
(function(){
'use strict';
const SITE = window.CA_SITE || {url: location.origin};
const L = {
  fr:{share:"Partager",share_t:"Partager cette page",copy:"Copier le lien",copied:"Lien copié",close:"Fermer",top:"Haut de page",
      live:"En direct",new_res:"Nouveaux résultats",new_res_d:n=>`${n} nouvelle(s) ligne(s) dans Résultats.`,upd:"Mise à jour"},
  ar:{share:"مشاركة",share_t:"مشاركة هذه الصفحة",copy:"نسخ الرابط",copied:"تم نسخ الرابط",close:"إغلاق",top:"أعلى الصفحة",
      live:"مباشر",new_res:"نتائج جديدة",new_res_d:n=>`${n} سطر(أسطر) جديدة في النتائج.`,upd:"تحديث"}
};
const l = k => L[LANG==='ar'?'ar':'fr'][k];
const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICON = {
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  pekin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><circle cx="15" cy="6" r="2"/><path d="M5 13l5-4 4 3"/></svg>',
  cote:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  palmares:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6"/></svg>',
  records:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  legendes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/></svg>'
};

/* ---------- language from path, in-place switch with pushState ---------- */
function pathLang(){return /^\/ar(\/|$)/.test(location.pathname)?'ar':'fr';}
function langURL(lg){return (lg==='ar'?'/ar/':'/')+location.search+location.hash;}
function setLang(lg,push){
  if(LANG!==lg){LANG=lg; try{localStorage.setItem('ca-lang',lg)}catch(e){} renderAll();}
  if(push) history.pushState(null,'',langURL(lg));
  document.title = t('brand')+' — '+(lg==='ar'?'السبّاحون العرب في بطولات العالم للسباحة':'Les nageurs arabes aux Mondiaux de natation');
  decorate();
}
$('#btn-fr').onclick=()=>setLang('fr',true);
$('#btn-ar').onclick=()=>setLang('ar',true);
addEventListener('popstate',()=>{setLang(pathLang(),false); readURL(); renderAll(); decorate();});

/* ---------- URL state: ?pool=&nat=&city=&rec=&bj=&q= ---------- */
function readURL(){
  const p=new URLSearchParams(location.search);
  const pool=p.get('pool'); if(['all','LC','SC'].includes(pool)) POOL=pool;
  const rec=p.get('rec'); if(['LC','SC'].includes(rec)) RECPOOL=rec;
  const city=p.get('city'); CITY = city && MEDALS.some(m=>m[2]===city) ? city : null;
  const nat=p.get('nat'), bj=p.get('bj'), q=p.get('q');
  renderAll();
  if(nat && $(`#f-med-nat option[value="${nat}"]`)){$('#f-med-nat').value=nat;}
  if(bj && $(`#f-bj-nat option[value="${bj}"]`)){$('#f-bj-nat').value=bj;}
  if(q) $('#f-bj-q').value=q;
  $$('#seg-pool button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===POOL));
  $$('#seg-rec button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===RECPOOL));
  renderBJ(); renderPie(); renderMedals(); renderMedPie(); renderRecords();
}
function writeURL(){
  const p=new URLSearchParams();
  if(POOL!=='all') p.set('pool',POOL);
  const nat=$('#f-med-nat').value; if(nat&&nat!=='all') p.set('nat',nat);
  if(CITY) p.set('city',CITY);
  if(RECPOOL!=='SC') p.set('rec',RECPOOL);
  const bj=$('#f-bj-nat').value; if(bj&&bj!=='all') p.set('bj',bj);
  const q=$('#f-bj-q').value.trim(); if(q) p.set('q',q);
  const s=p.toString(); const url=location.pathname+(s?'?'+s:'')+location.hash;
  if(url!==location.pathname+location.search+location.hash) history.replaceState(null,'',url);
}
let wt; const queueWrite=()=>{clearTimeout(wt); wt=setTimeout(()=>{writeURL(); decorate();},60);};
document.addEventListener('click',e=>{if(e.target.closest('#seg-pool,#seg-rec,#wmap,#wchips,#f-city')) queueWrite();});
document.addEventListener('change',e=>{if(e.target.matches('select')) queueWrite();});
document.addEventListener('input',e=>{if(e.target.id==='f-bj-q') queueWrite();});

/* ---------- chrome: progress, tools, tabs, share sheet, top button, toasts ---------- */
document.body.insertAdjacentHTML('afterbegin','<div id="ca-progress" aria-hidden="true"></div>');
document.body.insertAdjacentHTML('beforeend',`
<nav id="ca-tabs" aria-label="Navigation">
  ${['pekin','cote','palmares','records','legendes'].map(id=>`<a href="#${id}" data-s="${id}">${ICON[id]}<span></span></a>`).join('')}
</nav>
<div id="ca-share" role="dialog" aria-modal="true" aria-labelledby="ca-share-t"><div class="sheet">
  <h3 id="ca-share-t"></h3><p id="ca-share-u"></p><div class="grid">
    <a data-net="x" target="_blank" rel="noopener">X</a><a data-net="fb" target="_blank" rel="noopener">Facebook</a><a data-net="wa" target="_blank" rel="noopener">WhatsApp</a>
    <a data-net="li" target="_blank" rel="noopener">LinkedIn</a><a data-net="tg" target="_blank" rel="noopener">Telegram</a><button data-net="copy"></button>
  </div><button class="ca-btn close"></button></div></div>
<button id="ca-top" aria-label="">↑</button>
<div id="ca-toasts" aria-live="polite"></div>`);
const tools=document.createElement('div'); tools.className='tools';
tools.innerHTML=`<span class="ca-live" id="ca-live"><i></i><b></b></span><button class="ca-btn" id="ca-share-btn">${ICON.share}<span></span></button>`;
const langBox=$('.issue .lang'); langBox.parentNode.insertBefore(tools,langBox); tools.appendChild(langBox);

const tabNames={pekin:'nav_bj',cote:'nav_cote',palmares:'nav_med',records:'nav_rec',legendes:'nav_leg'};
function decorate(){
  $$('#ca-tabs a').forEach(a=>a.querySelector('span').textContent=t(tabNames[a.dataset.s]));
  $('#ca-share-btn span').textContent=l('share');
  $('#ca-share-t').textContent=l('share_t');
  $('[data-net="copy"]').textContent=l('copy');
  $('#ca-share .close').textContent=l('close');
  $('#ca-top').setAttribute('aria-label',l('top'));
  $('#ca-live b').textContent=l('live');
  labelTables();
}

function shareData(){
  const sec=current? $('#'+current+' h2'):null;
  return {title:document.title, text:(sec?sec.textContent.trim()+' · ':'')+t('brand'), url:location.href};
}
async function openShare(){
  const d=shareData();
  if(navigator.share && matchMedia('(pointer:coarse)').matches){try{await navigator.share(d);return;}catch(e){if(e.name==='AbortError')return;}}
  const u=encodeURIComponent(d.url), tx=encodeURIComponent(d.text);
  const nets={x:`https://twitter.com/intent/tweet?url=${u}&text=${tx}`,fb:`https://www.facebook.com/sharer/sharer.php?u=${u}`,
    wa:`https://wa.me/?text=${tx}%20${u}`,li:`https://www.linkedin.com/sharing/share-offsite/?url=${u}`,tg:`https://t.me/share/url?url=${u}&text=${tx}`};
  $$('#ca-share a[data-net]').forEach(a=>a.href=nets[a.dataset.net]);
  $('#ca-share-u').textContent=d.url;
  $('#ca-share').classList.add('on'); $('#ca-share .close').focus();
}
const closeShare=()=>$('#ca-share').classList.remove('on');
$('#ca-share-btn').onclick=openShare;
$('#ca-share .close').onclick=closeShare;
$('#ca-share').addEventListener('click',e=>{if(e.target.id==='ca-share')closeShare();});
addEventListener('keydown',e=>{if(e.key==='Escape')closeShare();});
$('[data-net="copy"]').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);}catch(e){} toast(l('copied')); closeShare();};
$('#ca-top').onclick=()=>scrollTo({top:0,behavior:reduce?'auto':'smooth'});

function toast(title,body){
  const el=document.createElement('div'); el.className='ca-toast'; el.innerHTML=`<b></b>${body?'<span></span>':''}`;
  el.querySelector('b').textContent=title; if(body) el.querySelector('span').textContent=body;
  $('#ca-toasts').appendChild(el); setTimeout(()=>el.remove(),6000);
}

/* ---------- scroll: progress bar, sticky shadow, scroll-spy, reveal ---------- */
const bar=$('#ca-progress'), issue=$('.issue'), topBtn=$('#ca-top');
let ticking=false;
addEventListener('scroll',()=>{if(ticking)return; ticking=true; requestAnimationFrame(()=>{
  const h=document.documentElement, max=h.scrollHeight-h.clientHeight;
  bar.style.transform=`scaleX(${max>0?Math.min(1,h.scrollTop/max):0})`;
  issue.classList.toggle('stuck',issue.getBoundingClientRect().top<=1 && h.scrollTop>40);
  topBtn.classList.toggle('on',h.scrollTop>900);
  ticking=false;});},{passive:true});

const setMast=()=>document.documentElement.style.setProperty('--ca-mast',-$('.mast').offsetHeight+'px');
setMast(); addEventListener('resize',setMast); document.fonts&&document.fonts.ready.then(setMast);
let current=null;
const sections=$$('section.page');
const spy=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){current=e.target.id; markNav();}});
},{rootMargin:'-45% 0px -50% 0px'});
sections.forEach(s=>spy.observe(s));
function markNav(){
  $$('nav.sections a, #ca-tabs a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+current));
  const want=location.pathname+location.search+(current?'#'+current:'');
  if(want!==location.pathname+location.search+location.hash) history.replaceState(null,'',want);
}
if(!reduce && 'IntersectionObserver' in window){
  document.documentElement.classList.add('js-reveal');
  const rv=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen'); rv.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
  sections.forEach(s=>rv.observe(s));
  // anything already above the fold or targeted by a deep link shows at once
  if(location.hash){const tg=document.getElementById(location.hash.slice(1)); if(tg) tg.classList.add('seen');}
}

/* ---------- tables become cards on phones (cells get their header as label) ---------- */
function labelTables(){
  $$('.tbl').forEach(box=>{
    const tb=box.querySelector('table.data'); if(!tb) return;
    if(tb.querySelector('td[rowspan]')){box.classList.remove('cards');return;}
    const heads=$$('thead th',tb).map(th=>th.textContent.trim());
    $$('tbody tr',tb).forEach(tr=>[...tr.cells].forEach((td,i)=>td.setAttribute('data-label',heads[i]||'')));
    box.classList.add('cards');
  });
}
new MutationObserver(()=>{clearTimeout(labelTables.t); labelTables.t=setTimeout(labelTables,30);})
  .observe($('main'),{childList:true,subtree:true});

/* ---------- live results: /data/results.json polled every 5 min ---------- */
const LIVE_FROM=Date.UTC(2026,11,1,0,0), LIVE_TO=Date.UTC(2026,11,6,15,0);
function liveNow(){const n=Date.now(); return n>=LIVE_FROM && n<=LIVE_TO;}
async function pullResults(first){
  try{
    const r=await fetch('/data/results.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return;
    const j=await r.json(); if(!Array.isArray(j.results)) return;
    const before=RESULTS.length;
    if(j.results.length!==before || (j.updated||'')!==COTE_UPDATED){
      RESULTS=j.results; COTE_UPDATED=j.updated||'';
      renderCote(); decorate();
      if(!first && j.results.length>before) toast(l('new_res'), l('new_res_d')(j.results.length-before));
    }
  }catch(e){}
}
$('#ca-live').classList.toggle('on',liveNow());
pullResults(true);
setInterval(()=>{ $('#ca-live').classList.toggle('on',liveNow()); if(!document.hidden) pullResults(false); }, liveNow()?5*60e3:30*60e3);
document.addEventListener('visibilitychange',()=>{if(!document.hidden && liveNow()) pullResults(false);});

/* ---------- boot ---------- */
if(LANG!==pathLang()){LANG=pathLang(); renderAll();}
readURL();
setLang(LANG,false);
if(location.hash){const tg=document.getElementById(location.hash.slice(1));
  if(tg){const go=()=>tg.scrollIntoView({block:'start'}); go(); (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(go,50)); addEventListener('load',()=>setTimeout(go,50),{once:true});}}
})();
