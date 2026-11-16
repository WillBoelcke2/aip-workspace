// Painel dos robôs: cada robô registra a última execução na página "Robôs" (só administradores veem).
const rid = () => Math.random().toString(36).slice(2, 10);
const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const when = ts => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ts)).replace(",", " às");
const DEFS = [
  ["atas", "Atas de reunião", "todo dia às 6h00", b => [b.atas + (b.atas === 1 ? " ata importada" : " atas importadas") + ", " + b.tarefas + (b.tarefas === 1 ? " tarefa criada" : " tarefas criadas"), b.pessoas + " pessoas lidas"]],
  ["seed", "Radar Seed", "todo dia às 6h20", b => [b.conversas + " conversas lidas, " + b.atualizados + (b.atualizados === 1 ? " fundo atualizado" : " fundos atualizados") + ", " + b.novos + (b.novos === 1 ? " novo" : " novos"), b.modelo ? "Modelo: " + b.modelo : ""]],
  ["backup", "Backup", "todo dia às 3h10", b => [b.docs + " documentos guardados (" + b.kb + " KB)", "Cópias guardadas: " + b.guardados + " (últimos 30 dias)"]]
];
function blocks(bots) {
  const B = (t, h) => ({ id: rid(), t, h }), out = [B("p", "Esta página é escrita pelos robôs do workspace a cada execução. Só administradores veem.")];
  DEFS.forEach(([k, name, sched, lines]) => {
    const b = bots[k]; out.push(B("h2", name));
    if (!b) { out.push(B("p", "Ainda não rodou (" + sched + ").")); return; }
    const errs = [].concat(b.erro ? [b.erro] : [], Object.entries(b.erros || {}).map(([p, e]) => p + ": " + e));
    out.push(B("ul", (errs.length ? "⚠️ Falhou" : "✅ Funcionou") + " em " + when(b.ts) + " (" + sched + ")"));
    if (!b.erro) lines(b).filter(Boolean).forEach(l => out.push(B("ul", esc(l))));
    errs.slice(0, 8).forEach(e => out.push(B("ul", "Erro: " + esc(e))));
  });
  out.push(B("p", "")); return out;
}
async function report(db, key, stat) {
  const ref = db.collection("pages").doc("robos");
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(ref), cur = s.exists ? s.data() : { id: "robos", kind: "page", title: "Robôs", parent: null, order: 7.7, props: {}, color: "gray" };
      const bots = Object.assign({}, cur.bots || {}, { [key]: stat });
      tx.set(ref, Object.assign({}, cur, { id: "robos", bots, blocks: blocks(bots), trashed: false, lock: true, acl: [], ts: Date.now(), sid: "bot", by: "bot" }));
    });
  } catch (e) { console.error("painel dos robôs:", e.message); }
}
module.exports = { report, blocks };
