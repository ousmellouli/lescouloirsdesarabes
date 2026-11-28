/* Toute la Natation Arabe — site layer: URL state, scroll-spy, progress, mobile tabs,
   share sheet, live results polling, table cards. Runs after the app script and
   reads its globals (LANG, POOL, CITY, RECPOOL, RESULTS, COTE_UPDATED, renderAll…). */
(function(){
'use strict';
const SITE = window.CA_SITE || {url: location.origin};
const L = {
  fr:{share:"Partager",share_t:"Partager cette page",copy:"Copier le lien",copied:"Lien copié",close:"Fermer",top:"Haut de page",menu:"Menu",menu_t:"Toutes les rubriques",
      live:"En direct",new_res:"Nouveaux résultats",new_res_d:n=>`${n} nouvelle(s) ligne(s) dans Résultats.`,upd:"Mise à jour"},
  ar:{share:"مشاركة",share_t:"مشاركة هذه الصفحة",copy:"نسخ الرابط",copied:"تم نسخ الرابط",close:"إغلاق",top:"أعلى الصفحة",menu:"القائمة",menu_t:"كل الأقسام",
      live:"مباشر",new_res:"نتائج جديدة",new_res_d:n=>`${n} سطر(أسطر) جديدة في النتائج.`,upd:"تحديث"}
};
const l = k => L[LANG==='ar'?'ar':'fr'][k];
const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICON = {
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  pekin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><circle cx="15" cy="6" r="2"/><path d="M5 13l5-4 4 3"/></svg>',
  programme:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h3M14 14h3M7 17.5h3"/></svg>',
  engagements:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3.2-5.5 6.5-5.5s6 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.1 4.5 1.8 5 4.9"/></svg>',
  cote:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  palmares:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6"/></svg>',
  records:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  legendes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/></svg>'
};

/* ---------- language from path, in-place switch with pushState ---------- */
const BASE=(SITE.base||'');
const ROOT=(SITE.root!=null?SITE.root:BASE+'/');
/* multi-page mode: each section is its own page (SITE.pages = {order:[ids], url:{ar:{id:url},fr:{id:url}}}) */
const PAGES=SITE.pages||null, PAGE=document.documentElement.getAttribute('data-page');
const MULTI=!!(PAGES&&PAGE);
const pageURL=(id,lg)=>PAGES.url[lg||(LANG==='ar'?'ar':'fr')][id];
function pathLang(){
  if(MULTI){const here=location.pathname; for(const lg of ['fr','ar']) if(Object.values(PAGES.url[lg]).some(u=>new URL(u,location.href).pathname===here)) return lg; return LANG;}
  return location.pathname.slice(BASE.length).startsWith('/fr')?'fr':'ar';}
function langURL(lg){return MULTI? pageURL(PAGE,lg)+location.search : BASE+(lg==='fr'?'/fr/':'/')+location.search+location.hash;}
function setLang(lg,push){
  if(LANG!==lg){LANG=lg; try{localStorage.setItem('ca-lang',lg)}catch(e){} renderAll();}
  if(push) history.pushState(null,'',langURL(lg));
  const sec=MULTI&&PAGE!=='home'?document.getElementById(PAGE):null, h2=sec&&(PAGE==='contact'?CT[lg].title:(sec.querySelector('h2')||{}).textContent);
  document.title = h2 ? h2.trim()+' — '+t('brand') : t('brand')+' — '+(lg==='ar'?'السبّاحون العرب في بطولات العالم للسباحة':'Les nageurs arabes aux Mondiaux de natation');
  decorate(); contactLang(); visitsLang();
}
$('#btn-fr').onclick=()=>setLang('fr',true);
$('#btn-ar').onclick=()=>setLang('ar',true);
addEventListener('popstate',()=>{setLang(pathLang(),false); readURL(); renderAll(); decorate();});

/* ---------- URL state: ?pool=&nat=&city=&rec=&bj=&q= ---------- */
function readURL(){
  const p=new URLSearchParams(location.search);
  const pool=p.get('pool'); if(['all','LC','SC','OW'].includes(pool)) POOL=pool;
  const rec=p.get('rec'); if(['LC','SC'].includes(rec)) RECPOOL=rec;
  const city=p.get('city'); CITY = city && MEDALS.some(m=>m[2]===city) ? city : null;
  const sw=p.get('sw'); ATH = sw && MEDALS.some(m=>m[4]===sw) ? sw : null;
  const nat=p.get('nat'), bj=p.get('bj'), q=p.get('q');
  renderAll();
  if(nat && $(`#f-med-nat option[value="${nat}"]`)){$('#f-med-nat').value=nat;}
  if(bj && $(`#f-bj-nat option[value="${bj}"]`)){$('#f-bj-nat').value=bj;}
  if(q) $('#f-bj-q').value=q;
  const g=p.get('g'); if(g==='M'||g==='W') GEN=g;
  $$('#seg-pool button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===POOL));
  $$('#seg-rec button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===RECPOOL));
  renderBJ(); renderPie(); if(typeof renderGBar==='function') renderGBar(); renderMedals(); renderMedPie(); renderRecords();
}
function writeURL(){
  const p=new URLSearchParams();
  if(POOL!=='all') p.set('pool',POOL);
  const nat=$('#f-med-nat').value; if(nat&&nat!=='all') p.set('nat',nat);
  if(CITY) p.set('city',CITY);
  if(ATH) p.set('sw',ATH);
  if(RECPOOL!=='SC') p.set('rec',RECPOOL);
  const bj=$('#f-bj-nat').value; if(bj&&bj!=='all') p.set('bj',bj);
  const q=$('#f-bj-q').value.trim(); if(q) p.set('q',q);
  if(typeof GEN!=='undefined'&&GEN) p.set('g',GEN);
  const s=p.toString(); const url=location.pathname+(s?'?'+s:'')+location.hash;
  if(url!==location.pathname+location.search+location.hash) history.replaceState(null,'',url);
}
let wt; const queueWrite=()=>{clearTimeout(wt); wt=setTimeout(()=>{writeURL(); decorate();},60);};
document.addEventListener('click',e=>{if(e.target.closest('#seg-pool,#seg-rec,#wmap,#wchips,#f-city')) queueWrite();});
document.addEventListener('click',e=>{if(e.target.closest('#gbar,#bj-filt,#ath-list,#f-ath')) queueWrite();},true);
document.addEventListener('change',e=>{if(e.target.matches('select')) queueWrite();});
document.addEventListener('input',e=>{if(e.target.id==='f-bj-q') queueWrite();});

/* ---------- chrome: progress, tools, tabs, share sheet, top button, toasts ---------- */
document.body.insertAdjacentHTML('afterbegin','<div id="ca-progress" aria-hidden="true"></div>');
document.body.insertAdjacentHTML('beforeend',`
<nav id="ca-tabs" aria-label="Navigation">
  ${['pekin','programme','engagements','cote','palmares','records','legendes'].map(id=>`<a href="#${id}" data-s="${id}" data-pg="${id}">${ICON[id]}<span></span></a>`).join('')}
</nav>
<div id="ca-share" role="dialog" aria-modal="true" aria-labelledby="ca-share-t"><div class="sheet">
  <h3 id="ca-share-t"></h3><p id="ca-share-u"></p><div class="grid">
    <a data-net="x" target="_blank" rel="noopener">X</a><a data-net="fb" target="_blank" rel="noopener">Facebook</a><a data-net="wa" target="_blank" rel="noopener">WhatsApp</a>
    <a data-net="li" target="_blank" rel="noopener">LinkedIn</a><a data-net="tg" target="_blank" rel="noopener">Telegram</a><button data-net="copy"></button>
  </div><button class="ca-btn close"></button></div></div>
<div id="ca-menu" role="dialog" aria-modal="true" aria-labelledby="ca-menu-t"><div class="sheet"><h3 id="ca-menu-t"></h3><nav class="list"></nav><button class="ca-btn close"></button></div></div>
<button id="ca-top" aria-label="">↑</button>
<div id="ca-toasts" aria-live="polite"></div>`);
const tools=document.createElement('div'); tools.className='tools';
tools.innerHTML=`<span class="ca-live" id="ca-live"><i></i><b></b></span><button class="ca-btn" id="ca-menu-btn" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span></span></button><button class="ca-btn" id="ca-share-btn">${ICON.share}<span></span></button>`;
const langBox=$('.issue .lang'); langBox.parentNode.insertBefore(tools,langBox); tools.appendChild(langBox);

/* shorter labels for the 7-tab phone bar */
const TAB_SHORT={fr:{pekin:'Pékin'},ar:{records:'الأرقام'}};
const tabNames={pekin:'nav_bj',programme:'nav_prog',engagements:'nav_eng',cote:'nav_cote',palmares:'nav_med',records:'nav_rec',legendes:'nav_leg'};
function decorate(){
  const TS=TAB_SHORT[LANG==='ar'?'ar':'fr'];
  $$('#ca-tabs a').forEach(a=>a.querySelector('span').textContent=TS[a.dataset.s]||t(tabNames[a.dataset.s]));
  $('#ca-share-btn span').textContent=l('share');
  $('#ca-menu-btn span').textContent=l('menu'); $('#ca-menu-t').textContent=l('menu_t'); $('#ca-menu .close').textContent=l('close');
  $('#ca-share-t').textContent=l('share_t');
  $('[data-net="copy"]').textContent=l('copy');
  $('#ca-share .close').textContent=l('close');
  $('#ca-top').setAttribute('aria-label',l('top'));
  $('#ca-live b').textContent=l('live');
  labelTables(); fixLinks();
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
/* phone: full section menu (the tab bar only holds 7 sections) */
function openMenu(){
  const list=$('#ca-menu .list'); list.innerHTML='';
  $$('nav.sections a').forEach(a=>{const c=a.cloneNode(true); c.id=''; list.appendChild(c);});
  $('#ca-menu').classList.add('on'); (list.querySelector('[aria-current]')||list.querySelector('a')||$('#ca-menu .close')).focus();
}
const closeMenu=()=>$('#ca-menu').classList.remove('on');
$('#ca-menu-btn').onclick=openMenu;
$('#ca-menu .close').onclick=closeMenu;
$('#ca-menu').addEventListener('click',e=>{if(e.target.id==='ca-menu'||e.target.closest('#ca-menu .list a'))closeMenu();});
addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
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
buildContact();
let current=MULTI&&PAGE!=='home'?PAGE:null;
const sections=$$('section.page');
const spy=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){current=e.target.id; markNav();}});
},{rootMargin:'-45% 0px -50% 0px'});
if(!MULTI) sections.forEach(s=>spy.observe(s));
function markNav(){
  if(MULTI){$$('nav.sections [data-pg], #ca-tabs [data-pg]').forEach(a=>a.setAttribute('aria-current',a.dataset.pg===PAGE)); return;}
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
  if(MULTI) sections.forEach(s=>s.classList.add('seen'));
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
    const r=await fetch(ROOT+'data/results.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return;
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

/* ---------- contact / corrections form ---------- */
const CONTACT_API='https://tlna-contact.ousmellouli.workers.dev/submit';
const TS_KEY='0x4AAAAAAGUd2zpvILL23V1G';
const CT={
  fr:{nav:"Contact",eyebrow:"Le courrier des lecteurs",title:"Proposer une correction",
      intro:"Un temps erroné, un nageur oublié, une information à compléter sur votre équipe ou votre pays ? Écrivez-nous : chaque proposition est lue par la rédaction et vérifiée avant publication.",
      type:"Objet",types:{time:"Correction d'un temps ou d'un résultat",swimmer:"Nageur ou nageuse manquant(e)",team:"Information sur une équipe ou un pays",other:"Autre remarque"},
      name:"Votre nom",email:"Votre e-mail (pour vous répondre)",country:"Pays ou équipe concerné(e)",none:"—",
      subject:"Nageur, nageuse ou épreuve",subject_ph:"ex. Ahmed Hafnaoui, 400 m nage libre",
      change:"Votre proposition",change_ph:"Décrivez la correction ou l'ajout, avec le bon temps si possible.",
      source:"Lien vers une source",source_ph:"https://… (résultats officiels, article, fédération)",
      send:"Envoyer",sending:"Envoi…",ok:"Merci ! Votre proposition a bien été reçue. La rédaction vous répondra si besoin.",
      err:"L'envoi a échoué. Réessayez ou écrivez à contact@toutelanatationarabe.com.",err_captcha:"Vérification anti-robot non validée. Réessayez.",
      err_rate:"Trop d'envois depuis votre connexion. Réessayez dans une heure.",err_empty:"Décrivez votre proposition (5 caractères au moins).",
      mail:"Vous pouvez aussi écrire directement à",rep:"Signaler une erreur",privacy:"Vos coordonnées servent uniquement à vous répondre."},
  ar:{nav:"اتصل بنا",eyebrow:"بريد القرّاء",title:"اقترح تصحيحاً",
      intro:"زمن خاطئ، أو سبّاح منسيّ، أو معلومة ناقصة عن فريقك أو بلدك؟ راسلنا: تقرأ هيئة التحرير كل اقتراح وتتحقق منه قبل النشر.",
      type:"الموضوع",types:{time:"تصحيح زمن أو نتيجة",swimmer:"سبّاح أو سبّاحة غير مذكور(ة)",team:"معلومة عن فريق أو بلد",other:"ملاحظة أخرى"},
      name:"اسمك",email:"بريدك الإلكتروني (للرد عليك)",country:"البلد أو الفريق المعني",none:"—",
      subject:"السبّاح أو السبّاحة أو السباق",subject_ph:"مثال: أحمد الحفناوي، 400م حرة",
      change:"اقتراحك",change_ph:"صف التصحيح أو الإضافة، مع الزمن الصحيح إن أمكن.",
      source:"رابط إلى مصدر",source_ph:"https://… (نتائج رسمية، مقال، اتحاد)",
      send:"إرسال",sending:"جارٍ الإرسال…",ok:"شكراً! وصل اقتراحك. ستردّ عليك هيئة التحرير عند الحاجة.",
      err:"تعذّر الإرسال. حاول مجدداً أو راسل contact@toutelanatationarabe.com.",err_captcha:"لم يكتمل التحقق من أنك لست روبوتاً. حاول مجدداً.",
      err_rate:"عدد كبير من الإرسالات من اتصالك. حاول بعد ساعة.",err_empty:"صف اقتراحك (5 أحرف على الأقل).",
      mail:"يمكنك أيضاً الكتابة مباشرة إلى",rep:"الإبلاغ عن خطأ",privacy:"تُستخدم بياناتك للرد عليك فقط."}
};
const c=k=>CT[LANG==='ar'?'ar':'fr'][k];
const escH=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const FLAG_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
function buildContact(){
  const sec=document.createElement('section'); sec.className='page'; sec.id='contact';
  sec.innerHTML=`<div class="wrap">
  <div class="runhead"><span class="pg">10</span><span class="sl">/</span><span class="ttl" data-c="nav"></span></div>
  <div class="kicker" data-c="eyebrow"></div><h2 class="big" data-c="title"></h2><p class="standfirst" data-c="intro"></p>
  <form id="ca-form" class="ca-form" novalidate>
    <label class="full"><span data-c="type"></span><select name="type" required></select></label>
    <label><span data-c="name"></span><input name="name" maxlength="120" autocomplete="name"></label>
    <label><span data-c="email"></span><input name="email" type="email" maxlength="200" autocomplete="email" dir="ltr"></label>
    <label><span data-c="country"></span><select name="country"></select></label>
    <label><span data-c="subject"></span><input name="subject" maxlength="300"></label>
    <label class="full"><span data-c="change"></span><textarea name="change" rows="6" maxlength="5000" required></textarea></label>
    <label class="full"><span data-c="source"></span><input name="source" type="url" maxlength="500" dir="ltr"></label>
    <div class="full ca-form-end"><div id="ca-ts"></div><button type="submit" class="ca-send" data-c="send"></button></div>
    <p class="full ca-msg" id="ca-msg" role="status" aria-live="polite"></p>
    <p class="full ca-mail"><span data-c="mail"></span> <a href="mailto:contact@toutelanatationarabe.com" dir="ltr">contact@toutelanatationarabe.com</a>. <span data-c="privacy"></span></p>
  </form></div>`;
  const src=$('#sources'); src.parentNode.insertBefore(sec,src.nextSibling);
  const nav=$('nav.sections'); if(nav){const a=document.createElement('a');a.href='#contact';a.dataset.c='nav';a.dataset.pg='contact';nav.appendChild(a);}
  const old=document.getElementById('fab-art'); if(old) old.remove();
  const fab=document.createElement('a'); fab.id='ca-fab'; fab.className='fab-contact'; fab.href='#contact'; fab.dataset.pg='contact'; if(MULTI&&PAGE==='contact') fab.hidden=true;
  fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg><span data-c="nav"></span>'; document.body.appendChild(fab);
  const foot=$('footer .wrap'); if(foot){const p=document.createElement('p');p.className='ca-foot-contact';p.innerHTML=`<a href="#contact" data-c="title" data-pg="contact"></a> · <a href="mailto:contact@toutelanatationarabe.com" dir="ltr">contact@toutelanatationarabe.com</a>`;foot.appendChild(p);}
  $('#ca-form').addEventListener('submit',sendContact);
}
function contactLang(){
  $$('[data-c]').filter(e=>!e.closest('#wmap,#wchips')).forEach(e=>e.textContent=c(e.dataset.c));
  const f=$('#ca-form'); if(!f) return;
  const ty=f.type.value||'time'; f.type.innerHTML=Object.entries(c('types')).map(([k,v])=>`<option value="${k}">${escH(v)}</option>`).join(''); f.type.value=ty;
  const co=f.country.value; const ar=LANG==='ar';
  f.country.innerHTML=`<option value="">${c('none')}</option>`+Object.keys(NATIONS).sort((a,b)=>NATIONS[a][ar?1:0].localeCompare(NATIONS[b][ar?1:0],ar?'ar':'fr')).map(k=>`<option value="${k}">${escH(NATIONS[k][ar?1:0])}</option>`).join('')+`<option value="other">${ar?'آخر':'Autre'}</option>`;
  f.country.value=co;
  f.subject.placeholder=c('subject_ph'); f.change.placeholder=c('change_ph'); f.source.placeholder=c('source_ph');
  $$('.ca-rep').forEach(b=>{b.title=c('rep');b.setAttribute('aria-label',c('rep'));});
  if(tsReady) renderTS();
}
/* Turnstile, loaded only when the form comes near the screen */
let tsReady=false, tsId=null, tsLoading=false;
window.caTsLoad=()=>{tsReady=true; renderTS();};
function loadTS(){ if(tsLoading) return; tsLoading=true; const s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=caTsLoad'; s.async=true; document.head.appendChild(s); }
function renderTS(){ if(!window.turnstile) return; if(tsId!==null){try{turnstile.remove(tsId)}catch(e){}} tsId=turnstile.render('#ca-ts',{sitekey:TS_KEY,language:LANG==='ar'?'ar':'fr',theme:'light',size:'flexible'}); }
async function sendContact(ev){
  ev.preventDefault(); const f=ev.target, msg=$('#ca-msg'), btn=f.querySelector('.ca-send');
  const say=(k,ok)=>{msg.textContent=c(k);msg.className='full ca-msg '+(ok?'ok':'bad');};
  if(f.change.value.trim().length<5){say('err_empty');f.change.focus();return;}
  if(f.email.value && !f.email.checkValidity()){f.email.reportValidity();return;}
  const token=window.turnstile&&tsId!==null?turnstile.getResponse(tsId):'';
  if(!token){loadTS(); say('err_captcha'); return;}
  btn.disabled=true; btn.textContent=c('sending'); msg.textContent='';
  const data={lang:LANG,type:f.type.value,name:f.name.value,email:f.email.value,country:f.country.value?(NATIONS[f.country.value]?NATIONS[f.country.value][0]+' ('+f.country.value+')':f.country.value):'',subject:f.subject.value,change:f.change.value,source:f.source.value,page:location.href,token};
  try{
    const r=await fetch(CONTACT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok){say('ok',true); f.subject.value='';f.change.value='';f.source.value='';}
    else say(j.error==='captcha'?'err_captcha':j.error==='rate'?'err_rate':j.error==='empty'?'err_empty':'err');
  }catch(e){say('err');}
  btn.disabled=false; btn.textContent=c('send'); if(window.turnstile&&tsId!==null) turnstile.reset(tsId);
}
/* "Signaler une erreur" buttons that prefill the form */
function txt(e){return e?e.textContent.replace(/\s+/g,' ').trim():'';}
function addRep(host,info){ if(!host||host.querySelector(':scope > .ca-rep')) return; const b=document.createElement('button'); b.type='button'; b.className='ca-rep'; b.innerHTML=FLAG_SVG; b.title=c('rep'); b.setAttribute('aria-label',c('rep')); b._info=info; host.appendChild(b); }
function markReports(){
  $$('#t-rec-m tbody tr, #t-rec-w tbody tr').forEach(tr=>{const td=tr.cells; if(td.length<4) return; addRep(td[td.length-1],()=>({type:'time',country:txt(td[3].querySelector('.nat'))||'',subject:`${txt(td[2]).replace(/\s*(Pékin 2026|بكين 2026)$/,'')} — ${txt(td[0])} — ${txt(td[1])}`}));});
  $$('#t-med tbody tr').forEach(tr=>{const td=tr.cells; if(td.length<8) return; addRep(td[td.length-1],()=>({type:'time',country:txt(td[4].querySelector('.nat')),subject:`${txt(td[3])} — ${txt(td[5])} — ${txt(td[1])} ${txt(td[0])} — ${txt(td[7])}`}));});
  $$('#fiches .fiche').forEach(a=>addRep(a,()=>({type:'other',subject:txt(a.querySelector('h3'))})));
  $$('#lgrid .lcard').forEach(a=>addRep(a,()=>({type:'other',country:txt(a.querySelector('.nat')),subject:txt(a.querySelector('h3'))})));
  $$('#ngrid .ncard').forEach(a=>addRep(a,()=>({type:'team',country:txt(a.querySelector('.nat'))})));
}
document.addEventListener('click',e=>{
  const b=e.target.closest('.ca-rep'); if(!b||!b._info) return; e.preventDefault();
  const i=b._info();
  if(MULTI&&PAGE!=='contact'){try{sessionStorage.setItem('ca-prefill',JSON.stringify(i));}catch(e){} location.href=pageURL('contact'); return;}
  prefill(i);
});
function prefill(i){
  const f=$('#ca-form'); f.type.value=i.type||'other';
  const cc=(i.country||'').trim(); f.country.value=NATIONS[cc]?cc:''; f.subject.value=i.subject||'';
  $('#contact').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); loadTS();
  setTimeout(()=>f.change.focus({preventScroll:true}),reduce?0:600);
}
let repT=0; new MutationObserver(()=>{clearTimeout(repT);repT=setTimeout(markReports,60);}).observe($('main')||document.body,{childList:true,subtree:true});
markReports();
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){loadTS();io.disconnect();}},{rootMargin:'600px'});io.observe($('#contact'));} else loadTS();

/* ---------- multi-page: home table of contents, prev/next pager, links ---------- */
const PG_INFO={pekin:['02','nav_bj','bj_card','bj_eyebrow'],programme:['03','nav_prog','prog_title','prog_eyebrow'],engagements:['04','nav_eng','eng_card','eng_eyebrow'],classement:['05','nav_rank','rank_card','rank_eyebrow'],cote:['06','nav_cote','cote_card','cote_intro'],palmares:['07','nav_med','med_card','med_eyebrow'],
  nations:['08','nav_nat','nat_card','nat_eyebrow'],records:['09','nav_rec','rec_title','rec_eyebrow'],legendes:['10','nav_leg','leg_title','leg_eyebrow'],
  finales:['11','nav_fin','fin_title','fin_eyebrow'],sources:['12','nav_src','src_title','src_eyebrow'],contact:['13','*nav','*title','*eyebrow']};
const PL={fr:{home:'Accueil',toc:'Au sommaire',toc_s:'Chaque rubrique a sa propre page.',prev:'Précédent',next:'Suivant',read:'Lire'},
          ar:{home:'الرئيسية',toc:'في هذا العدد',toc_s:'لكل قسم صفحته الخاصة.',prev:'السابق',next:'التالي',read:'اقرأ'}};
const pl=k=>PL[LANG==='ar'?'ar':'fr'][k];
const tk=k=>k[0]==='*'?c(k.slice(1)):t(k);
function plain(h){const d=document.createElement('div'); d.innerHTML=h; return d.textContent;}
function buildPages(){
  document.body.classList.add('ca-multi');
  const nav=$('nav.sections');
  if(nav){const a=document.createElement('a'); a.href='#'; a.dataset.pg='home'; a.dataset.pl='home'; nav.insertBefore(a,nav.firstChild);}
  const brand=$('.brand'); if(brand && !brand.closest('a')){const a=document.createElement('a'); a.className='ca-brand-link'; a.dataset.pg='home'; brand.parentNode.insertBefore(a,brand); a.appendChild(brand);}
  if(PAGE==='home'){
    const front=$('main > .wrap'); const toc=document.createElement('div'); toc.className='wrap ca-toc';
    toc.innerHTML=`<div class="ca-toc-h"><span class="lbl" data-pl="toc"></span></div><div class="ca-toc-g">${PAGES.order.filter(id=>id!=='home').map(id=>
      `<a class="ca-card" data-pg="${id}" href="#${id}"><span class="pg">${PG_INFO[id][0]}</span><span class="k" data-tk="${PG_INFO[id][1]}"></span><b data-tk="${PG_INFO[id][2]}"></b><span class="d" data-tk="${PG_INFO[id][3]}"></span><span class="go"><span data-pl="read"></span> <i>→</i></span></a>`).join('')}</div>`;
    front.parentNode.insertBefore(toc,front.nextSibling);
  } else {
    const sec=document.getElementById(PAGE); const ord=PAGES.order, i=ord.indexOf(PAGE);
    const lnk=(id,dir)=>!id?'<span></span>':`<a class="ca-pg ${dir}" data-pg="${id}" href="#${id}"><small data-pl="${dir}"></small>${id==='home'?'<b data-pl="home"></b>':`<b data-tk="${PG_INFO[id][1]}"></b>`}</a>`;
    if(sec){const p=document.createElement('nav'); p.className='ca-pager'; p.setAttribute('aria-label','Pages'); p.innerHTML=lnk(ord[i-1],'prev')+lnk(ord[i+1],'next'); sec.querySelector('.wrap').appendChild(p);}
  }
}
function fixLinks(){
  if(!MULTI) return;
  $$('[data-pg]').forEach(a=>{const u=pageURL(a.dataset.pg); if(u) a.setAttribute('href',u);});
  $$('[data-pl]').forEach(e=>e.textContent=pl(e.dataset.pl));
  $$('[data-tk]').forEach(e=>{e.textContent=plain(tk(e.dataset.tk));});
}

/* ---------- visitor counter + map (worker tlna-stats, country level, no cookies) ---------- */
const STATS_API='https://tlna-stats.ousmellouli.workers.dev';
const LIVE_HOST=/(^|\.)toutelanatationarabe\.com$/.test(location.hostname);
const VS={fr:{visitors:'visiteurs',visitor:'visiteur',views:'pages vues',countries:'pays',map:'Voir la carte',title:'D’où viennent nos lecteurs',
    eyebrow:'Les visiteurs',today:'aujourd’hui',since:d=>`Depuis le ${d}`,top:'Pays les plus représentés',none:'Aucune visite enregistrée pour l’instant.',
    note:'Comptage anonyme par pays, sans cookie. Un visiteur = un navigateur.',other:'Autres / inconnu',demo:'Aperçu avec des chiffres fictifs'},
  ar:{visitors:'زائر',visitor:'زائر',views:'صفحة مشاهَدة',countries:'دولة',map:'خريطة الزوار',title:'من أين يأتي قرّاؤنا',
    eyebrow:'الزوار',today:'اليوم',since:d=>`منذ ${d}`,top:'أكثر الدول زيارةً',none:'لا توجد زيارات مسجّلة بعد.',
    note:'إحصاء مجهول الهوية حسب الدولة، بدون ملفات تعريف الارتباط. الزائر = متصفح واحد.',other:'أخرى / غير معروف',demo:'معاينة بأرقام وهمية'}};
const vs=k=>VS[LANG==='ar'?'ar':'fr'][k];
/* number + noun with Arabic plural rules (1, 2, 3-10, 11+); French: singular for 0-1 */
const AR_PL={visitors:['زائر','زائران','زوار','زائراً'],countries:['دولة','دولتان','دول','دولة'],views:['صفحة مشاهَدة','صفحتان مشاهَدتان','صفحات مشاهَدة','صفحة مشاهَدة']};
const FR_SG={visitors:'visiteur',countries:'pays',views:'page vue'};
function vsn(k,n){ n=Number(n||0);
  if(LANG!=='ar') return n<=1?FR_SG[k]:vs(k);
  const f=AR_PL[k], m=n%100; return n===1?f[0]:n===2?f[1]:(m>=3&&m<=10)?f[2]:f[3]; }
const nf=n=>Number(n||0).toLocaleString(LANG==='ar'?'ar-u-nu-latn':'fr-FR');
let VDATA=null, VMAP=null;
const DEMO={visitors:12480,views:41230,today:{visitors:612,views:1904},since:'2026-11-26',demo:1,
  countries:[['TN',3920,13100],['DZ',1710,5200],['EG',1390,4300],['MA',1120,3500],['SA',820,2600],['FR',760,2700],['QA',410,1300],['AE',380,1200],['KW',300,900],['JO',260,800],['LB',230,700],['US',220,650],['CN',210,700],['IQ',180,520],['OM',150,430],['BH',120,380],['LY',110,300],['DE',95,260],['CA',90,240],['SY',85,230],['PS',80,220],['GB',75,210],['IT',60,170],['SD',40,110],['ES',35,90]]};
function countVisit(){
  if(!LIVE_HOST) return;
  let n=0; try{ if(!localStorage.getItem('tlna_v')){ n=1; localStorage.setItem('tlna_v','1'); } }catch(e){}
  try{ fetch(STATS_API+'/hit',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({n}),keepalive:true}).catch(()=>{}); }catch(e){}
}
async function loadVisits(){
  if(!LIVE_HOST){VDATA=DEMO; return;}
  try{ const r=await fetch(STATS_API+'/stats'); if(r.ok) VDATA=await r.json(); }catch(e){}
}
function buildVisits(){
  const f=$('footer .wrap'); if(!f||$('#ca-visits')) return;
  f.insertAdjacentHTML('beforeend',`<div id="ca-visits" class="ca-visits" hidden><span class="n"><b id="ca-vn">—</b> <span id="ca-vl"></span></span><span class="s" id="ca-vs"></span><button type="button" class="ca-vbtn" id="ca-vbtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span></span></button></div>`);
  document.body.insertAdjacentHTML('beforeend',`<div id="ca-vmap" role="dialog" aria-modal="true" aria-labelledby="ca-vmap-t"><div class="sheet"><span class="lbl" id="ca-vmap-e"></span><h3 id="ca-vmap-t"></h3><p class="kpis" id="ca-vmap-k"></p><div class="map" id="ca-vmap-m"></div><div class="legend" id="ca-vmap-g"></div><h4 id="ca-vmap-h"></h4><ol id="ca-vmap-l"></ol><p class="note" id="ca-vmap-n"></p><button class="ca-btn close" id="ca-vmap-x"></button></div></div>`);
  $('#ca-vbtn').onclick=openVMap; $('#ca-vmap-x').onclick=closeVMap;
  $('#ca-vmap').addEventListener('click',e=>{if(e.target.id==='ca-vmap')closeVMap();});
  addEventListener('keydown',e=>{if(e.key==='Escape')closeVMap();});
}
function cname(cc){const n=VMAP&&VMAP.n[cc]; return cc==='XX'||!n?vs('other'):(LANG==='ar'?n[1]:n[0])||cc;}
function visitsLang(){
  const box=$('#ca-visits'); if(!box) return;
  if(!VDATA){box.hidden=true; return;} box.hidden=false;
  $('#ca-vn').textContent=nf(VDATA.visitors);
  $('#ca-vl').textContent=vsn('visitors',VDATA.visitors);
  const nc=VDATA.countries.filter(c=>c[0]!=='XX'&&c[1]>0).length;
  $('#ca-vs').textContent=`${nf(nc)} ${vsn('countries',nc)} · ${nf(VDATA.today.visitors)} ${vs('today')}`+(VDATA.demo?` · ${vs('demo')}`:'');
  $('#ca-vbtn span').textContent=vs('map');
  if($('#ca-vmap').classList.contains('on')) renderVMap();
}
const VCOL=['#DCE8F2','#B7CDE0','#7FA9CC','#3F7FB5','#00569C','#003254'];
function bucket(v,max){ if(!v) return -1; const r=Math.log(v+1)/Math.log(max+1); return Math.min(VCOL.length-1,Math.floor(r*VCOL.length)); }
function renderVMap(){
  const d=VDATA, AR=LANG==='ar';
  $('#ca-vmap-e').textContent=vs('eyebrow')+(d.demo?' · '+vs('demo'):'');
  $('#ca-vmap-t').textContent=vs('title');
  const nc=d.countries.filter(c=>c[0]!=='XX'&&c[1]>0).length;
  $('#ca-vmap-k').innerHTML=[[d.visitors,vsn('visitors',d.visitors)],[d.views,vsn('views',d.views)],[nc,vsn('countries',nc)],[d.today.visitors,vsn('visitors',d.today.visitors)+' '+vs('today')]].map(([n,l])=>`<span><b>${nf(n)}</b>${escH(l)}</span>`).join('');
  $('#ca-vmap-h').textContent=vs('top');
  $('#ca-vmap-n').textContent=vs('note')+' '+vs('since')(d.since.split('-').reverse().join('/'))+'.';
  $('#ca-vmap-x').textContent=l('close');
  if(!VMAP){$('#ca-vmap-m').innerHTML='<div class="ld"></div>'; return;}
  const by={}; d.countries.forEach(c=>by[c[0]]=c[1]);
  const max=Math.max(1,...d.countries.filter(c=>c[0]!=='XX').map(c=>c[1]));
  const [vx,vy,vw,vh]=VMAP.vb;
  const tip=cc=>`${cname(cc)} · ${nf(by[cc]||0)} ${vsn('visitors',by[cc]||0)}`;
  let s=`<svg viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="${escH(vs('title'))}">`;
  for(const [cc,p] of Object.entries(VMAP.c)){const b=bucket(by[cc],max); s+=`<path d="${p}" fill="${b<0?'#ECEBE7':VCOL[b]}" stroke="#fff" stroke-width=".5"><title>${escH(tip(cc))}</title></path>`;}
  for(const [cc,[x,y]] of Object.entries(VMAP.p)){ if(!by[cc]) continue; const b=bucket(by[cc],max); s+=`<circle cx="${x}" cy="${y}" r="4" fill="${VCOL[b]}" stroke="#fff" stroke-width="1"><title>${escH(tip(cc))}</title></circle>`;}
  $('#ca-vmap-m').innerHTML=s+'</svg>';
  const lows=[]; VCOL.forEach((c,i)=>{const v=Math.max(1,Math.ceil(Math.pow(max+1,i/VCOL.length)-1-1e-9)); if(v<=max&&bucket(v,max)===i&&!lows.some(x=>x[1]===v)) lows.push([i,v]);});
  $('#ca-vmap-g').innerHTML=lows.map(([i,v],k)=>{const nx=lows[k+1]; const lab=nx?(nx[1]-1>v?`${nf(v)}–${nf(nx[1]-1)}`:nf(v)):(v<max?`${nf(v)}–${nf(max)}`:nf(v)); return `<span><i style="background:${VCOL[i]}"></i>${lab}</span>`;}).join('');
  const top=d.countries.filter(c=>c[1]>0).slice(0,12);
  $('#ca-vmap-l').innerHTML=top.length?top.map(c=>`<li><span class="c">${escH(cname(c[0]))}</span><span class="bar"><i style="width:${(100*c[1]/top[0][1]).toFixed(1)}%"></i></span><b>${nf(c[1])}</b></li>`).join(''):`<li class="none">${escH(vs('none'))}</li>`;
}
async function openVMap(){
  $('#ca-vmap').classList.add('on'); renderVMap(); $('#ca-vmap-x').focus();
  if(!VMAP){ try{ const r=await fetch(ROOT+'visitors-map.json'); VMAP=await r.json(); }catch(e){} renderVMap(); }
}
const closeVMap=()=>{const m=$('#ca-vmap'); if(m) m.classList.remove('on');};

/* ---------- boot ---------- */
if(MULTI && location.hash){const h=location.hash.slice(1); if(PAGES.order.includes(h) && h!==PAGE){location.replace(pageURL(h,pathLang())+location.search); return;}}
if(MULTI) buildPages();
if(LANG!==pathLang()){LANG=pathLang(); renderAll();}
buildVisits();
readURL();
setLang(LANG,false);
countVisit(); loadVisits().then(visitsLang);
if(MULTI){markNav(); if(PAGE==='contact'){let i=null; try{i=JSON.parse(sessionStorage.getItem('ca-prefill')||'null'); sessionStorage.removeItem('ca-prefill');}catch(e){} if(i) prefill(i);}}
if(location.hash){const tg=document.getElementById(location.hash.slice(1));
  if(tg){const go=()=>tg.scrollIntoView({block:'start'}); go(); (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(go,50)); addEventListener('load',()=>setTimeout(go,50),{once:true});}}
})();
