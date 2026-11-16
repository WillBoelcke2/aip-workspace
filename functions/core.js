// Bot de atas: lógica pura (sem Firebase), espelho do que o workspace faz no navegador.
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const iso = dt => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
const fmtDate = v => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : "";
const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rid = () => Math.random().toString(36).slice(2, 10);
const ataId = id => "ata-" + String(id).replace(/[^\w-]/g, "").slice(0, 50);
const PRIV = /(^|[^\d])1\s*[:x]\s*1([^\d]|$)|one.on.one|desempenho|feedback|\bpdi\b|avalia[cç][aã]o|sal[aá]ri|remunera|demiss|deslig|societ|confidencial|jur[ií]dic|\brh\b|entrevista/i;

function parse(name, md) {
  const un = t => String(t || "").replace(/\\([\[\]()*_#~\-.!>&])/g, "$1").replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\((?:https?|mailto):[^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  const dm = /(\d{4})[\/-](\d\d)[\/-](\d\d)/.exec(name || ""), date = dm ? dm[1] + "-" + dm[2] + "-" + dm[3] : null;
  const title = un(String(name || "").replace(/\s*[-–]\s*\d{4}[\/-]\d\d[\/-]\d\d.*$/, "").replace(/\s*[-–]\s*(Notes by Gemini|Anota[cç][oõ]es do Gemini|Observa[cç][oõ]es do Gemini)\s*$/i, "")) || "Reunião";
  const guests = []; md.replace(/\[(~~)?([^\]]+?)(~~)?\]\(mailto:([^)]+)\)/g, (_, x, n, y, e) => { if (!x && !guests.some(g => g.email === e.toLowerCase())) guests.push({ name: un(n), email: e.toLowerCase() }); return ""; });
  const sec = {}; let cur = "";
  md.split(/\r?\n/).forEach(l => { const h = /^#{2,3}\s+(.*)$/.exec(l); if (h) { const k = norm(un(h[1])); cur = /^resumo|^summary/.test(k) ? "sum" : /^decis/.test(k) ? "dec" : /^proxim|^suggested next|^next steps|^etapas/.test(k) ? "next" : /^detal|^details/.test(k) ? "det" : cur === "dec" ? "dec" : ""; return; } if (cur) (sec[cur] = sec[cur] || []).push(l); });
  const bl = k => (sec[k] || []).map(l => /^\s*[-*•]\s+(.*)$/.exec(l)).filter(Boolean).map(m => un(m[1])).filter(Boolean);
  const summary = un((sec.sum || []).join("\n").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)[0] || "");
  const steps = bl("next").map(t => { const m = /^\[([^\]]+)\]\s*(.*)$/.exec(t); const who = m ? m[1].trim() : "", rest = m ? m[2] : t; const i = rest.indexOf(": "); return { who, title: (i > 0 && i < 90 ? rest.slice(0, i) : rest).trim(), desc: i > 0 && i < 90 ? rest.slice(i + 2).trim() : "" }; }).filter(x => x.title);
  return { title, date, guests, summary, decisions: bl("dec"), steps };
}
const gloss = d => (Array.isArray(d && d.gloss) ? d.gloss : []).map(l => String(l).split("=").map(x => x.trim())).filter(g => g.length === 2 && g[0] && g[1]);
function fix(t, gl) { gl.forEach(([a, b]) => { try { t = t.replace(new RegExp("(^|[^\\wÀ-ÿ])" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\wÀ-ÿ])", "g"), (m, pre) => pre + b); } catch (_) {} }); return t; }
function due(text, base) {
  const b = new Date(base + "T12:00:00"), add = n => iso(new Date(b.getFullYear(), b.getMonth(), b.getDate() + n)), t = norm(text);
  const M = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"], m = /(\d{1,2})\s+de\s+([a-z]+)/.exec(t);
  if (m && M.includes(m[2])) { let d = new Date(b.getFullYear(), M.indexOf(m[2]), +m[1]); if (d < new Date(b.getFullYear(), b.getMonth(), b.getDate() - 30)) d = new Date(b.getFullYear() + 1, M.indexOf(m[2]), +m[1]); return iso(d); }
  if (/\bamanha\b/.test(t)) return add(1); if (/\bhoje\b/.test(t)) return add(0); return add(7);
}

// pages: Map(id -> doc); members: [{id: email, name}]
function workspace(pages, members) {
  const page = id => pages.get(id);
  const alive = p => { let n = p, i = 0; while (n && i++ < 40) { if (n.trashed) return false; if (!n.parent) return true; n = page(n.parent); } return false; };
  const kids = id => [...pages.values()].filter(p => (p.parent || null) === (id || null) && !p.trashed).sort((a, b) => (a.order || 0) - (b.order || 0));
  const props = d => (d.schema && d.schema.props) || [];
  const dbs = () => [...pages.values()].filter(x => x.kind === "db" && alive(x));
  const meetDb = () => { const d = page("reunioes"); return d && alive(d) && d.kind === "db" ? d : dbs().find(x => norm(x.title) === "reunioes"); };
  const taskDb = () => dbs().find(d => d.tpl === "tarefas");
  const teamDb = () => { const d = page("equipes"); return d && alive(d) && d.kind === "db" ? d : dbs().find(x => x.tpl === "equipes"); };
  const seen = id => pages.has(ataId(id)) || [...pages.values()].some(p => p.gdoc === id);
  const who = (name, guests, opts) => {
    const n = norm(name); if (!n || /^(o grupo|grupo|todos|equipe|time|the group|everyone)$/.test(n)) return null;
    const g = guests.find(x => norm(x.name) === n), mb = g && members.find(m => m.id === g.email);
    if (mb && mb.name) { const o = opts.find(o => norm(o.name) === norm(mb.name)); if (o) return o; }
    const o = opts.find(o => norm(o.name) === n); if (o) return o;
    const tk = n.split(" "), hit = opts.filter(o => { const ot = norm(o.name).split(" "); return ot[0] === tk[0] && (tk.length === 1 || ot.includes(tk[tk.length - 1])); });
    if (hit.length === 1) return hit[0]; const f = opts.filter(o => norm(o.name).split(" ")[0] === tk[0]); return f.length === 1 ? f[0] : null;
  };
  const byEmail = (email, opts) => { const mb = members.find(m => m.id === email); return mb && mb.name ? opts.find(o => norm(o.name) === norm(mb.name)) || null : null; };
  const team = title => { const t = teamDb(); if (!t) return null; const toks = norm(title).split(/[^a-z0-9&]+/).filter(Boolean);
    return kids(t.id).find(r => { const k = norm(r.title).replace(/\s+/g, ""); return k && toks.some(x => x === k || (k.length >= 5 && x.length >= 5 && x.slice(0, 5) === k.slice(0, 5))); }) || null; };
  const leader = (tm, opts) => { const t = teamDb(); if (!t || !tm) return null; const lp = props(t).find(p => p.type === "person"); const o = lp && (lp.options || []).find(o => o.id === (tm.props || {})[lp.id]); return o ? opts.find(x => norm(x.name) === norm(o.name)) || null : null; };

  // devolve os documentos a gravar (vazio se a ata já entrou ou não deve entrar sozinha)
  function build(file, md, ownerEmail, byEmailAddr) {
    const mdb = meetDb(), td = taskDb(); if (!mdb || seen(file.id)) return { docs: [], why: mdb ? "seen" : "no-db" };
    const a = parse(file.name, md); if (!a.date) a.date = String(file.modifiedTime || new Date().toISOString()).slice(0, 10);
    if (!a.summary && !a.steps.length && !a.decisions.length) return { docs: [], why: "empty" };
    if (a.guests.length < 3 || PRIV.test(a.title)) return { docs: [], why: "private" };
    const gl = gloss(mdb), fx = t => fix(t, gl), now = Date.now(), id = ataId(file.id), out = [];
    const base = par => ({ ts: now, sid: "bot", by: byEmailAddr || "bot", lock: !!par.lock, acl: par.lock && Array.isArray(par.acl) ? par.acl.slice() : [] });
    const B = (t, h) => ({ id: rid(), t, h });
    const dp = props(mdb).find(p => p.type === "date"), pp = props(mdb).find(p => p.type === "multi");
    const row = Object.assign({ id, kind: "page", title: fx(a.title) + " — " + fmtDate(a.date), parent: mdb.id, order: ((kids(mdb.id).at(-1) || {}).order || 0) + 1, props: {}, blocks: [], gdoc: file.id, src: "ata-bot" }, base(mdb));
    if (dp) row.props[dp.id] = a.date;
    if (pp) { const ids = a.guests.map(g => who(g.name, a.guests, pp.options || [])).filter(Boolean).map(o => o.id); if (ids.length) row.props[pp.id] = [...new Set(ids)]; }
    if (a.summary) row.blocks.push(B("h2", "Resumo"), B("p", esc(fx(a.summary))));
    if (a.decisions.length) { row.blocks.push(B("h2", "Decisões")); a.decisions.forEach(x => row.blocks.push(B("ul", esc(fx(x))))); }
    row.blocks.push(B("h2", "Ata completa"), B("p", '<a href="https://docs.google.com/document/d/' + encodeURIComponent(file.id) + '/edit">Abrir as anotações do Gemini</a>'), B("p", ""));
    out.push(row);
    if (td) {
      const wp = props(td).find(p => p.type === "person"), du = props(td).find(p => p.type === "date" && !/in[ií]cio/i.test(p.name)), st = props(td).find(p => p.type === "status");
      const rel = props(td).find(p => p.type === "relation" && p.db === mdb.id), tdb = teamDb(), tr = tdb && props(td).find(p => p.type === "relation" && p.db === tdb.id);
      const opts = wp ? wp.options || [] : [], tm = team(a.title), lead = leader(tm, opts), fallback = byEmail(ownerEmail, opts);
      const last = (kids(td.id).at(-1) || {}).order || 0;
      a.steps.forEach((x, i) => {
        const rid2 = "at-" + id.slice(4, 40) + "-" + i; if (pages.has(rid2)) return;
        const o = who(x.who, a.guests, opts) || lead || fallback;
        const r = Object.assign({ id: rid2, kind: "page", title: fx(x.title), parent: td.id, order: last + 1 + i, props: {}, blocks: x.desc ? [B("p", esc(fx(x.desc))), B("p", "")] : [], src: "ata:" + file.id }, base(td));
        if (wp && o) { r.props[wp.id] = o.id; r.asg = { [wp.id]: { by: "bot", name: "Bot de atas", ts: now } }; }
        if (du) r.props[du.id] = due(x.title + " " + x.desc, a.date);
        if (st && st.options && st.options[0]) r.props[st.id] = st.options[0].id;
        if (rel) r.props[rel.id] = [id]; if (tr && tm) r.props[tr.id] = [tm.id];
        out.push(r);
      });
    }
    out.forEach(d => pages.set(d.id, d));
    return { docs: out, why: "ok" };
  }
  return { build, seen, meetDb };
}
module.exports = { parse, workspace, ataId, norm };
