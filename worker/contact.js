// Toute la Natation Arabe — contact / corrections endpoint (Cloudflare Worker)
// POST /submit  {lang,type,name,email,country,subject,change,source,page,token}
// Checks Turnstile, rate-limits per IP, stores in KV (SUBMISSIONS), emails the editor (MAILER).
import { EmailMessage } from "cloudflare:email";

const ORIGINS = ["https://www.toutelanatationarabe.com", "https://toutelanatationarabe.com"];
const FROM = "contact@toutelanatationarabe.com";
const TYPES = { time: "Correction de temps", swimmer: "Nageur manquant", team: "Équipe / pays", other: "Autre" };

const cors = (origin) => ({
  "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const hdr = (s) => `=?UTF-8?B?${b64(s)}?=`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === "/health") return json({ ok: true }, 200, origin);
    if (url.pathname !== "/submit" || req.method !== "POST") return json({ ok: false, error: "not_found" }, 404, origin);
    if (origin && !ORIGINS.includes(origin)) return json({ ok: false, error: "origin" }, 403, origin);

    let b;
    try { b = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, origin); }
    const ip = req.headers.get("CF-Connecting-IP") || "";

    // Turnstile
    const fd = new FormData();
    fd.append("secret", env.TURNSTILE_SECRET);
    fd.append("response", clean(b.token, 4096));
    if (ip) fd.append("remoteip", ip);
    const ts = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })).json();
    if (!ts.success) return json({ ok: false, error: "captcha" }, 400, origin);

    // rate limit: 5 per IP per hour
    const rk = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const n = parseInt((await env.SUBMISSIONS.get(rk)) || "0", 10);
    if (n >= 5) return json({ ok: false, error: "rate" }, 429, origin);
    await env.SUBMISSIONS.put(rk, String(n + 1), { expirationTtl: 3700 });

    const s = {
      at: new Date().toISOString(),
      lang: b.lang === "ar" ? "ar" : "fr",
      type: TYPES[b.type] ? b.type : "other",
      name: clean(b.name, 120),
      email: clean(b.email, 200),
      country: clean(b.country, 80),
      subject: clean(b.subject, 300),
      change: clean(b.change, 5000),
      source: clean(b.source, 500),
      page: clean(b.page, 500),
      country_ip: req.cf?.country || "",
    };
    if (!s.change || s.change.length < 5) return json({ ok: false, error: "empty" }, 400, origin);
    if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return json({ ok: false, error: "email" }, 400, origin);

    const id = `sub:${s.at}:${crypto.randomUUID().slice(0, 8)}`;
    await env.SUBMISSIONS.put(id, JSON.stringify(s));

    const body = [
      `Nouvelle proposition reçue sur toutelanatationarabe.com`,
      ``,
      `Type : ${TYPES[s.type]}`,
      `Nom : ${s.name || "—"}`,
      `E-mail : ${s.email || "—"}`,
      `Pays / équipe : ${s.country || "—"}`,
      `Nageur / épreuve : ${s.subject || "—"}`,
      `Source : ${s.source || "—"}`,
      `Page : ${s.page || "—"}`,
      `Langue : ${s.lang.toUpperCase()} · Pays (IP) : ${s.country_ip || "—"}`,
      ``,
      `Proposition :`,
      s.change,
      ``,
      `Référence : ${id}`,
    ].join("\r\n");
    const subj = `[TLNA] ${TYPES[s.type]}${s.subject ? " — " + s.subject : ""}`.slice(0, 180);
    const raw = [
      `From: ${hdr("Toute la Natation Arabe")} <${FROM}>`,
      `To: <${env.TO}>`,
      s.email ? `Reply-To: <${s.email}>` : null,
      `Subject: ${hdr(subj)}`,
      `Message-ID: <${crypto.randomUUID()}@toutelanatationarabe.com>`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64(body).replace(/.{76}/g, "$&\r\n"),
    ].filter((l) => l !== null).join("\r\n");
    try {
      await env.MAILER.send(new EmailMessage(FROM, env.TO, raw));
    } catch (e) {
      await env.SUBMISSIONS.put(id + ":mailerror", String(e && e.message || e));
    }
    return json({ ok: true, id }, 200, origin);
  },
};
