/**
 * OntoLexGraph v7 — clear UML compartments, full text, calm edge routing
 *
 * Node:
 *   «class»
 *   title (IRI)
 *   ─────────────
 *   subclass
 *   ─────────────
 *   properties / values (wrapped, no ellipsis)
 *
 * Layout: left→right columns, order by parent median (no back-prop scramble).
 * Fit: centered in canvas.
 */
(function (root) {
  "use strict";

  const STYLE_ID = "ontolex-graph-style";
  const COL_W = 200;
  const COL_GAP = 100;
  const ROW_GAP = 36;
  const NODE_PAD_X = 10;
  const LINE = 11;
  const PAD = 40;
  const CHAR_W = 6.1;

  const CSS = `
.ox-lg{display:flex;flex-direction:column;gap:.4rem;min-height:16rem;font-size:.8rem;color:#1a1a1a}
.ox-lg-note{margin:0;padding:.35rem.6rem;font-size:.72rem;line-height:1.35;color:#555;background:#f5f5f5;border:1px solid #ddd;border-radius:6px}
.ox-lg-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem.55rem;font-size:.68rem;color:#666}
.ox-lg-toolbar button{font:inherit;font-size:.68rem;font-weight:600;padding:.2rem.48rem;border:1px solid #ccc;border-radius:5px;background:#fff;cursor:pointer}
.ox-lg-toolbar button:hover{border-color:#1f4d38;color:#1f4d38}
.ox-lg-legend{margin-left:auto;display:inline-flex;flex-wrap:wrap;gap:.5rem}
.ox-lg-leg{display:inline-flex;align-items:center;gap:.25rem}
.ox-lg-dot{width:.65rem;height:.65rem;border-radius:2px;border:1px solid}
.ox-lg-dot.struct{background:#e3eef7;border-color:#5a7ea0}
.ox-lg-dot.lex{background:#f7efe4;border-color:#a67c4a}
.ox-lg-dot.form{background:#eef3f8;border-color:#6a849e}
.ox-lg-dot.sense{background:#eef6ea;border-color:#5a8a5a}
.ox-lg-viewport{position:relative;flex:1;min-height:20rem;height:28rem;border:1px solid #c8c8c8;border-radius:8px;background:linear-gradient(180deg,#fbfbfb,#f4f4f4);overflow:hidden;cursor:grab;touch-action:none}
.ox-lg-viewport.is-panning{cursor:grabbing}
.ox-lg-viewport svg{display:block;width:100%;height:100%;user-select:none}
.ox-lg-hint{position:absolute;left:.45rem;bottom:.3rem;font-size:.62rem;color:#999;pointer-events:none}
.ox-lg-node{cursor:pointer}
.ox-lg-node .card{fill:#fff;stroke:#444;stroke-width:1.35;rx:3;ry:3}
.ox-lg-node .head{fill:#f0f0f0;stroke:none}
.ox-lg-node.kind-struct .card{fill:#f4f8fb;stroke:#5a7ea0}
.ox-lg-node.kind-struct .head{fill:#e3eef7}
.ox-lg-node.kind-lex .card{fill:#faf6f0;stroke:#a67c4a}
.ox-lg-node.kind-lex .head{fill:#f3e8d8}
.ox-lg-node.kind-form .card{fill:#f5f8fb;stroke:#6a849e}
.ox-lg-node.kind-form .head{fill:#e4edf5}
.ox-lg-node.kind-sense .card{fill:#f4f9f2;stroke:#5a8a5a}
.ox-lg-node.kind-sense .head{fill:#e2efdd}
.ox-lg-node.kind-lit .card{fill:#fff;stroke:#888}
.ox-lg-node.kind-lit .head{fill:#f0f0f0}
.ox-lg-node.kind-rel .card{fill:#faf6f2;stroke:#8a7a68}
.ox-lg-node.kind-rel .head{fill:#efe6dc}
.ox-lg-node.ox-hot .card{stroke:#1f4d38!important;stroke-width:2.2}
.ox-lg-node.ox-hot .head{fill:#dceee6!important}
.ox-lg-node .stereo{font-size:8.5px;font-style:italic;fill:#555}
.ox-lg-node .title{font-size:10.5px;font-weight:700;fill:#111;font-family:ui-monospace,Consolas,monospace}
.ox-lg-node .sec-label{font-size:7.5px;font-weight:700;fill:#777;letter-spacing:.05em;text-transform:uppercase}
.ox-lg-node .line{font-size:9px;fill:#333;font-family:ui-monospace,Consolas,monospace}
.ox-lg-node .sub{font-size:9px;fill:#1f4d38;font-family:ui-monospace,Consolas,monospace}
.ox-lg-node .div{stroke:#666;stroke-width:1}
.ox-lg-edge{fill:none;stroke:#4a4a4a;stroke-width:1.3}
.ox-lg-edge-label{font-size:8px;font-family:ui-monospace,Consolas,monospace;fill:#222;paint-order:stroke;stroke:#f7f7f7;stroke-width:3.5px;pointer-events:none}
`;

  function ensureStyle() {
    if (typeof document === "undefined") return;
    const prev = document.getElementById(STYLE_ID);
    if (prev) prev.remove();
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function propLines(n) {
    if (Array.isArray(n.lines) && n.lines.length) return n.lines.map(String);
    if (Array.isArray(n.props) && n.props.length) {
      return n.props.map((p) =>
        typeof p === "string" ? p : [p.key, p.value].filter((x) => x != null).join(" ")
      );
    }
    return [];
  }

  function wrapText(text, maxChars) {
    const s = String(text ?? "");
    if (!s) return [];
    if (s.length <= maxChars) return [s];
    const out = [];
    const parts = s.split(/(\s+)/);
    let cur = "";
    parts.forEach((part) => {
      if (!part) return;
      if ((cur + part).length <= maxChars) {
        cur += part;
        return;
      }
      if (cur.trim()) out.push(cur.replace(/\s+$/, ""));
      if (part.length > maxChars) {
        for (let i = 0; i < part.length; i += maxChars) out.push(part.slice(i, i + maxChars));
        cur = "";
      } else {
        cur = part.replace(/^\s+/, "");
      }
    });
    if (cur.trim()) out.push(cur.replace(/\s+$/, ""));
    return out.length ? out : [s];
  }

  function maxCharsFor(w) {
    return Math.max(18, Math.floor((w - NODE_PAD_X * 2) / CHAR_W));
  }

  function kindOf(n) {
    if (n.kind) return n.kind;
    const c = String(n.cls || "");
    if (/LexicographicResource|lexicog:Entry/i.test(c)) return "struct";
    if (/LexicalSense/i.test(c)) return "sense";
    if (/Form\b/i.test(c)) return "form";
    if (/definition|example|note|langString/i.test(c)) return "lit";
    if (/vartrans|LexicalRelation|SenseRelation/i.test(c + (n.title || ""))) return "rel";
    return "lex";
  }

  function buildBody(n, colW) {
    const mc = maxCharsFor(colW);
    const classLines = wrapText("«" + String(n.cls || "Resource") + "»", mc);
    const titleLines = wrapText(String(n.title || n.uri || n.id), mc);
    const subRaw = n.sub || n.subclass || "";
    const subLines = subRaw
      ? ["subclass"].concat(wrapText(String(subRaw), mc))
      : [];
    const vals = propLines(n);
    const valLines = vals.length
      ? ["values"].concat(vals.flatMap((v) => wrapText(v, mc)))
      : [];
    return { classLines, titleLines, subLines, valLines, mc };
  }

  function measure(n, colW) {
    const w = colW || n.w || COL_W;
    const b = buildBody(n, w);
    const headLines = b.classLines.length + b.titleLines.length;
    const headH = Math.max(28, 6 + headLines * LINE + 6);
    let body = 0;
    if (b.subLines.length) body += 4 + b.subLines.length * LINE + 4;
    if (b.valLines.length) body += 4 + b.valLines.length * LINE + 6;
    if (!b.subLines.length && !b.valLines.length) body += 14;
    return {
      w,
      h: headH + body + 4,
      headH,
      body: b,
      kind: kindOf(n),
    };
  }

  function packColumn(list, rowGap) {
    list.sort((a, b) => {
      if (a.rank != null && b.rank != null && a.rank !== b.rank) return a.rank - b.rank;
      if (a.row != null && b.row != null && a.row !== b.row) return a.row - b.row;
      return String(a.id).localeCompare(String(b.id));
    });
    list.forEach((m, i) => {
      if (i === 0) {
        m.y = m.yIdeal != null ? m.yIdeal : 0;
        return;
      }
      const prev = list[i - 1];
      const minY = prev.y + prev.h + rowGap;
      m.y = m.yIdeal != null ? Math.max(m.yIdeal, minY) : minY;
    });
  }

  function layout(nodes, availW, edges) {
    const measured = {};
    nodes.forEach((n) => {
      const colGuess = n.col != null ? n.col : 0;
      measured[n.id] = Object.assign({ id: n.id }, n, { col: colGuess });
    });

    // Keep model columns (do not fold — folding scrambles links)
    Object.values(measured).forEach((m) => {
      if (m.col == null) m.col = 0;
    });

    const byCol = {};
    Object.values(measured).forEach((m) => {
      if (!byCol[m.col]) byCol[m.col] = [];
      byCol[m.col].push(m);
    });
    const cols = Object.keys(byCol).map(Number).sort((a, b) => a - b);
    const nCol = Math.max(1, cols.length);

    let colW = COL_W;
    let gap = COL_GAP;
    const budget = availW && availW > 140 ? Math.max(240, availW - 8) : null;
    if (budget) {
      const minGap = 64;
      const ideal = PAD * 2 + nCol * COL_W + Math.max(0, nCol - 1) * COL_GAP;
      if (ideal > budget) {
        colW = Math.max(150, Math.min(COL_W, Math.floor((budget - PAD * 2 - Math.max(0, nCol - 1) * minGap) / nCol)));
        gap = Math.max(minGap, Math.floor((budget - PAD * 2 - nCol * colW) / Math.max(1, nCol - 1)));
      } else {
        const free = budget - PAD * 2 - nCol * COL_W;
        gap = Math.max(COL_GAP, Math.min(140, Math.floor(free / Math.max(1, nCol - 1))));
      }
    }

    Object.values(measured).forEach((m) => {
      Object.assign(m, measure(m, colW));
    });

    // Parents / children by edge direction
    const childrenOf = {};
    const parentsOf = {};
    (edges || []).forEach((e) => {
      if (!measured[e.from] || !measured[e.to]) return;
      if (!childrenOf[e.from]) childrenOf[e.from] = [];
      if (!parentsOf[e.to]) parentsOf[e.to] = [];
      childrenOf[e.from].push(e.to);
      parentsOf[e.to].push(e.from);
    });

    // Left → right: rank by median of parents in previous columns only
    cols.forEach((c, ci) => {
      byCol[c].forEach((m, i) => {
        m.rank = m.row != null ? m.row : i;
        m.yIdeal = null;
      });
      if (ci > 0) {
        byCol[c].forEach((m) => {
          const pars = (parentsOf[m.id] || [])
            .map((id) => measured[id])
            .filter((p) => p && p.col < m.col);
          if (!pars.length) return;
          const centers = pars.map((p) => p.y + p.h / 2).sort((a, b) => a - b);
          const mid = centers[Math.floor(centers.length / 2)];
          m.yIdeal = mid - m.h / 2;
          m.rank = mid;
        });
      }
      packColumn(byCol[c], ROW_GAP);
    });

    // Second pass: pull each node toward its single primary parent (cleaner fans)
    cols.forEach((c, ci) => {
      if (ci === 0) return;
      byCol[c].forEach((m) => {
        const pars = (parentsOf[m.id] || [])
          .map((id) => measured[id])
          .filter((p) => p && p.col === cols[ci - 1]);
        if (pars.length === 1) {
          m.yIdeal = pars[0].y + pars[0].h / 2 - m.h / 2;
        } else if (pars.length > 1) {
          const avg = pars.reduce((s, p) => s + p.y + p.h / 2, 0) / pars.length;
          m.yIdeal = avg - m.h / 2;
        }
      });
      packColumn(byCol[c], ROW_GAP);
    });

    // Mid-align columns to tallest
    let tallest = 0;
    cols.forEach((c) => {
      const list = byCol[c];
      if (!list.length) return;
      const top = Math.min(...list.map((m) => m.y));
      const bot = Math.max(...list.map((m) => m.y + m.h));
      tallest = Math.max(tallest, bot - top);
    });
    cols.forEach((c) => {
      const list = byCol[c];
      if (!list.length) return;
      const top = Math.min(...list.map((m) => m.y));
      const bot = Math.max(...list.map((m) => m.y + m.h));
      const shift = (tallest - (bot - top)) / 2 - top;
      list.forEach((m) => {
        m.y += shift;
      });
    });

    const bandW = nCol * colW + Math.max(0, nCol - 1) * gap;
    const startX =
      budget && budget > bandW + PAD * 2
        ? Math.round((budget - bandW) / 2)
        : PAD;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    cols.forEach((c, ci) => {
      const x = startX + ci * (colW + gap);
      byCol[c].forEach((m) => {
        m.x = x;
        m.w = colW;
        minX = Math.min(minX, m.x);
        minY = Math.min(minY, m.y);
        maxX = Math.max(maxX, m.x + m.w);
        maxY = Math.max(maxY, m.y + m.h);
      });
    });

    const ox = PAD - minX;
    const oy = PAD - minY;
    Object.values(measured).forEach((m) => {
      m.x += ox;
      m.y += oy;
    });

    return {
      placed: measured,
      width: Math.max(maxX + ox + PAD, bandW + PAD * 2),
      height: Math.max(maxY + oy + PAD, tallest + PAD * 2, 300),
      colGap: gap,
      childrenOf,
    };
  }

  function slotY(node, index, total) {
    const margin = Math.max(14, Math.min(22, node.h * 0.14));
    const usable = Math.max(16, node.h - margin * 2);
    if (total <= 1) return node.y + node.h / 2;
    return node.y + margin + (index * usable) / (total - 1);
  }

  function orthoSpaced(sx, sy, tx, ty, lane) {
    const span = tx - sx;
    const mx = sx + Math.max(36, span * 0.45) + lane;
    if (Math.abs(span) < 2 || Math.abs(sy - ty) < 1.5) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    }
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
  }

  function addText(ns, g, cls, x, y, text, anchor) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("class", cls);
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y));
    if (anchor) t.setAttribute("text-anchor", anchor);
    t.textContent = text;
    g.appendChild(t);
    return t;
  }

  function addDiv(ns, g, y, w) {
    const div = document.createElementNS(ns, "line");
    div.setAttribute("class", "div");
    div.setAttribute("x1", "0");
    div.setAttribute("y1", String(y));
    div.setAttribute("x2", String(w));
    div.setAttribute("y2", String(y));
    g.appendChild(div);
  }

  function drawNode(ns, p) {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", `ox-lg-node kind-${p.kind}`);
    g.setAttribute("data-node-id", p.id);
    if (p.oxKey) g.setAttribute("data-ox-key", p.oxKey);
    g.setAttribute("transform", `translate(${p.x},${p.y})`);

    const card = document.createElementNS(ns, "rect");
    card.setAttribute("class", "card");
    card.setAttribute("width", String(p.w));
    card.setAttribute("height", String(p.h));
    g.appendChild(card);

    const headH = p.headH || 32;
    const head = document.createElementNS(ns, "rect");
    head.setAttribute("class", "head");
    head.setAttribute("width", String(p.w));
    head.setAttribute("height", String(headH));
    g.appendChild(head);

    const b = p.body || buildBody(p, p.w);
    let y = 11;
    b.classLines.forEach((ln) => {
      addText(ns, g, "stereo", p.w / 2, y, ln, "middle");
      y += LINE;
    });
    b.titleLines.forEach((ln) => {
      addText(ns, g, "title", p.w / 2, y, ln, "middle");
      y += LINE;
    });
    y = headH;
    addDiv(ns, g, y, p.w);
    y += 11;

    if (b.subLines.length) {
      b.subLines.forEach((ln, i) => {
        addText(ns, g, i === 0 ? "sec-label" : "sub", NODE_PAD_X, y, ln);
        y += LINE;
      });
      addDiv(ns, g, y - 2, p.w);
      y += 10;
    }

    if (b.valLines.length) {
      b.valLines.forEach((ln, i) => {
        addText(ns, g, i === 0 ? "sec-label" : "line", NODE_PAD_X, y, ln);
        y += LINE;
      });
    }

    return g;
  }

  function render(model) {
    ensureStyle();
    const m = model || {};
    const uid = "oxlg_" + Math.random().toString(36).slice(2, 9);
    const payload = esc(JSON.stringify(m));
    const note = m.note ? `<p class="ox-lg-note">${esc(m.note)}</p>` : "";
    const title = m.title
      ? `<div style="font-weight:700;font-size:.84rem">${esc(m.title)}</div>`
      : "";
    return `<div class="ox-lg" id="${uid}" data-ox-lg-model="${payload}">
      ${title}${note}
      <div class="ox-lg-toolbar">
        <button type="button" data-ox-lg-act="zoom-in">+</button>
        <button type="button" data-ox-lg-act="zoom-out">−</button>
        <button type="button" data-ox-lg-act="fit">Fit</button>
        <div class="ox-lg-legend">
          <span class="ox-lg-leg"><span class="ox-lg-dot struct"></span>lexicog</span>
          <span class="ox-lg-leg"><span class="ox-lg-dot lex"></span>lexicon</span>
          <span class="ox-lg-leg"><span class="ox-lg-dot form"></span>form</span>
          <span class="ox-lg-leg"><span class="ox-lg-dot sense"></span>sense</span>
        </div>
      </div>
      <div class="ox-lg-viewport" tabindex="0" aria-label="OntoLex graph">
        <svg xmlns="http://www.w3.org/2000/svg"></svg>
        <div class="ox-lg-hint">Drag · wheel zoom · Fit</div>
      </div>
    </div>`;
  }

  function draw(host, model) {
    const viewport = host.querySelector(".ox-lg-viewport");
    const svg = viewport && viewport.querySelector("svg");
    if (!viewport || !svg) return null;
    const nodes = model.nodes || [];
    const edges = model.edges || [];
    const availW = viewport.clientWidth || host.clientWidth || 0;
    const { placed, width, height, colGap } = layout(nodes, availW, edges);
    const markerId = "ox-arr-" + (host.id || Math.random().toString(36).slice(2, 7));
    const ns = "http://www.w3.org/2000/svg";

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = "";
    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `<marker id="${markerId}" markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 Z" fill="#4a4a4a"/></marker>`;
    svg.appendChild(defs);
    const gWorld = document.createElementNS(ns, "g");
    gWorld.setAttribute("class", "ox-lg-world");
    svg.appendChild(gWorld);
    const gE = document.createElementNS(ns, "g");
    const gN = document.createElementNS(ns, "g");
    gWorld.appendChild(gE);
    gWorld.appendChild(gN);

    const outList = {};
    const inList = {};
    edges.forEach((e) => {
      if (!outList[e.from]) outList[e.from] = [];
      if (!inList[e.to]) inList[e.to] = [];
      outList[e.from].push(e);
      inList[e.to].push(e);
    });
    Object.keys(outList).forEach((id) => {
      outList[id].sort((a, b) => ((placed[a.to] || {}).y || 0) - ((placed[b.to] || {}).y || 0));
    });
    Object.keys(inList).forEach((id) => {
      inList[id].sort((a, b) => ((placed[a.from] || {}).y || 0) - ((placed[b.from] || {}).y || 0));
    });

    const outIdx = {};
    const inIdx = {};
    const laneStep = Math.max(12, Math.min(22, (colGap || COL_GAP) / 4.5));

    edges.forEach((e) => {
      const a = placed[e.from];
      const b = placed[e.to];
      if (!a || !b) return;
      const outs = outList[e.from] || [e];
      const ins = inList[e.to] || [e];
      const oi = outIdx[e.from] || 0;
      outIdx[e.from] = oi + 1;
      const ii = inIdx[e.to] || 0;
      inIdx[e.to] = ii + 1;

      const right = b.x >= a.x + a.w - 4;
      const left = a.x >= b.x + b.w - 4;
      let sx, sy, tx, ty;
      if (right) {
        sx = a.x + a.w;
        sy = slotY(a, oi, outs.length);
        tx = b.x;
        ty = slotY(b, ii, ins.length);
      } else if (left) {
        sx = a.x;
        sy = slotY(a, oi, outs.length);
        tx = b.x + b.w;
        ty = slotY(b, ii, ins.length);
      } else if (b.y >= a.y + a.h - 4) {
        sx = a.x + a.w / 2;
        sy = a.y + a.h;
        tx = b.x + b.w / 2;
        ty = b.y;
      } else {
        sx = a.x + a.w / 2;
        sy = a.y;
        tx = b.x + b.w / 2;
        ty = b.y + b.h;
      }

      const lane = right || left ? (oi - (outs.length - 1) / 2) * laneStep : 0;
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", orthoSpaced(sx, sy, tx, ty, lane));
      path.setAttribute("class", "ox-lg-edge");
      path.setAttribute("marker-end", `url(#${markerId})`);
      gE.appendChild(path);

      if (e.label) {
        const mx = right ? sx + Math.max(28, (tx - sx) * 0.42) + lane : (sx + tx) / 2;
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", String(mx));
        t.setAttribute("y", String(sy - 5));
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("class", "ox-lg-edge-label");
        t.textContent = String(e.label);
        gE.appendChild(t);
      }
    });

    Object.values(placed).forEach((p) => gN.appendChild(drawNode(ns, p)));
    return { svg, viewport, gWorld, width, height };
  }

  function wire(host, drawn) {
    if (!drawn) return;
    const { viewport, gWorld, width, height } = drawn;
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let panning = false;
    let lx = 0;
    let ly = 0;
    const apply = () => gWorld.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    const fit = () => {
      const vw = Math.max(160, viewport.clientWidth || 600);
      const targetH = Math.min(560, Math.max(320, Math.round(vw * 0.78)));
      viewport.style.height = targetH + "px";
      const vh = Math.max(220, viewport.clientHeight || targetH);
      const pad = 24;
      scale = Math.min(1.15, Math.max(0.45, Math.min((vw - pad * 2) / width, (vh - pad * 2) / height)));
      tx = (vw - width * scale) / 2;
      ty = (vh - height * scale) / 2;
      apply();
    };
    host.querySelectorAll("[data-ox-lg-act]").forEach((btn) => {
      btn.onclick = () => {
        const a = btn.getAttribute("data-ox-lg-act");
        if (a === "zoom-in") scale = Math.min(2.5, scale * 1.15);
        if (a === "zoom-out") scale = Math.max(0.25, scale / 1.15);
        if (a === "fit") return fit();
        apply();
      };
    });
    viewport.onwheel = (e) => {
      e.preventDefault();
      const r = viewport.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const prev = scale;
      scale = Math.min(2.5, Math.max(0.25, scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      tx = mx - (mx - tx) * (scale / prev);
      ty = my - (my - ty) * (scale / prev);
      apply();
    };
    viewport.onpointerdown = (e) => {
      if (e.target.closest && e.target.closest(".ox-lg-node")) return;
      panning = true;
      lx = e.clientX;
      ly = e.clientY;
      viewport.classList.add("is-panning");
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
    };
    viewport.onpointermove = (e) => {
      if (!panning) return;
      tx += e.clientX - lx;
      ty += e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      apply();
    };
    const end = () => {
      panning = false;
      viewport.classList.remove("is-panning");
    };
    viewport.onpointerup = end;
    viewport.onpointercancel = end;
    requestAnimationFrame(fit);
  }

  function mount(rootOrSel, modelOpt) {
    ensureStyle();
    const root =
      typeof rootOrSel === "string" ? document.querySelector(rootOrSel) : rootOrSel;
    if (!root) return null;
    const hosts = root.classList.contains("ox-lg")
      ? [root]
      : Array.from(root.querySelectorAll(".ox-lg"));
    hosts.forEach((host) => {
      let model = modelOpt;
      if (!model) {
        try {
          model = JSON.parse(host.getAttribute("data-ox-lg-model") || "{}");
        } catch (_) {
          model = { nodes: [], edges: [] };
        }
      }
      wire(host, draw(host, model));
    });
    return hosts[0] || null;
  }

  root.OntoLexGraph = {
    VERSION: "7.0.0",
    render,
    mount,
    paintEdges: mount,
    ensureStyle,
    esc,
    layout,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.OntoLexGraph;
})(typeof window !== "undefined" ? window : globalThis);
