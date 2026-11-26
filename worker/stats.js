// Toute la Natation Arabe — visitor counter (Cloudflare Worker "tlna-stats", D1 binding DB)
// POST /hit   {n:1 if this browser has never been counted}  -> counts a page view (+ a visitor) for the caller's country
// GET  /stats -> {visitors, views, today:{visitors,views}, countries:[[CC,visitors,views],...], since}
// No cookies and no IP stored: only a salted daily hash of the IP is kept (for abuse limits) and purged after 2 days.
// Tables (created once):
//   daily(day TEXT, country TEXT, visitors INT, views INT, PRIMARY KEY(day,country))
//   seen(day TEXT, h TEXT, visitors INT, views INT, PRIMARY KEY(day,h))

const ORIGINS = ["https://www.toutelanatationarabe.com", "https://toutelanatationarabe.com"];
const MAX_NEW_PER_IP = 20;   // new visitors counted per IP per day (shared networks)
const MAX_VIEWS_PER_IP = 300; // page views counted per IP per day

const cors = (origin) => ({
  "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (obj, status, origin, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(origin), ...extra } });

async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function stats(env) {
  const day = new Date().toISOString().slice(0, 10);
  const [tot, today, ctry, first] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(visitors),0) v, COALESCE(SUM(views),0) p FROM daily"),
    env.DB.prepare("SELECT COALESCE(SUM(visitors),0) v, COALESCE(SUM(views),0) p FROM daily WHERE day=?").bind(day),
    env.DB.prepare("SELECT country c, SUM(visitors) v, SUM(views) p FROM daily GROUP BY country ORDER BY v DESC, p DESC"),
    env.DB.prepare("SELECT MIN(day) d FROM daily"),
  ]);
  const base = parseInt(env.BASE_VISITORS || "0", 10) || 0;
  return {
    visitors: tot.results[0].v + base,
    views: tot.results[0].p,
    today: { visitors: today.results[0].v, views: today.results[0].p },
    countries: ctry.results.map((r) => [r.c, r.v, r.p]),
    since: first.results[0].d || day,
    at: new Date().toISOString(),
  };
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (url.pathname === "/stats" && req.method === "GET") {
      const cache = caches.default, key = new Request(url.origin + "/stats");
      let hit = await cache.match(key);
      if (!hit) {
        hit = new Response(JSON.stringify(await stats(env)), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
        ctx.waitUntil(cache.put(key, hit.clone()));
      }
      return new Response(hit.body, { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60", ...cors(origin) } });
    }

    if (url.pathname === "/hit" && req.method === "POST") {
      if (!ORIGINS.includes(origin)) return json({ ok: false }, 403, origin);
      let b = {};
      try { b = await req.json(); } catch {}
      const isNew = b && b.n === 1 ? 1 : 0;
      const day = new Date().toISOString().slice(0, 10);
      const ua = req.headers.get("User-Agent") || "";
      if (/bot|crawl|spider|slurp|preview|headless|lighthouse/i.test(ua)) return json({ ok: true, skip: 1 }, 200, origin);
      const cc = /^[A-Z]{2}$/.test(req.cf?.country || "") ? req.cf.country : "XX";
      const h = await sha((req.headers.get("CF-Connecting-IP") || "") + "|" + day + "|" + (env.SALT || ""));

      const row = await env.DB.prepare("SELECT visitors, views FROM seen WHERE day=? AND h=?").bind(day, h).first();
      const v = isNew && (!row || row.visitors < MAX_NEW_PER_IP) ? 1 : 0;
      const p = !row || row.views < MAX_VIEWS_PER_IP ? 1 : 0;
      if (!v && !p) return json({ ok: true }, 200, origin);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO seen(day,h,visitors,views) VALUES(?,?,?,?) ON CONFLICT(day,h) DO UPDATE SET visitors=visitors+excluded.visitors, views=views+excluded.views").bind(day, h, v, p),
        env.DB.prepare("INSERT INTO daily(day,country,visitors,views) VALUES(?,?,?,?) ON CONFLICT(day,country) DO UPDATE SET visitors=visitors+excluded.visitors, views=views+excluded.views").bind(day, cc, v, p),
      ]);
      // purge old hashes now and then
      if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare("DELETE FROM seen WHERE day < ?").bind(new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)).run());
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === "/health") return json({ ok: true }, 200, origin);
    return json({ ok: false, error: "not_found" }, 404, origin);
  },
};
