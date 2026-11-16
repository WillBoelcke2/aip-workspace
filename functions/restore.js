// Restaura páginas a partir de um backup. Uso (pelo script): node functions/restore.js AAAA-MM-DD [id-da-pagina]
// Com id: restaura essa página e tudo que está dentro dela, como estava no backup. Sem id: restaura todas as páginas.
// Nada é apagado: páginas criadas depois do backup continuam existindo.
const admin = require("firebase-admin"), zlib = require("zlib"), readline = require("readline");
const project = process.env.GOOGLE_CLOUD_PROJECT;
admin.initializeApp({ projectId: project, storageBucket: project + ".firebasestorage.app" });
(async () => {
  const [date, root] = process.argv.slice(2);
  if (!/^\d{4}-\d\d-\d\d$/.test(date || "")) { console.log("Informe a data do backup: AAAA-MM-DD"); process.exit(1); }
  const [buf] = await admin.storage().bucket().file("backups/" + date + ".json.gz").download();
  const dump = JSON.parse(zlib.gunzipSync(buf).toString("utf8")), pages = dump.pages || [];
  let pick = pages;
  if (root) { const ids = new Set([root]); let grew = true; while (grew) { grew = false; for (const p of pages) if (p.parent && ids.has(p.parent) && !ids.has(p.id)) { ids.add(p.id); grew = true; } } pick = pages.filter(p => ids.has(p.id)); }
  if (!pick.length) { console.log("Nada encontrado no backup de " + date + (root ? " para a página " + root : "") + "."); process.exit(1); }
  const head = root ? pick.find(p => p.id === root) : null;
  console.log("Backup de " + date + ": " + pick.length + " documentos" + (head ? ' (página "' + (head.title || root) + '" e o que está dentro)' : " (todas as páginas)") + ".");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ok = await new Promise(r => rl.question("Isto sobrescreve o estado atual desses documentos. Digite SIM para continuar: ", a => { rl.close(); r(a.trim() === "SIM"); }));
  if (!ok) { console.log("Cancelado."); process.exit(0); }
  const db = admin.firestore(), now = Date.now();
  for (let i = 0; i < pick.length; i += 400) { const b = db.batch(); pick.slice(i, i + 400).forEach(p => b.set(db.collection("pages").doc(p.id), Object.assign({}, p, { ts: now, sid: "restore" }))); await b.commit(); }
  console.log("Restaurado.");
})().catch(e => { console.error("Falhou:", e.message); process.exit(1); });
