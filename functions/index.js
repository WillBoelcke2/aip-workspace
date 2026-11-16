// Robô das atas: todo dia às 6h (Brasília) lê as anotações do Gemini das reuniões de cada pessoa do time
// e grava a reunião e as tarefas no workspace. Usa delegação em todo o domínio (sem chave e sem senha):
// a conta de serviço da função assina um pedido em nome de cada pessoa, só com a permissão de ler arquivos do Meet.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const { workspace } = require("./core");

admin.initializeApp();
const DOMAIN = "aipathology.com.br";
const SCOPE = "https://www.googleapis.com/auth/drive.meet.readonly";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function userToken(sa, email) {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ iss: sa, sub: email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 1800 });
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
  if (!ws.meetDb()) { logger.warn("Base Reuniões não encontrada"); return; }
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
  logger.info("atasBot", stat);
});
