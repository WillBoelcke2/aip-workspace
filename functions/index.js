// Robô das atas: todo dia às 6h (Brasília) lê as anotações do Gemini das reuniões de cada pessoa do time
// e grava a reunião e as tarefas no workspace. Usa delegação em todo o domínio (sem chave e sem senha):
// a conta de serviço da função assina um pedido em nome de cada pessoa, só com a permissão de ler arquivos do Meet.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const { workspace } = require("./core");
const seed = require("./seed");
const { report } = require("./status");
const zlib = require("zlib");

admin.initializeApp();
const DOMAIN = "aipathology.com.br";
const SCOPE = "https://www.googleapis.com/auth/drive.meet.readonly";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function userToken(sa, email, scope) {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ iss: sa, sub: email, scope: scope || SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 1800 });
  const client = await auth.getClient();
  const sig = await client.request({ url: "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" + encodeURIComponent(sa) + ":signJwt", method: "POST", data: { payload } });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: sig.data.signedJwt }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || "token " + r.status);
  return j.access_token;
}

exports.atasBot = onSchedule({ schedule: "0 6 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  const db = admin.firestore();
  const [ps, ms] = await Promise.all([db.collection("pages").get(), db.collection("members").get()]);
  const pages = new Map(ps.docs.map(d => [d.id, Object.assign({ id: d.id }, d.data())]));
  const members = ms.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(m => m.id.endsWith("@" + DOMAIN));
  const ws = workspace(pages, members), stat = { ts: Date.now(), atas: 0, tarefas: 0, pessoas: 0, erros: {} };
  if (!ws.meetDb()) { stat.erro = "Base Reuniões não encontrada"; await report(db, "atas", stat); logger.warn("atasBot", stat); return; }
  const sa = (await auth.getCredentials()).client_email;
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const q = "mimeType='application/vnd.google-apps.document' and trashed=false and modifiedTime>'" + since + "' and name contains 'Gemini'";
  for (const m of members) {
    try {
      const tk = await userToken(sa, m.id), H = { Authorization: "Bearer " + tk };
      const lr = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=50&orderBy=modifiedTime&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=" + encodeURIComponent("files(id,name,modifiedTime,owners(emailAddress))") + "&q=" + encodeURIComponent(q), { headers: H });
      const lj = await lr.json(); if (!lr.ok) throw new Error((lj.error && lj.error.message) || "drive " + lr.status);
      stat.pessoas++;
      for (const f of lj.files || []) {
        if (!/gemini/i.test(f.name) || ws.seen(f.id)) continue;
        const er = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(f.id) + "/export?mimeType=text/markdown", { headers: H });
        if (!er.ok) continue;
        const owner = (f.owners && f.owners[0] && f.owners[0].emailAddress) || m.id;
        const { docs } = ws.build(f, await er.text(), owner, "bot");
        if (!docs.length) continue;
        const batch = db.batch(); docs.forEach(d => batch.set(db.collection("pages").doc(d.id), d)); await batch.commit();
        stat.atas++; stat.tarefas += docs.length - 1;
      }
    } catch (e) { stat.erros[m.id.split("@")[0]] = String(e.message || e).slice(0, 160); }
  }
  await db.collection("settings").doc("atasBot").set(stat);
  await report(db, "atas", stat);
  logger.info("atasBot", stat);
});

// ---------- Radar Seed: lê os e-mails do dono do workspace e atualiza o CRM de fundos ----------
const GMAIL = "https://www.googleapis.com/auth/gmail.readonly";
const MODELS = (process.env.SEED_MODELS || "gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash").split(",");
const b64 = s => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
function bodyText(p) {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body && p.body.data) return b64(p.body.data);
  for (const c of p.parts || []) { const t = bodyText(c); if (t) return t; }
  if (p.mimeType === "text/html" && p.body && p.body.data) return b64(p.body.data).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return "";
}
const clean = t => String(t || "").split(/\r?\n/).filter(l => !/^\s*>/.test(l)).join("\n").replace(/\n?On .{0,120}wrote:[\s\S]*$/i, "").replace(/\n?Em .{0,120}escreveu:[\s\S]*$/i, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
async function gemini(text) {
  const client = await auth.getClient(), project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT; let last = "";
  for (const m of MODELS) {
    try {
      const r = await client.request({ url: "https://aiplatform.googleapis.com/v1/projects/" + project + "/locations/global/publishers/google/models/" + m.trim() + ":generateContent", method: "POST",
        data: { contents: [{ role: "user", parts: [{ text }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: seed.SCHEMA } } });
      const out = (((r.data.candidates || [])[0] || {}).content || {}).parts || [];
      return { model: m.trim(), items: JSON.parse(out.map(p => p.text || "").join("") || "[]") };
    } catch (e) { last = String((e.response && e.response.data && e.response.data.error && e.response.data.error.message) || e.message || e).slice(0, 200); }
  }
  throw new Error("Gemini: " + last);
}

exports.seedRadar = onSchedule({ schedule: "20 6 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  const db = admin.firestore(), stat = { ts: Date.now(), conversas: 0, atualizados: 0, novos: 0, modelo: "", erro: "" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const stRef = db.collection("settings").doc("seedBot");
  try {
    const [ps, ow, prev, ms] = await Promise.all([db.collection("pages").get(), db.collection("settings").doc("owner").get(), stRef.get(), db.collection("members").get()]);
    const pages = new Map(ps.docs.map(d => [d.id, Object.assign({ id: d.id }, d.data())]));
    const owner = ow.exists && ow.data().email; if (!owner) throw new Error("dono do workspace não definido");
    if (!seed.fundDb(pages)) throw new Error("base de fundos não encontrada");
    const ownerName = ((ms.docs.find(d => d.id === owner) || { data: () => ({}) }).data().name) || "";
    const seen = new Set((prev.exists && prev.data().seen) || []);
    const sa = (await auth.getCredentials()).client_email, H = { Authorization: "Bearer " + await userToken(sa, owner, GMAIL) };
    const days = new Date(today + "T12:00:00Z").getUTCDay() === 1 ? 3 : 2;
    const G = "https://gmail.googleapis.com/gmail/v1/users/me/";
    const lr = await fetch(G + "threads?maxResults=60&q=" + encodeURIComponent("newer_than:" + days + "d -category:promotions -category:social -category:forums"), { headers: H });
    const lj = await lr.json(); if (!lr.ok) throw new Error((lj.error && lj.error.message) || "gmail " + lr.status);
    const threads = [], marks = [];
    for (const t of lj.threads || []) {
      const tr = await fetch(G + "threads/" + t.id + "?format=full", { headers: H }); if (!tr.ok) continue;
      const tj = await tr.json(), msgs = tj.messages || [], lastM = msgs[msgs.length - 1]; if (!lastM) continue;
      const key = t.id + ":" + lastM.id; if (seen.has(key)) continue; marks.push(key);
      const hd = (m, n) => ((m.payload && m.payload.headers) || []).find(h => h.name.toLowerCase() === n) || { value: "" };
      const people = msgs.map(m => hd(m, "from").value + " " + hd(m, "to").value + " " + hd(m, "cc").value).join(" ").toLowerCase();
      const ext = (people.match(/[\w.+-]+@[\w.-]+/g) || []).filter(e => !e.endsWith("@" + DOMAIN) && !/no-?reply|notification|mailer-daemon|calendar-notification|@google\.com|@docs\.google\.com/.test(e));
      if (!ext.length) continue;
      const lastFrom = hd(lastM, "from").value.toLowerCase();
      threads.push({ dir: lastFrom.includes(owner.toLowerCase()) ? "out" : "in", lastDate: new Date(+lastM.internalDate || Date.now()).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }), id: t.id, subject: hd(msgs[0], "subject").value.slice(0, 140), msgs: msgs.slice(-2).map(m => ({ date: new Date(+m.internalDate || Date.now()).toISOString().slice(0, 10), from: hd(m, "from").value.slice(0, 120), to: hd(m, "to").value.slice(0, 160), text: clean(bodyText(m.payload) || m.snippet).slice(0, 1400) })) });
      if (threads.length >= 40) break;
    }
    stat.conversas = threads.length;
    let items = [];
    for (let i = 0; i < threads.length; i += 20) { const g = await gemini(seed.prompt(threads.slice(i, i + 20), seed.fundList(pages), today, ownerName)); stat.modelo = g.model; items = items.concat(Array.isArray(g.items) ? g.items : []); }
    const tmeta = new Map(threads.map(t => [t.id, t]));
    items.forEach(it => { const m = tmeta.get(String(it.thread || "").replace(/^thread\s+/, "")); if (m) { it.dir = m.dir; it.lastDate = m.lastDate; } });
    const res = seed.apply(pages, items, today);
    stat.atualizados = res.rep.up.length; stat.novos = res.rep.novo.length;
    const docs = res.docs.concat([seed.reportPage(pages, res, today, threads.length + (threads.length === 1 ? " conversa externa lida." : " conversas externas lidas."))]);
    const batch = db.batch(); docs.forEach(d => batch.set(db.collection("pages").doc(d.id), d)); await batch.commit();
    await stRef.set(Object.assign({}, stat, { seen: [...seen, ...marks].slice(-800) }));
  } catch (e) { stat.erro = String(e.message || e).slice(0, 300); await stRef.set(stat, { merge: true }); }
  await report(db, "seed", stat);
  logger.info("seedRadar", stat);
});

// ---------- Backup diário: copia todo o banco do workspace para o Storage e guarda 30 dias ----------
exports.backup = onSchedule({ schedule: "10 3 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1", timeoutSeconds: 540, memory: "1GiB" }, async () => {
  const db = admin.firestore(), stat = { ts: Date.now(), docs: 0, kb: 0, guardados: 0, erro: "" };
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || "{}"), project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const bucket = admin.storage().bucket(cfg.storageBucket || project + ".firebasestorage.app");
    const dump = { feito: new Date().toISOString() };
    for (const c of ["pages", "members", "settings"]) { const sn = await db.collection(c).get(); dump[c] = sn.docs.map(d => Object.assign({ id: d.id }, d.data())); stat.docs += sn.size; }
    const buf = zlib.gzipSync(Buffer.from(JSON.stringify(dump)));
    await bucket.file("backups/" + today + ".json.gz").save(buf, { contentType: "application/gzip", resumable: false });
    stat.kb = Math.round(buf.length / 1024);
    const [files] = await bucket.getFiles({ prefix: "backups/" });
    const names = files.map(f => f.name).filter(n => /^backups\/\d{4}-\d\d-\d\d\.json\.gz$/.test(n)).sort();
    for (const n of names.slice(0, Math.max(0, names.length - 30))) await bucket.file(n).delete();
    stat.guardados = Math.min(names.length, 30);
  } catch (e) { stat.erro = String(e.message || e).slice(0, 300); }
  await report(db, "backup", stat);
  logger.info("backup", stat);
});

// ---------- Agenda: copia a agenda de cada pessoa para o workspace, de hora em hora ----------
// Guarda só horário, título e link do evento. Cada pessoa lê a própria cópia; administradores conseguem ler todas.
const CAL = "https://www.googleapis.com/auth/calendar.readonly";
exports.calSync = onSchedule({ schedule: "10 6-21 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  const db = admin.firestore(), stat = { ts: Date.now(), pessoas: 0, eventos: 0, erros: {} };
  const ms = await db.collection("members").get(), members = ms.docs.map(d => d.id).filter(e => e.endsWith("@" + DOMAIN));
  const sa = (await auth.getCredentials()).client_email;
  const from = new Date(Date.now() - 7 * 864e5).toISOString(), to = new Date(Date.now() + 45 * 864e5).toISOString();
  for (const email of members) {
    try {
      const tk = await userToken(sa, email, CAL);
      const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=600&timeZone=America/Sao_Paulo&timeMin=" + encodeURIComponent(from) + "&timeMax=" + encodeURIComponent(to) + "&fields=" + encodeURIComponent("items(id,status,summary,htmlLink,hangoutLink,visibility,start,end,attendees(self,responseStatus))"), { headers: { Authorization: "Bearer " + tk } });
      const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "calendar " + r.status);
      const events = (j.items || []).filter(e => e.status !== "cancelled" && e.start && !(e.attendees || []).some(a => a.self && a.responseStatus === "declined")).map(e => {
        const allDay = !!e.start.date, s0 = e.start.dateTime || "", e0 = (e.end && e.end.dateTime) || "", priv = e.visibility === "private" || e.visibility === "confidential";
        return { id: e.id, title: priv ? "Ocupado" : String(e.summary || "(sem título)").slice(0, 160), date: allDay ? e.start.date : s0.slice(0, 10), time: allDay ? "" : s0.slice(11, 16), end: allDay ? "" : e0.slice(11, 16), link: priv ? "" : e.htmlLink || "", meet: priv ? "" : e.hangoutLink || "" };
      });
      const id = "cal-" + email.toLowerCase().replace(/[^\w]/g, "_"), ref = db.collection("pages").doc(id), sig = JSON.stringify(events), cur = await ref.get();
      stat.pessoas++; stat.eventos += events.length;
      if (cur.exists && cur.data().sig === sig.length + ":" + sig.slice(0, 40) + sig.slice(-40) && JSON.stringify(cur.data().events) === sig) continue;
      await ref.set({ id, kind: "cal", title: "Agenda", parent: "__agenda", order: 0, props: {}, blocks: [], events, sig: sig.length + ":" + sig.slice(0, 40) + sig.slice(-40), lock: true, acl: [email], ts: Date.now(), sid: "bot", by: "bot" });
    } catch (e) { stat.erros[email.split("@")[0]] = String(e.message || e).slice(0, 160); }
  }
  await report(db, "agenda", stat);
  logger.info("calSync", stat);
});
