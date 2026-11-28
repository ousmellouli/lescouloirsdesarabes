// Build the static site into dist/ : node scripts/build.mjs
// - pre-renders the Arabic (/) and French (/fr/) pages with Playwright so that
//   crawlers and link previews see real content,
// - adds Open Graph / Twitter / hreflang / JSON-LD metadata,
// - generates the 1200x630 share images, favicon, manifest, sitemap, robots, _headers.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.url.replace(/\/$/, '');
const B = new URL(SITE).pathname.replace(/\/$/, ''); // base path, '' at a domain root
// --preview : flat, relative-link copy of the multi-page site in dist-preview/ (for a private preview, not for deploy)
const PREVIEW = process.argv.includes('--preview');
// Cloudflare Web Analytics (private stats, cookie-free); not in previews
const BEACON = cfg.cfBeacon && !PREVIEW ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${cfg.cfBeacon}"}'></script>\n` : '';
const MULTI = PREVIEW || !!cfg.multipage;
const DIST = path.join(ROOT, PREVIEW ? 'dist-preview' : 'dist');
const R = PREVIEW ? '' : B + '/'; // prefix for site files (relative in preview)
// multi-page: one page per section. [id, slug]
const PAGES = [['home', ''], ['pekin', 'pekin-2026'], ['programme', 'programme'], ['engagements', 'engagements'], ['classement', 'classement'], ['cote', 'resultats'], ['palmares', 'palmares'], ['nations', 'nations'], ['records', 'records'],
  ['legendes', 'legendes'], ['finales', 'finales'], ['sources', 'sources'], ['contact', 'contact']];
const pagePath = (lg, slug) => PREVIEW
  ? (lg === 'ar' ? (slug ? slug + '.html' : 'accueil.html') : (slug ? 'fr-' + slug + '.html' : 'fr.html'))
  : (lg === 'ar' ? '/' : '/fr/') + (slug ? slug + '/' : '');
const PURL = { ar: {}, fr: {} };
for (const lg of ['ar', 'fr']) for (const [id, slug] of PAGES) PURL[lg][id] = PREVIEW ? pagePath(lg, slug) : B + pagePath(lg, slug);
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { const f = path.join(DIST, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// ---------- 1. app source -> head / body, with site hooks ----------
let app = read('src/app.html');
const results = JSON.parse(read('data/results.json'));
const must = (re, rep) => { if (!re.test(app)) throw new Error('pattern not found: ' + re); app = app.replace(re, rep); };
must(/const COTE_UPDATED = "[^"]*";/, `let COTE_UPDATED = ${JSON.stringify(results.updated || '')};`);
must(/const RESULTS = \[\];/, `let RESULTS = ${JSON.stringify(results.results || [])};`);
must(/let LANG='(?:fr|ar)';\s*try\{const s=localStorage\.getItem\('ca-lang'\);[^\n]*?catch\(e\)\{\}/, `let LANG=document.documentElement.getAttribute('data-lang')||'ar';`);
must(/<title>[^<]*<\/title>\s*/, '');
must(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '');
must(/(<img class="logo-mark"[^>]*?src=")data:image\/svg\+xml;base64,[^"]+"/, `$1${R}logo-mark.svg"`);
must(/src="\/(nage-(?:fr|ar)\.svg)"/g, `src="${R}$1"`);
const cut = app.indexOf('<header>');
const appHead = app.slice(0, cut), appBody = app.slice(cut);

const LANGS = {
  fr: { title: 'Toute la Natation Arabe — Les nageurs arabes aux Mondiaux de natation',
        desc: "Histoire, statistiques, records et grands noms des 22 pays arabes aux Championnats du monde de natation (50 m et 25 m). Engagés et résultats en direct de Pékin 2026 (1–6 décembre).",
        locale: 'fr_FR', og: '/og-fr.png', path: '/fr/' },
  ar: { path: '/', title: 'السباحة العربية — السبّاحون العرب في بطولات العالم للسباحة',
        desc: 'تاريخ وإحصائيات وأرقام قياسية وأبرز أسماء الدول العربية الـ22 في بطولات العالم للسباحة (50م و25م). المسجلون والنتائج المباشرة من بكين 2026 (1–6 ديسمبر).',
        locale: 'ar_AR', og: '/og-ar.png' }
};
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(lg, pg) {
  const L0 = LANGS[lg];
  const L = pg ? { ...L0, title: pg.title, desc: pg.desc || L0.desc, path: pg.path } : L0, url = SITE + L.path;
  const alt = pg ? pg.alt : { ar: SITE + '/', fr: SITE + '/fr/' };
  const ld = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: lg === 'ar' ? 'السباحة العربية' : 'Toute la Natation Arabe', url, inLanguage: lg, description: L.desc },
    { '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'World Aquatics Swimming Championships (25m) Beijing 2026', sport: 'Swimming',
      startDate: '2026-12-01', endDate: '2026-12-06', eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: 'Beijing', address: { '@type': 'PostalAddress', addressLocality: 'Beijing', addressCountry: 'CN' } },
      organizer: { '@type': 'Organization', name: 'World Aquatics', url: 'https://www.worldaquatics.com' } }];
  return `<meta charset="utf-8">
${new URL(SITE).protocol==='https:'?`<script>if(location.protocol==='http:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')location.replace('https:'+location.href.slice(5));</script>\n`:''}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(L.title)}</title>
<meta name="description" content="${esc(L.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ar" href="${alt.ar}">
<link rel="alternate" hreflang="fr" href="${alt.fr}">
<link rel="alternate" hreflang="x-default" href="${alt.ar}">
<meta name="theme-color" content="#00569C">
<link rel="icon" href="${R}favicon.svg" type="image/svg+xml">
<link rel="icon" href="${R}favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${R}apple-touch-icon.png">
<link rel="manifest" href="${R}manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Toute la Natation Arabe">
<meta property="og:title" content="${esc(L.title)}">
<meta property="og:description" content="${esc(L.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${L.locale}">
<meta property="og:locale:alternate" content="${lg === 'ar' ? 'fr_FR' : 'ar_AR'}">
<meta property="og:image" content="${SITE}${L.og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(L.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(L.title)}">
<meta name="twitter:description" content="${esc(L.desc)}">
<meta name="twitter:image" content="${SITE}${L.og}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
`;
}
const page = (lg, body, extraHead = '', pg = null) =>
  `<!doctype html>\n<html lang="${lg}" dir="${lg === 'ar' ? 'rtl' : 'ltr'}" data-lang="${lg}"${pg ? ` data-page="${pg.id}"` : ''}>\n<head>\n${head(lg, pg)}${appHead}${extraHead}${BEACON}</head>\n<body>\n${body}\n</body>\n</html>\n`;

// ---------- 2. static assets ----------
const v = Date.now().toString(36);
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src/site.css'), path.join(DIST, 'assets/site.css'));
fs.copyFileSync(path.join(ROOT, 'src/site.js'), path.join(DIST, 'assets/site.js'));
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'data/results.json'), path.join(DIST, 'data/results.json'));
fs.copyFileSync(path.join(ROOT, 'data/entries.json'), path.join(DIST, 'data/entries.json'));
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });

// ---------- 3. pre-render with Playwright ----------
const tmp = path.join(ROOT, '.prerender');
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(path.join(tmp, 'fr'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'index.html'), page('ar', appBody));
fs.writeFileSync(path.join(tmp, 'fr/index.html'), page('fr', appBody));
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(tmp, p);
  if (!f.startsWith(tmp) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', e => errors.push(e.message));
for (const lg of ['ar', 'fr']) {
  await pg.goto(`http://127.0.0.1:${port}${LANGS[lg].path}`, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('#t-med tbody tr').length > 0);
  const body = await pg.evaluate(() => document.body.innerHTML);
  const siteCfg = { url: SITE, base: B, root: R };
  if (MULTI) siteCfg.pages = { order: PAGES.map(p => p[0]), url: PURL };
  const site = `<link rel="stylesheet" href="${R}assets/site.css?v=${v}">\n<script>window.CA_SITE=${JSON.stringify(siteCfg)}</script>\n`;
  let full = body.replace(/<\/script>\s*$/, '</script>') + `\n<script src="${R}assets/site.js?v=${v}" defer></script>`;
  full = full.replace(/ src="photos\//g, ` src="${R}photos/`);
  full = full.replace(/ srcset="([^"]*)"/g, (m, v) => ` srcset="${v.replace(/(^|, )photos\//g, `$1${R}photos/`)}"`); // static photos baked into the page resolve from the site root
  if (!MULTI) { write(LANGS[lg].path + 'index.html', page(lg, full, site)); continue; }
  // section links point to their own page
  full = full.replace(/href="#(pekin|programme|engagements|classement|cote|palmares|nations|records|legendes|finales|sources|contact)"/g, (m, id) => `href="${PURL[lg][id]}" data-pg="${id}"`);
  const info = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('section.page')].map(s => [s.id, {
    nav: (document.querySelector(`nav.sections a[href="#${s.id}"]`) || {}).textContent || '',
    h2: (s.querySelector('h2') || {}).textContent || '', lead: (s.querySelector('.standfirst') || {}).textContent || '' }])));
  info.contact = lg === 'ar' ? { nav: 'اتصل بنا', h2: 'اقترح تصحيحاً', lead: '' } : { nav: 'Contact', h2: 'Proposer une correction', lead: '' };
  const brand = lg === 'ar' ? 'السباحة العربية' : 'Toute la Natation Arabe';
  for (const [id, slug] of PAGES) {
    const I = info[id], ppath = pagePath(lg, slug);
    const pgm = { id, path: PREVIEW ? LANGS[lg].path : ppath,
      title: id === 'home' ? LANGS[lg].title : `${(I.h2 || I.nav).trim()} — ${brand}`,
      desc: id === 'home' ? '' : (I.lead || '').trim().slice(0, 300),
      alt: { ar: SITE + pagePath('ar', slug), fr: SITE + pagePath('fr', slug) } };
    if (PREVIEW) pgm.alt = { ar: SITE + '/', fr: SITE + '/fr/' };
    write(PREVIEW ? ppath : ppath + 'index.html', page(lg, full, site, pgm));
  }
}
if (errors.length) { console.error('page errors during pre-render:', errors); process.exitCode = 1; }

// ---------- 4. share images (1200x630), favicons ----------
const OGSW = fs.readFileSync(path.join(ROOT, 'scripts/assets/og-swimmer.svg'), 'utf8').replace('<svg ', '<svg class="sw" ');
const ogHTML = lg => `<!doctype html><html lang="${lg}" dir="${lg === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..900&family=Newsreader:ital,opsz,wght@1,6..72,600&family=Noto+Kufi+Arabic:wght@700;900&display=swap">
<style>*{box-sizing:border-box;margin:0}html{overflow:hidden}body{width:1200px;height:630px;background:#00569C;color:#fff;font-family:Archivo,"Noto Kufi Arabic",sans-serif;position:relative;overflow:hidden}
.lanes{position:absolute;inset:0}.rope{position:absolute;left:0;right:0;height:14px;margin-top:-7px;border-radius:7px;background:linear-gradient(180deg,rgba(255,255,255,.55) 0,rgba(255,255,255,0) 40%,rgba(0,0,0,0) 60%,rgba(0,0,0,.35) 100%),repeating-linear-gradient(90deg,var(--c) 0 22px,var(--d) 22px 24px);box-shadow:0 2px 3px rgba(0,0,0,.25)}.rope.lr{--c:#E3262B;--d:#8E1014}.rope.ly{--c:#FFE500;--d:#A88F00}
.in{position:absolute;inset:56px 64px;display:flex;flex-direction:column}
.kick{font:italic 600 34px Newsreader,serif;opacity:.95}
h1{font-weight:900;font-stretch:78%;font-size:${lg === 'ar' ? 104 : 112}px;line-height:${lg === 'ar' ? 1.15 : .88};letter-spacing:-.02em;margin-top:18px}
[dir=rtl] h1,[dir=rtl] .kick,[dir=rtl] .box{font-family:"Noto Kufi Arabic",sans-serif;font-style:normal}
.box{margin-top:auto;display:flex;gap:0;align-items:stretch}
.y{background:#FFE500;color:#0E1A24;padding:18px 26px;font-weight:900;font-size:44px;font-stretch:80%}
.n{background:#003254;padding:18px 26px;font-size:30px;font-weight:700;display:flex;align-items:center}
.sw{position:absolute;top:150px;width:640px;height:auto}[dir=ltr] .sw{right:-40px}[dir=rtl] .sw{left:-40px}
.in{z-index:1}[dir=ltr] .in{right:560px}[dir=rtl] .in{left:560px}.box{flex-direction:column;align-items:flex-start}.box .n{font-size:26px}
</style></head><body><div class="lanes"><div class="rope lr" style="top:90px"></div><div class="rope lr" style="top:182px"></div><div class="rope ly" style="top:274px"></div><div class="rope ly" style="top:366px"></div><div class="rope lr" style="top:458px"></div><div class="rope lr" style="top:550px"></div></div>${OGSW}<div class="in">
<div class="kick">${lg === 'ar' ? 'الدليل الشامل' : 'Le Guide Complet'}</div>
<h1>${lg === 'ar' ? 'السباحة العربية' : 'Toute la Natation Arabe'}</h1>
<div class="box"><div class="y">${lg === 'ar' ? 'بكين 2026' : 'Pékin 2026'}</div><div class="n">${lg === 'ar' ? '1–6 ديسمبر · الحوض القصير 25م' : '1–6 décembre · petit bassin 25 m'}</div></div>
</div></body></html>`;
for (const lg of ['fr', 'ar']) {
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await p2.setContent(ogHTML(lg), { waitUntil: 'networkidle' });
  await p2.evaluate(() => document.fonts.ready);
  await p2.screenshot({ path: path.join(DIST, `og-${lg}.png`) });
  await p2.close();
}
const favSmall = fs.readFileSync(path.join(DIST, 'favicon.svg'), 'utf8');
const favApp = fs.readFileSync(path.join(ROOT, 'scripts/assets/icon-app.svg'), 'utf8');
for (const [name, s] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const fav = s <= 48 ? favSmall : favApp;
  const p3 = await browser.newPage({ viewport: { width: s, height: s } });
  await p3.setContent(`<style>*{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${fav}`);
  await p3.screenshot({ path: path.join(DIST, name), omitBackground: true });
  await p3.close();
}
await browser.close(); server.close();
fs.rmSync(tmp, { recursive: true, force: true });

// old Arabic address /ar/ now lives at the root
write('ar/index.html', `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>السباحة العربية</title><link rel="canonical" href="${SITE}/"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${B}/"><script>location.replace(${JSON.stringify(B + '/')}+location.search+location.hash)</script></head><body><a href="${B}/">السباحة العربية</a></body></html>\n`);

// ---------- 5. manifest, sitemap, robots, headers, 404 ----------
write('manifest.webmanifest', JSON.stringify({ name: 'Toute la Natation Arabe', short_name: 'Natation Arabe', start_url: B + '/', display: 'standalone', dir: 'rtl',
  background_color: '#FFFFFF', theme_color: '#00569C', lang: 'ar',
  icons: [{ src: B + '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: B + '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${(MULTI && !PREVIEW ? PAGES.map(p => p[1]) : ['']).flatMap(sl => ['ar', 'fr'].map(lg => `<url><loc>${SITE}${pagePath(lg, sl)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq>
<xhtml:link rel="alternate" hreflang="ar" href="${SITE}${pagePath('ar', sl)}"/><xhtml:link rel="alternate" hreflang="fr" href="${SITE}${pagePath('fr', sl)}"/></url>`)).join('\n')}
</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${B}/assets/*
  Cache-Control: public, max-age=31536000, immutable
${B}/data/*
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *
/*.png
  Cache-Control: public, max-age=86400
`);
write('404.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page introuvable — Toute la Natation Arabe</title>
<style>body{margin:0;font-family:Archivo,system-ui,sans-serif;background:#00569C;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px}a{color:#0E1A24;background:#FFE500;padding:10px 18px;font-weight:800;text-decoration:none;display:inline-block;margin:6px}</style></head>
<body><div><h1>404</h1><p>Cette page n’existe pas · هذه الصفحة غير موجودة</p><a href="${B}/">الرئيسية</a><a href="${B}/fr/">Accueil</a></div></body></html>\n`);
write('.nojekyll', '');
const host = new URL(SITE).hostname; if (!host.endsWith('github.io') && !PREVIEW) write('CNAME', host + '\n');
if (PREVIEW) write('index.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aperçu multi-pages</title><style>:root{--bg:#00569C;--fg:#fff}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:Archivo,system-ui,sans-serif;text-align:center;padding:16px}
a{display:inline-block;margin:8px;padding:14px 22px;background:#FFE500;color:#0E1A24;font-weight:800;text-decoration:none;font-size:1.1rem}p{opacity:.85;max-width:40ch;margin:10px auto}</style></head>
<body><div><h1>Toute la Natation Arabe · السباحة العربية</h1><p>Version test : chaque rubrique sur sa propre page. Rien n'est publié sur le site.</p>
<a href="accueil.html">النسخة العربية</a><a href="fr.html">Version française</a></div></body></html>\n`);
console.log('built', fs.readdirSync(DIST).join(' '));
