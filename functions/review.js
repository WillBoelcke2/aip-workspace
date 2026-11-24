// Revisão das reuniões: lógica pura (sem Firebase e sem chamada de IA).
// Depois que a ata entra, o robô compara a reunião com as tarefas abertas e propõe o que mudou:
// concluir, adiar, repassar, juntar repetidas, agrupar microtarefas e apontar tarefas vagas.
// Certeza alta e trecho conferido na ata: aplica sozinho. Certeza média: vira sugestão para o líder da equipe.
const { norm } = require("./core");
const rid = () => Math.random().toString(36).slice(2, 10);
const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = v => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : "";
const addDays = (isoDay, n) => { const d = new Date(isoDay + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TIPOS = ["concluir", "adiar", "repassar", "juntar", "agrupar", "indefinida"];
const AUTO = 0.9, SUGERE = 0.5;
const SCHEMA = { type: "OBJECT", properties: { itens: { type: "ARRAY", items: { type: "OBJECT", properties: {
  tipo: { type: "STRING", enum: TIPOS }, tarefas: { type: "ARRAY", items: { type: "STRING" } }, novo_prazo: { type: "STRING" }, novo_responsavel: { type: "STRING" },
  titulo: { type: "STRING" }, motivo: { type: "STRING" }, trecho: { type: "STRING" }, certeza: { type: "NUMBER" } },
  required: ["tipo", "tarefas", "motivo", "trecho", "certeza"] } } }, required: ["itens"] };
const plainMd = md => String(md || "").replace(/\\([\[\]()*_#~\-.!>&])/g, "$1").replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\((?:https?|mailto):[^)]*\)/g, "$1");
const flat = t => norm(t).replace(/[^a-z0-9]+/g, " ").trim();

function reviewer(pages, members) {
  const page = id => pages.get(id);
  const alive = p => { let n = p, i = 0; while (n && i++ < 40) { if (n.trashed) return false; if (!n.parent) return true; n = page(n.parent); } return false; };
  const kids = id => [...pages.values()].filter(p => (p.parent || null) === (id || null) && !p.trashed).sort((a, b) => (a.order || 0) - (b.order || 0));
  const props = d => (d.schema && d.schema.props) || [];
  const dbs = () => [...pages.values()].filter(x => x.kind === "db" && alive(x));
  const meetDb = () => { const d = page("reunioes"); return d && alive(d) && d.kind === "db" ? d : dbs().find(x => norm(x.title) === "reunioes"); };
  const taskDb = () => dbs().find(d => d.tpl === "tarefas");
  const teamDb = () => { const d = page("equipes"); return d && alive(d) && d.kind === "db" ? d : dbs().find(x => x.tpl === "equipes"); };
  const F = () => { const td = taskDb(), mdb = meetDb(), tdb = teamDb(); if (!td || !mdb) return null;
    const ps = props(td), st = ps.find(p => p.type === "status"), wp = ps.find(p => p.type === "person"), du = ps.find(p => p.type === "date" && !/in[ií]cio/i.test(p.name || ""));
    return { td, mdb, tdb, st, wp, du, rel: ps.find(p => p.type === "relation" && p.db === mdb.id), tr: tdb && ps.find(p => p.type === "relation" && p.db === tdb.id), dp: props(mdb).find(p => p.type === "date"),
      done: st && (st.options || []).find(o => /conclu|feit|done/.test(norm(o.name))) }; };
  const optName = (p, v) => ((p && (p.options || []).find(o => o.id === v)) || {}).name || "";
  const closed = (f, r) => /conclu|cancel|feit|done/.test(norm(optName(f.st, (r.props || {})[f.st && f.st.id])));
  const series = t => flat(String(t || "").replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}.*$/, ""));
  const bodyOf = r => String(((r.blocks || []).find(b => b.t === "p" && b.h) || {}).h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const teamOf = title => { const t = teamDb(); if (!t) return null; const toks = norm(String(title || "").replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}.*$/, "")).split(/[^a-z0-9&]+/).filter(Boolean);
    return kids(t.id).find(r => { const k = norm(r.title).replace(/\s+/g, ""); return k && toks.some(x => x === k || (k.length >= 5 && x.length >= 5 && x.slice(0, 5) === k.slice(0, 5))); }) || null; };
  const leaderOf = tm => { const t = teamDb(); if (!t || !tm) return null; const lp = props(t).find(p => p.type === "person"), name = lp && optName(lp, (tm.props || {})[lp.id]); const mb = name && members.find(m => norm(m.name) === norm(name)); return mb ? { email: mb.id, name } : name ? { email: "", name } : null; };
  const person = (name, opts) => { const n = norm(name); if (!n) return null; let o = opts.find(o => norm(o.name) === n); if (o) return o; const tk = n.split(" ");
    const hit = opts.filter(o => { const ot = norm(o.name).split(" "); return ot[0] === tk[0] && (tk.length === 1 || ot.includes(tk[tk.length - 1])); }); return hit.length === 1 ? hit[0] : null; };

  // tarefas abertas que podem ter sido citadas nesta reunião: as desta reunião, as da mesma série, as dos participantes e as da equipe
  function candidates(meet) {
    const f = F(); if (!f) return [];
    const ser = series(meet.title), prev = new Set(kids(f.mdb.id).filter(r => series(r.title) === ser).map(r => r.id)), tm = teamOf(meet.title);
    const pp = props(f.mdb).find(p => p.type === "multi"), guests = new Set(((meet.props || {})[pp && pp.id] || []).map(id => norm(optName(pp, id))));
    const rows = kids(f.td.id).filter(r => !closed(f, r)).map(r => { const rl = (f.rel && (r.props || {})[f.rel.id]) || [], own = norm(optName(f.wp, (r.props || {})[f.wp && f.wp.id]));
      const nova = rl.includes(meet.id), rank = nova ? 0 : rl.some(x => prev.has(x)) ? 1 : (f.tr && tm && ((r.props || {})[f.tr.id] || []).includes(tm.id)) ? 2 : guests.has(own) && own ? 3 : 9;
      return { r, nova, rank }; }).filter(x => x.rank < 9).sort((a, b) => a.rank - b.rank || String((a.r.props || {})[f.du && f.du.id] || "9").localeCompare(String((b.r.props || {})[f.du && f.du.id] || "9"))).slice(0, 90);
    return rows.map((x, i) => ({ key: "T" + (i + 1), id: x.r.id, nova: x.nova, titulo: x.r.title || "", responsavel: optName(f.wp, (x.r.props || {})[f.wp && f.wp.id]), prazo: (x.r.props || {})[f.du && f.du.id] || "", descricao: bodyOf(x.r).slice(0, 180) }));
  }

  // correções que o time já fez (sugestões rejeitadas ou mudanças desfeitas): entram no pedido como exemplos do que não repetir
  function examples() {
    const f = F(); if (!f) return [];
    const out = []; kids(f.mdb.id).forEach(m => ((m.rev && m.rev.itens) || []).forEach(it => { if (it.estado === "rejeitada" || it.estado === "desfeita") out.push({ ts: it.dts || m.rev.ts || 0, tipo: it.tipo, tarefa: (it.titulos || [])[0] || "", trecho: it.trecho || "", motivo: it.motivo || "" }); }));
    return out.sort((a, b) => b.ts - a.ts).slice(0, 12);
  }
  function stats() {
    const f = F(), s = { certas: 0, erradas: 0, pendentes: 0 }; if (!f) return s;
    kids(f.mdb.id).forEach(m => ((m.rev && m.rev.itens) || []).forEach(it => { if (it.estado === "aprovada" || it.estado === "aplicada") s.certas++; else if (it.estado === "rejeitada" || it.estado === "desfeita") s.erradas++; else if (it.estado === "sugerida") s.pendentes++; }));
    return s;
  }

  function prompt(meet, md, cands, today) {
    const ex = examples();
    return [
      "Você revisa a ata de uma reunião de trabalho de uma empresa brasileira e compara com a lista de tarefas abertas do time.",
      "Hoje é " + today + ". Reunião: " + (meet.title || "") + ".",
      "Devolva apenas o que a ata permite afirmar. Na dúvida, não devolva o item. Cada item precisa de um TRECHO copiado literalmente da ata (uma frase curta, sem alterar palavras) que comprove a conclusão, e de uma CERTEZA de 0 a 1.",
      "Tipos de item:",
      "- concluir: a ata diz que a tarefa foi feita, entregue, enviada, assinada ou resolvida. Não vale intenção de fazer.",
      "- adiar: a ata dá uma nova data para a tarefa. Preencha novo_prazo como AAAA-MM-DD.",
      "- repassar: a ata passa a tarefa para outra pessoa. Preencha novo_responsavel com o nome.",
      "- juntar: uma tarefa marcada como NOVA repete, com outras palavras, uma tarefa antiga da lista. Em tarefas, coloque primeiro a nova e depois a antiga.",
      "- agrupar: duas ou mais tarefas NOVAS da mesma pessoa são passos pequenos do mesmo assunto e ficam melhores como uma tarefa só. Em tarefas, liste todas; em titulo, escreva o título da tarefa única, começando por um verbo.",
      "- indefinida: tarefa NOVA vaga, sem ação clara ou sem responsável definido (por exemplo, atribuída a \"o grupo\").",
      "Regras: use somente os códigos da lista (T1, T2...). concluir, adiar e repassar valem só para tarefas que NÃO estão marcadas como NOVA. Não invente tarefas. Não repita o mesmo par de tipo e tarefa.",
      ex.length ? "O time rejeitou estas sugestões em reuniões anteriores. Não repita o mesmo tipo de erro:\n" + ex.map(e => "- " + e.tipo + " em \"" + e.tarefa + "\" com base em \"" + String(e.trecho).slice(0, 140) + "\"").join("\n") : "",
      "TAREFAS ABERTAS:",
      cands.map(c => c.key + (c.nova ? " [NOVA]" : "") + " | " + c.titulo + " | responsável: " + (c.responsavel || "sem dono") + " | prazo: " + (c.prazo || "sem prazo") + (c.descricao ? " | " + c.descricao : "")).join("\n"),
      "ATA:",
      plainMd(md).slice(0, 24000)
    ].filter(Boolean).join("\n\n");
  }

  // transforma a resposta da IA em mudanças: devolve os documentos a gravar (tarefas alteradas e a reunião com o registro da revisão)
  function apply(meet, out, md, cands, today, opt) {
    const f = F(); if (!f) return { docs: [], rev: null };
    const auto = !opt || opt.auto !== false, now = Date.now(), text = flat(plainMd(md)), byKey = new Map(cands.map(c => [c.key, c])), seen = new Set(), touched = new Set(), changed = new Map(), itens = [];
    const tm = teamOf(meet.title), ld = leaderOf(tm), get = id => changed.get(id) || page(id);
    const edit = id => { if (!changed.has(id)) { const r = page(id); changed.set(id, Object.assign({}, r, { props: Object.assign({}, r.props), botlog: (r.botlog || []).slice() })); } return changed.get(id); };
    ((out && out.itens) || []).forEach(x => {
      if (!x || !TIPOS.includes(x.tipo)) return;
      const cs = (Array.isArray(x.tarefas) ? x.tarefas : []).map(k => byKey.get(String(k).trim())).filter(Boolean); if (!cs.length) return;
      const key = x.tipo + ":" + cs.map(c => c.id).join(","); if (seen.has(key)) return; seen.add(key);
      const q = flat(x.trecho), found = q.length >= 12 && text.includes(q); let conf = Math.max(0, Math.min(1, Number(x.certeza) || 0)); if (!found) conf = Math.min(conf, 0.6);
      const it = { id: rid(), tipo: x.tipo, tarefas: cs.map(c => c.id), titulos: cs.map(c => c.titulo), motivo: String(x.motivo || "").slice(0, 300), trecho: String(x.trecho || "").slice(0, 300), conferido: found, certeza: Math.round(conf * 100) / 100, estado: "sugerida" };
      const t0 = cs[0], r0 = get(t0.id);
      if (x.tipo === "concluir" || x.tipo === "adiar" || x.tipo === "repassar") {
        if (t0.nova || conf < SUGERE || touched.has(t0.id)) return; touched.add(t0.id); // uma mudança por tarefa a cada reunião it.tarefas = [t0.id]; it.titulos = [t0.titulo];
        if (x.tipo === "concluir" && !f.done) return;
        if (x.tipo === "adiar") { const d = String(x.novo_prazo || "").slice(0, 10); if (!f.du || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d === (r0.props || {})[f.du.id] || d < addDays(today, -1)) return; it.prazo = d; }
        if (x.tipo === "repassar") { const o = f.wp && person(x.novo_responsavel, f.wp.options || []); if (!o || o.id === (r0.props || {})[f.wp.id]) return; it.quem = o.id; it.quemNome = o.name; }
        if (auto && found && conf >= AUTO) {
          const r = edit(t0.id);
          if (x.tipo === "concluir") { it.antes = { st: r.props[f.st.id] || null }; r.props[f.st.id] = f.done.id; }
          if (x.tipo === "adiar") { it.antes = { du: r.props[f.du.id] || null }; r.props[f.du.id] = it.prazo; }
          if (x.tipo === "repassar") { it.antes = { wp: r.props[f.wp.id] || null }; r.props[f.wp.id] = it.quem; r.asg = Object.assign({}, r.asg, { [f.wp.id]: { by: "bot", name: "Bot de atas", ts: now } }); }
          r.botlog.push({ ts: now, meet: meet.id, item: it.id, tipo: x.tipo, trecho: it.trecho, por: "bot" }); r.ts = now; r.sid = "bot";
          it.estado = "aplicada"; it.dts = now;
        }
      } else if (x.tipo === "juntar") {
        const nova = cs.find(c => c.nova), velha = cs.find(c => !c.nova); if (!nova || !velha || conf < SUGERE) return; it.tarefas = [nova.id, velha.id]; it.titulos = [nova.titulo, velha.titulo];
      } else if (x.tipo === "agrupar") {
        const novas = cs.filter(c => c.nova); if (novas.length < 2 || conf < 0.6 || new Set(novas.map(c => c.responsavel)).size > 1) return; it.tarefas = novas.map(c => c.id); it.titulos = novas.map(c => c.titulo); it.titulo = String(x.titulo || novas[0].titulo).slice(0, 140);
      } else if (x.tipo === "indefinida") {
        if (!t0.nova || conf < SUGERE) return; it.tarefas = [t0.id]; it.titulos = [t0.titulo]; it.estado = "aviso";
      }
      itens.push(it);
    });
    const rev = { ts: now, modelo: (opt && opt.model) || "", equipe: tm ? tm.title || "" : "", lider: ld ? ld.email : "", liderNome: ld ? ld.name : "", lidas: cands.length, itens };
    const m2 = Object.assign({}, meet, { rev }); // não muda ts da reunião: a revisão não é uma edição do conteúdo
    return { docs: [...changed.values(), m2], rev };
  }

  // pauta de pendências: na véspera de uma reunião recorrente, cria a linha da reunião com o que ficou aberto das anteriores
  function pautas(today, calPages) {
    const f = F(); if (!f) return [];
    const wd = new Date(today + "T12:00:00Z").getUTCDay(), targets = [addDays(today, 1)].concat(wd === 5 ? [addDays(today, 3)] : []), meets = kids(f.mdb.id), out = [];
    const bySer = new Map(); meets.forEach(m => { const s = series(m.title); if (!s) return; (bySer.get(s) || bySer.set(s, []).get(s)).push(m); });
    const evs = []; (calPages || []).forEach(c => (c.events || []).forEach(e => { if (targets.includes(e.date) && e.title) evs.push(e); }));
    bySer.forEach((list, ser) => {
      const dated = list.filter(m => (m.props || {})[f.dp && f.dp.id]).sort((a, b) => String((b.props || {})[f.dp.id]).localeCompare(String((a.props || {})[f.dp.id]))), last = dated[0];
      if (!last || (last.props || {})[f.dp.id] < addDays(today, -21) || last.src === "pauta") return;
      const ev = evs.find(e => flat(e.title) === ser); if (!ev) return;
      if (ev.date < addDays((last.props || {})[f.dp.id], 5)) return; // só reuniões semanais ou mais espaçadas: daily não ganha pauta todo dia
      const id = "pauta-" + ser.replace(/[^a-z0-9]+/g, "-").slice(0, 34) + "-" + ev.date; if (page(id) || list.some(m => (m.props || {})[f.dp.id] === ev.date)) return;
      const ids = new Set(list.map(m => m.id)), open = kids(f.td.id).filter(r => !closed(f, r) && f.rel && ((r.props || {})[f.rel.id] || []).some(x => ids.has(x)));
      if (!open.length) return;
      const B = (t, h) => ({ id: rid(), t, h }), who = r => optName(f.wp, (r.props || {})[f.wp && f.wp.id]) || "Sem responsável", byWho = new Map();
      open.forEach(r => { const k = who(r); (byWho.get(k) || byWho.set(k, []).get(k)).push(r); });
      const line = r => { const d = (r.props || {})[f.du && f.du.id] || ""; return '<a href="#p-' + r.id + '">' + esc(r.title || "Sem título") + "</a>" + (d ? " · prazo " + fmtDate(d) + (d < today ? " (atrasada)" : "") : " · sem prazo"); };
      const late = open.filter(r => { const d = (r.props || {})[f.du && f.du.id]; return d && d < today; }).length, stale = open.filter(r => (r.ts || 0) < Date.parse(today) - 21 * 864e5);
      const blocks = [B("h2", "Pendências para esta reunião"), B("p", esc(open.length + (open.length === 1 ? " tarefa aberta" : " tarefas abertas") + " das reuniões anteriores" + (late ? ", " + late + (late === 1 ? " atrasada" : " atrasadas") : "") + ". Lista montada pelo bot de atas na véspera."))];
      [...byWho.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, rs]) => { blocks.push(B("h3", esc(k) + " (" + rs.length + ")")); rs.sort((a, b) => String((a.props || {})[f.du && f.du.id] || "9").localeCompare(String((b.props || {})[f.du && f.du.id] || "9"))).forEach(r => blocks.push(B("ul", line(r)))); });
      if (stale.length) { blocks.push(B("h2", "Paradas há mais de 3 semanas")); stale.forEach(r => blocks.push(B("ul", line(r) + " · " + esc(who(r))))); }
      blocks.push(B("p", ""));
      const title = String(last.title || "").replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}.*$/, "") + " — " + fmtDate(ev.date), pp = props(f.mdb).find(p => p.type === "multi"), pr = { [f.dp.id]: ev.date };
      if (pp && (last.props || {})[pp.id]) pr[pp.id] = (last.props || {})[pp.id];
      out.push({ id, kind: "page", title, parent: f.mdb.id, order: ((kids(f.mdb.id).at(-1) || {}).order || 0) + 1 + out.length, props: pr, blocks, src: "pauta", ts: Date.now(), sid: "bot", by: "bot", lock: !!f.mdb.lock, acl: f.mdb.lock && Array.isArray(f.mdb.acl) ? f.mdb.acl.slice() : [] });
    });
    return out;
  }

  // tarefas vindas de reunião, abertas e sem nenhuma alteração há mais de 3 semanas: o dono recebe uma pergunta nos Avisos
  function staleAsks(today) {
    const f = F(); if (!f || !f.rel) return [];
    const lim = Date.parse(today) - 21 * 864e5, again = Date.parse(today) - 14 * 864e5;
    return kids(f.td.id).filter(r => !closed(f, r) && ((r.props || {})[f.rel.id] || []).length && (r.ts || 0) < lim && !(r.ask && r.ask.ts > again) && (r.props || {})[f.wp && f.wp.id])
      .slice(0, 40).map(r => Object.assign({}, r, { ask: { ts: Date.now(), dias: Math.round((Date.parse(today) - (r.ts || 0)) / 864e5) } }));
  }
  const pending = (days, today) => { const f = F(); if (!f) return []; const lim = addDays(today, -days); return kids(f.mdb.id).filter(m => !m.rev && m.src !== "pauta" && (m.gdoc || (m.gdocs || []).length) && ((m.props || {})[f.dp && f.dp.id] || "") >= lim); };
  return { candidates, prompt, apply, pautas, staleAsks, stats, examples, pending, series };
}
module.exports = { reviewer, SCHEMA, AUTO, SUGERE };
