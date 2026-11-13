// Map element: columns from accounts to automations.

const V = new URL(import.meta.url).search;
const { ICONS } = await import(`./clan-icons.js${V}`);

// column of each node type, accounts first
export const RANK = { user: 0, person: 1, device: 2, tracker: 2, notify: 3, ui: 3, routine: 4, access: 5 };
const COLUMNS = 6;
export const COLORS = {
  user: "#1e88e5",
  person: "#43a047",
  device: "#8e24aa",
  tracker: "#6d4c41",
  notify: "#ef6c00",
  ui: "#0288d1",
  routine: "#607d8b",
  access: "#c62828",
};
export const EDGE_COLORS = {
  account: "#1e88e5",
  registered: "#8e24aa",
  tracks: "#43a047",
  notifies: "#ef6c00",
  includes: "#ef6c00",
  calls: "#78909c",
  watches: "#00897b",
  mentions: "#78909c",
  answers: "#d81b60",
  reads: "#00897b",
  controls: "#c62828",
};
export const EDGE_DASH = {
  registered: "5 4",
  includes: "7 3",
  watches: "1 5",
  mentions: "1 5",
  reads: "6 3",
};
const RADIUS = { user: 20, person: 22, device: 17, tracker: 14, notify: 15, ui: 17, routine: 12 };
const ARROWS = new Set(["notifies", "includes", "calls", "answers", "controls"]);
// vertical shift of a link drawn beside another between the same nodes
const SIDE_OFFSET = { answers: 7, reads: -7 };
const COLUMN_GAP = 250;
const LABEL_MAX = 24;
// opening animation: delay between two columns, link drawing, node appearance (ms)
const PLAY_STEP = 520;
const PLAY_DRAW = 380;
const PLAY_POP = 260;
// above this node count the map shows at once
const PLAY_MAX = 400;
// smallest zoom of the first view on a phone
const PHONE_ZOOM = 0.75;
// extra space between two integrations in the notification column
const FAMILY_GAP = 14;
// notification kinds drawn with their own icon rather than their integration's
const OWN_ICON = new Set(["app_all", "group", "missing", "computed"]);

// icon of each integration, as an object URL, filled by the panel before it draws
export const BRANDS = new Map();

// integration whose icon a node shows, or null
export function brandOf(node) {
  if (node.type !== "notify" || OWN_ICON.has(node.kind) || (node.flags || []).includes("missing")) return null;
  return node.info?.platform || null;
}

export function brandUrl(node) {
  const domain = brandOf(node);
  return (domain && BRANDS.get(domain)) || null;
}

// key that keeps the notification services of one integration together in their column
function family(n) {
  return n.type === "notify" ? n.info?.platform || n.kind || "" : n.type;
}

// gathers each integration's nodes where they sit on average, keeping their order within it
function together(col) {
  const at = new Map(col.map((n, i) => [n.id, i]));
  const sums = new Map();
  for (const n of col) {
    const s = sums.get(family(n)) || [0, 0];
    s[0] += at.get(n.id);
    s[1] += 1;
    sums.set(family(n), s);
  }
  const mean = (n) => {
    const [total, count] = sums.get(family(n));
    return total / count;
  };
  col.sort((a, b) => mean(a) - mean(b) || family(a).localeCompare(family(b)) || at.get(a.id) - at.get(b.id));
}

export function nodeIcon(node) {
  switch (node.type) {
    case "user":
      if (node.flags.includes("owner")) return ICONS.owner;
      if (node.flags.includes("system")) return ICONS.system;
      if (node.flags.includes("admin")) return ICONS.admin;
      return ICONS.user;
    case "person":
      return ICONS.person;
    case "device":
      return ICONS[node.kind] || ICONS.device;
    case "tracker":
      return ICONS[node.kind] || ICONS.tracker;
    case "notify":
      return (
        { app_all: ICONS.all, group: ICONS.group, missing: ICONS.missing, service: ICONS.service }[node.kind] ||
        ICONS.legacy
      );
    case "ui":
      return ICONS.ui;
    case "access":
      return ICONS[node.kind] || ICONS.door;
    default:
      return ICONS[node.kind] || ICONS.automation;
  }
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function short(text) {
  const clean = String(text || "").trim();
  return clean.length > LABEL_MAX ? `${clean.slice(0, LABEL_MAX - 1)}…` : clean;
}

// owner, admins, users, then system accounts
function userWeight(n) {
  if (n.type !== "user") return 0;
  const flags = n.flags || [];
  return (flags.includes("owner") ? 0 : flags.includes("admin") ? 1 : 2) + (flags.includes("system") ? 3 : 0);
}

// full name in the last column, where there is room on the right
function labelText(n) {
  return n.rank >= 4 ? n.name : short(n.name);
}

function labelWidth(n) {
  return labelText(n).length * 6.4;
}

// Nodes reachable from id: up through lower ranks, down through higher ones. Within a rank, a caller
// leads up to the script it calls.
// rank(id) gives a node's rank, links(id) its edges as { from, to }.
export function branch(id, rank, links) {
  const out = new Set([id]);
  for (const dir of [-1, 1]) {
    const queue = [id];
    const seen = new Set([id]);
    while (queue.length) {
      const cur = queue.shift();
      for (const e of links(cur)) {
        const other = e.from === cur ? e.to : e.from;
        if (seen.has(other)) continue;
        let ok = dir < 0 ? rank(other) < rank(cur) : rank(other) > rank(cur);
        if (rank(other) === rank(cur)) ok = dir < 0 ? e.from === cur : e.to === cur;
        if (!ok) continue;
        seen.add(other);
        out.add(other);
        queue.push(other);
      }
    }
  }
  return out;
}

// The given nodes plus every node whose parents (one step up) are all hidden.
export function hiding(ids, rank, links) {
  const hidden = new Set(ids);
  const parents = new Map();
  const up = (id) => {
    if (!parents.has(id)) {
      parents.set(
        id,
        links(id)
          .filter((e) => {
            const other = e.from === id ? e.to : e.from;
            return rank(other) < rank(id) || (rank(other) === rank(id) && e.from === id);
          })
          .map((e) => (e.from === id ? e.to : e.from)),
      );
    }
    return parents.get(id);
  };
  const ranked = (all) => [...all].sort((a, b) => rank(a) - rank(b));
  let grew = true;
  while (grew) {
    grew = false;
    // only neighbours of hidden nodes can become hidden
    const below = new Set();
    for (const id of hidden) {
      for (const e of links(id)) {
        const other = e.from === id ? e.to : e.from;
        if (!hidden.has(other)) below.add(other);
      }
    }
    for (const id of ranked(below)) {
      const p = up(id);
      if (p.length && p.every((x) => hidden.has(x))) {
        hidden.add(id);
        grew = true;
      }
    }
  }
  return hidden;
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// inversion count (merge sort)
function inversions(seq) {
  if (seq.length < 2) return 0;
  const mid = seq.length >> 1;
  const left = seq.slice(0, mid);
  const right = seq.slice(mid);
  let count = inversions(left) + inversions(right);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) seq[k++] = left[i++];
    else {
      seq[k++] = right[j++];
      count += left.length - i;
    }
  }
  while (i < left.length) seq[k++] = left[i++];
  while (j < right.length) seq[k++] = right[j++];
  return count;
}

const STYLES = `
  :host { display: block; position: relative; overflow: hidden; touch-action: none; user-select: none; }
  svg { width: 100%; height: 100%; display: block; cursor: grab; }
  svg.panning { cursor: grabbing; }
  .edge { fill: none; stroke-width: 1.6; stroke-linecap: round; transition: opacity .15s; }
  .edge.main { stroke-width: 3; }
  .edge.off { opacity: .35; }
  .edge.broken { stroke: var(--error-color, #db4437) !important; stroke-dasharray: 4 4; }
  .node { cursor: pointer; transition: opacity .15s; }
  .node .pop { transform-box: fill-box; transform-origin: center; }
  .node .ring { fill: none; stroke-width: 3; stroke: transparent; }
  .node.s-error .ring { stroke: var(--error-color, #db4437); }
  .node.s-warn .ring { stroke: var(--warning-color, #ffa600); }
  .node.dormant:not(.s-error) .ring { stroke: var(--secondary-text-color, #727272); stroke-dasharray: 3 3; }
  .node.dormant .body, .node.dormant image { filter: grayscale(1); opacity: .5; }
  .node.dormant .label { fill: var(--secondary-text-color, #727272); font-style: italic; }
  .node.sel .ring { stroke: var(--primary-color, #03a9f4); stroke-width: 4; }
  .node.off .body, .node.off .icon, .node.off image { opacity: .45; }
  .node .body.brand { fill: var(--card-background-color, #fff); stroke-width: 2.5; }
  .node.missing .body { stroke: var(--error-color, #db4437); stroke-width: 2; stroke-dasharray: 3 3; fill-opacity: .25; }
  .node .icon { fill: #fff; pointer-events: none; }
  .node.missing .icon { fill: var(--error-color, #db4437); }
  .node .label { font: 500 12px var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: var(--primary-text-color, #212121);
    text-anchor: middle; paint-order: stroke; stroke: var(--primary-background-color, #fafafa); stroke-width: 4px; stroke-linejoin: round; pointer-events: none; }
  .node.t-routine .label { font-size: 11px; font-weight: 400; fill: var(--secondary-text-color, #727272); }
  .node .badge circle { stroke: var(--card-background-color, #fff); stroke-width: 1.5; }
  .node .badge path { fill: #fff; }
  .dim { opacity: .12; }
  .hit .label { font-weight: 700; }
  .col-head { font: 600 13px var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: var(--secondary-text-color, #727272);
    text-anchor: middle; text-transform: uppercase; letter-spacing: .06em; }
  .col-line { stroke: var(--divider-color, #e0e0e0); stroke-dasharray: 2 6; }
`;

export class ClanGraph extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><svg><defs></defs><g class="vp"></g></svg>`;
    this._svg = this.shadowRoot.querySelector("svg");
    this._vp = this.shadowRoot.querySelector(".vp");
    this._view = { x: 0, y: 0, k: 1 };
    this._visible = () => true;
    this._anims = [];
    this._selected = null;
    this._query = "";
    this._pointers = new Map();
    this._columnHeads = [];
    this._bind();
  }

  connectedCallback() {
    this._resize = new ResizeObserver(() => {
      if (!this._fitted && this.clientWidth) this.fit();
    });
    this._resize.observe(this);
  }

  disconnectedCallback() {
    this._resize?.disconnect();
    this._finish();
  }

  // data: { nodes, edges } as built by the integration; options: visible, heads
  setData(data, options = {}) {
    this._data = data;
    if (options.visible) this._visible = options.visible;
    if (options.heads) this._columnHeads = options.heads;
    this._build();
  }

  setVisible(visible) {
    this._visible = visible;
    this._build();
  }

  select(id, center = false) {
    this._selected = id && this._byId?.has(id) ? id : null;
    this._highlight();
    if (center && this._selected) this.fit(this.related(this._selected));
  }

  // highlight dormant nodes and their neighbours
  setSpotlight(on) {
    this._spotlight = !!on;
    this._highlight();
  }

  setQuery(query) {
    this._query = fold(query.trim());
    this._highlight();
    if (!this._query) return null;
    return this._nodes.find((n) => n.hit) || null;
  }

  centerOn(id) {
    const node = this._byId?.get(id);
    if (node) this._center(node);
  }

  // layout

  _build() {
    if (!this._data) return;
    this._finish();
    const nodes = this._data.nodes.filter((n) => this._visible(n));
    const byId = new Map();
    for (const raw of nodes) {
      const n = {
        ...raw,
        r: RADIUS[raw.type] || 14,
        rank: RANK[raw.type] ?? 2,
        x: 0,
        y: 0,
        side: "below",
      };
      byId.set(n.id, n);
    }
    const edges = [];
    for (const e of this._data.edges) {
      const source = byId.get(e.from);
      const target = byId.get(e.to);
      if (source && target) edges.push({ ...e, source, target });
    }
    // button and sensor links that share their two nodes with another link are drawn beside it
    const pair = (e) => [e.source.id, e.target.id].sort().join(">");
    const shared = new Map();
    for (const e of edges) shared.set(pair(e), (shared.get(pair(e)) || 0) + 1);
    for (const e of edges) e.offset = shared.get(pair(e)) > 1 ? SIDE_OFFSET[e.type] || 0 : 0;
    this._nodes = [...byId.values()];
    this._byId = byId;
    this._edges = edges;
    this._adjacent = new Map();
    for (const e of edges) {
      for (const end of [e.source.id, e.target.id]) {
        if (!this._adjacent.has(end)) this._adjacent.set(end, []);
        this._adjacent.get(end).push(e);
      }
    }
    if (this._selected && !byId.has(this._selected)) this._selected = null;

    this._columns();
    this._render();
    this._highlight();
  }

  _box(nodes) {
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const n of nodes) {
      const w = labelWidth(n);
      const left = n.side === "left" ? w + 8 : n.side === "right" ? 0 : w / 2;
      const right = n.side === "right" ? w + 8 : n.side === "left" ? 0 : w / 2;
      box.x0 = Math.min(box.x0, n.x - n.r - left);
      box.x1 = Math.max(box.x1, n.x + n.r + right);
      box.y0 = Math.min(box.y0, n.y - n.r - 8);
      box.y1 = Math.max(box.y1, n.y + n.r + (n.side === "below" ? 22 : 8));
    }
    box.w = box.x1 - box.x0;
    box.h = box.y1 - box.y0;
    return box;
  }

  _columns() {
    const cols = Array.from({ length: COLUMNS }, () => []);
    for (const n of this._nodes) {
      cols[n.rank].push(n);
      n.side = n.rank >= 4 ? "right" : "below";
    }
    cols[0].sort((a, b) => userWeight(a) - userWeight(b) || a.name.localeCompare(b.name));
    for (const col of cols.slice(1)) col.sort((a, b) => a.name.localeCompare(b.name));
    const order = new Map();
    const index = () => cols.forEach((col) => col.forEach((n, i) => order.set(n.id, i / Math.max(col.length - 1, 1))));
    const sweep = (col, towards) => {
      const center = (n) => {
        const near = (this._adjacent.get(n.id) || [])
          .map((e) => (e.source === n ? e.target : e.source))
          .filter((m) => (towards < 0 ? m.rank < n.rank : m.rank > n.rank));
        return near.length ? near.reduce((s, m) => s + order.get(m.id), 0) / near.length : order.get(n.id);
      };
      const keys = new Map(col.map((n) => [n.id, center(n)]));
      col.sort((a, b) => keys.get(a.id) - keys.get(b.id));
      if (col === cols[RANK.notify]) together(col);
    };
    // crossings between each pair of columns
    const spans = this._edges
      .filter((e) => e.source.rank !== e.target.rank)
      .map((e) => (e.source.rank < e.target.rank ? [e.source, e.target] : [e.target, e.source]));
    const pairsOf = new Map();
    for (const [a, b] of spans) {
      const key = a.rank * 8 + b.rank;
      if (!pairsOf.has(key)) pairsOf.set(key, []);
      pairsOf.get(key).push([a, b]);
    }
    const crossings = () => {
      let total = 0;
      for (const list of pairsOf.values()) {
        const ends = list
          .map(([a, b]) => [order.get(a.id), order.get(b.id)])
          .sort((u, v) => u[0] - v[0] || u[1] - v[1])
          .map((u) => u[1]);
        total += inversions(ends);
      }
      return total;
    };
    // keep the order with the fewest crossings over all sweeps
    let best = null;
    const keep = () => {
      const count = crossings();
      if (!best || count < best.count) best = { count, cols: cols.map((col) => [...col]) };
    };
    index();
    keep();
    for (let pass = 0; pass < 6; pass++) {
      for (let r = 1; r < COLUMNS; r++) {
        sweep(cols[r], -1);
        index();
      }
      keep();
      for (let r = COLUMNS - 2; r >= 0; r--) {
        if (r === 0) continue; // the account column keeps its sort order
        sweep(cols[r], 1);
        index();
      }
      keep();
    }
    best.cols.forEach((col, r) => {
      cols[r] = col;
    });
    // the first order, by name, may have been the best
    together(cols[RANK.notify]);
    index();
    // y: mean of the linked nodes on the left, without overlap
    const gaps = [64, 64, 56, 56, 36, 56];
    // the access column starts after the longest automation name
    const names = Math.max(0, ...cols[4].map((n) => labelWidth(n)));
    this._colX = cols.map((_col, r) => (r < 5 ? r * COLUMN_GAP : 4 * COLUMN_GAP + names + 110));
    const near = (n, lower) =>
      (this._adjacent.get(n.id) || [])
        .map((e) => (e.source === n ? e.target : e.source))
        .filter((m) => (lower ? m.rank < n.rank : m.rank > n.rank));
    const settle = (col, gap, wish) => {
      const wanted = col.map((n) => wish.get(n.id)).filter(Number.isFinite);
      let last = (wanted.length ? Math.min(...wanted) : -((col.length - 1) / 2) * gap) - gap;
      const ys = col.map((n, i) => {
        const want = wish.get(n.id);
        const step = gap + (i > 0 && n.rank === RANK.notify && family(n) !== family(col[i - 1]) ? FAMILY_GAP : 0);
        last = Math.max(Number.isFinite(want) ? want : last + step, last + step);
        return last;
      });
      const offsets = col.map((n, i) => ys[i] - wish.get(n.id)).filter(Number.isFinite);
      const drift = offsets.length ? offsets.reduce((s, d) => s + d, 0) / offsets.length : 0;
      col.forEach((n, i) => {
        n.y = ys[i] - drift;
      });
    };
    const mean = (list) => {
      const ys = list.map((m) => m.y).filter(Number.isFinite);
      return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : NaN;
    };
    for (const n of this._nodes) n.y = NaN;
    cols.forEach((col, r) => {
      for (const n of col) n.x = this._colX[r];
      if (r === 0) col.forEach((n, i) => (n.y = (i - (col.length - 1) / 2) * gaps[0]));
      else settle(col, gaps[r], new Map(col.map((n) => [n.id, mean(near(n, true))])));
    });
    // nodes without links to the left are placed from their links to the right
    for (const r of [3, 2, 1]) {
      const col = cols[r];
      if (!col.some((n) => !near(n, true).length)) continue;
      const wish = new Map(col.map((n) => [n.id, near(n, true).length ? n.y : mean(near(n, false))]));
      col.sort((a, b) => (wish.get(a.id) ?? 0) - (wish.get(b.id) ?? 0));
      if (r === RANK.notify) together(col);
      settle(col, gaps[r], wish);
    }
    const top = Math.min(...this._nodes.map((n) => n.y));
    this._colTops = cols.map((col) => (col.length ? top - 56 : null));
  }

  // drawing

  _render() {
    const defs = Object.entries(EDGE_COLORS)
      .filter(([type]) => ARROWS.has(type))
      .map(
        ([type, color]) =>
          `<marker id="arrow-${type}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`,
      )
      .join("");
    this.shadowRoot.querySelector("defs").innerHTML =
      `${defs}<marker id="arrow-broken" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--error-color, #db4437)"/></marker>`;

    let heads = "";
    if (this._columnHeads.length) {
      heads = this._columnHeads
        .map((label, r) =>
          this._colTops?.[r] == null
            ? ""
            : `<text class="col-head" data-r="${r}" x="${this._colX[r]}" y="${this._colTops[r]}">${esc(label)}</text>`,
        )
        .join("");
    }
    const edges = this._edges
      .map((e, i) => {
        const cls = ["edge", `t-${e.type}`, e.main ? "main" : "", e.off ? "off" : "", e.broken ? "broken" : ""].join(
          " ",
        );
        const marker = e.broken ? "arrow-broken" : ARROWS.has(e.type) ? `arrow-${e.type}` : "";
        return `<path class="${cls}" data-i="${i}" stroke="${EDGE_COLORS[e.type] || "#999"}"
          ${EDGE_DASH[e.type] ? `stroke-dasharray="${EDGE_DASH[e.type]}"` : ""}
          ${marker ? `marker-end="url(#${marker})"` : ""}><title>${esc(e.source.name)} → ${esc(e.target.name)}${
            e.labels?.length ? `\n${esc(e.labels.join("\n"))}` : ""
          }</title></path>`;
      })
      .join("");
    const nodes = this._nodes.map((n) => this._nodeMarkup(n)).join("");
    this._vp.innerHTML = `<g class="heads">${heads}</g><g class="edges">${edges}</g><g class="nodes">${nodes}</g>`;
    this._edgeEls = [...this._vp.querySelectorAll(".edge")];
    this._nodeEls = new Map([...this._vp.querySelectorAll(".node")].map((el) => [el.dataset.id, el]));
    this._place();
    this._applyView();
  }

  _nodeMarkup(n) {
    const scale = (n.r * 1.15) / 24;
    const flags = n.flags || [];
    const cls = [
      "node",
      `t-${n.type}`,
      `s-${n.status || "ok"}`,
      flags.includes("disabled") || flags.includes("inactive") ? "off" : "",
      flags.includes("missing") ? "missing" : "",
      flags.includes("dormant") ? "dormant" : "",
    ].join(" ");
    const picture = n.type === "person" && n.info?.picture;
    const brand = brandUrl(n);
    const clip = `clip-${hash(n.id).toString(36).slice(2)}`;
    // an integration's icon sits on the card colour, inside a ring of the node's colour
    const half = n.r * 0.62;
    const body = picture
      ? `<clipPath id="${clip}"><circle r="${n.r}"/></clipPath><circle class="body" r="${n.r}" fill="${COLORS.person}"/>
         <image href="${esc(picture)}" x="${-n.r}" y="${-n.r}" width="${2 * n.r}" height="${2 * n.r}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : brand
        ? `<circle class="body brand" r="${n.r}" stroke="${COLORS[n.type]}"/>
         <image href="${esc(brand)}" x="${-half}" y="${-half}" width="${2 * half}" height="${2 * half}" preserveAspectRatio="xMidYMid meet"/>`
        : `<circle class="body" r="${n.r}" fill="${COLORS[n.type] || "#888"}"/>
         <path class="icon" d="${nodeIcon(n)}" transform="translate(${-12 * scale},${-12 * scale}) scale(${scale})"/>`;
    let badge = "";
    if (n.type === "user" && (flags.includes("admin") || flags.includes("owner")) && !flags.includes("system")) {
      badge = `<g class="badge" transform="translate(${n.r * 0.72},${-n.r * 0.72})"><circle r="8" fill="#f9a825"/>
        <path d="${flags.includes("owner") ? ICONS.owner : ICONS.admin}" transform="translate(-6,-6) scale(.5)"/></g>`;
    }
    const sleep = flags.includes("dormant")
      ? `<g class="badge" transform="translate(${n.r * 0.72},${n.r * 0.72})"><circle r="8" fill="#757575"/>
        <path d="${ICONS.sleep}" transform="translate(-6,-6) scale(.5)"/></g>`
      : "";
    return `<g class="${cls}" data-id="${esc(n.id)}"><title>${esc(n.name)}</title>
      <g class="pop"><circle class="ring" r="${n.r + 4}"/>${body}${badge}${sleep}</g><text class="label">${esc(labelText(n))}</text></g>`;
  }

  _label(n, el) {
    const [x, y, anchor] = {
      right: [n.r + 7, 4, "start"],
      left: [-n.r - 7, 4, "end"],
    }[n.side] || [0, n.r + 15, "middle"];
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.style.textAnchor = anchor;
    el.dataset.side = n.side;
  }

  _place() {
    for (const n of this._nodes) {
      const el = this._nodeEls.get(n.id);
      if (!el) continue;
      el.setAttribute("transform", `translate(${n.x},${n.y})`);
      const label = el.lastElementChild;
      if (label.dataset.side !== n.side) this._label(n, label);
    }
    this._edges.forEach((e, i) => this._edgeEls[i]?.setAttribute("d", this._path(e)));
  }

  _path(e) {
    const s = e.source;
    const t = e.target;
    const pad = ARROWS.has(e.type) || e.broken ? 5 : 2;
    const o = e.offset;
    if (s.rank === t.rank) {
      // same column: arc on the right
      const x1 = s.x + s.r;
      const x2 = t.x + t.r + pad;
      const bend = 46 + Math.min(Math.abs(t.y - s.y) / 4, 60);
      return `M${x1},${s.y} C${x1 + bend},${s.y} ${x2 + bend},${t.y} ${x2},${t.y}`;
    }
    const dir = t.x > s.x ? 1 : -1;
    // a link from an automation leaves after its name
    const x1 = s.x + dir * s.r + (s.rank === 4 && dir > 0 ? labelWidth(s) + 10 : 0);
    const x2 = t.x - dir * (t.r + pad);
    const mid = (x1 + x2) / 2;
    return `M${x1},${s.y + o} C${mid},${s.y + o} ${mid},${t.y + o} ${x2},${t.y + o}`;
  }

  // Opening animation: the columns appear from accounts to automations, each link drawn from left to
  // right until it reaches the node that appears next.
  play() {
    this._finish();
    if (!this._nodes?.length || this._nodes.length > PLAY_MAX) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const once = { fill: "backwards", easing: "ease-out" };
    // fade up to the element's own opacity, so that dimmed nodes stay dimmed
    const fade = (el) => [{ opacity: 0 }, { opacity: getComputedStyle(el).opacity }];
    const start = new Map();
    const cols = Array.from({ length: COLUMNS }, () => []);
    for (const n of this._nodes) cols[n.rank].push(n);
    cols.forEach((col, r) => {
      col.sort((a, b) => a.y - b.y);
      const gap = Math.min(45, 360 / col.length);
      col.forEach((n, i) => start.set(n.id, 150 + r * PLAY_STEP + i * gap));
    });
    const anims = [];
    for (const el of this._vp.querySelectorAll(".col-head")) {
      const delay = Number(el.dataset.r) * PLAY_STEP;
      anims.push(el.animate(fade(el), { ...once, duration: 400, delay }));
    }
    for (const n of this._nodes) {
      const el = this._nodeEls.get(n.id);
      if (!el) continue;
      const delay = start.get(n.id);
      anims.push(el.animate(fade(el), { ...once, duration: PLAY_POP, delay }));
      anims.push(
        el
          .querySelector(".pop")
          .animate([{ transform: "scale(.3)" }, { transform: "scale(1.15)", offset: 0.7 }, { transform: "scale(1)" }], {
            ...once,
            duration: PLAY_POP + 120,
            delay,
          }),
      );
    }
    this._edges.forEach((e, i) => {
      const el = this._edgeEls[i];
      if (!el) return;
      const [a, b] = e.source.rank <= e.target.rank ? [e.source, e.target] : [e.target, e.source];
      const end = Math.max(start.get(a.id) + PLAY_POP, start.get(b.id));
      const delay = Math.max(0, end - PLAY_DRAW);
      if (el.hasAttribute("stroke-dasharray")) {
        anims.push(el.animate(fade(el), { ...once, duration: PLAY_DRAW, delay }));
        return;
      }
      // solid line drawn from its left end, arrow head added at the end
      const len = el.getTotalLength();
      const from = e.source === a ? len : -len;
      const dash = `${len} ${len}`;
      const anim = el.animate(
        [
          { strokeDasharray: dash, strokeDashoffset: from },
          { strokeDasharray: dash, strokeDashoffset: 0 },
        ],
        { ...once, duration: PLAY_DRAW, delay, easing: "ease-in-out" },
      );
      const marker = el.getAttribute("marker-end");
      if (marker) {
        el.removeAttribute("marker-end");
        const back = () => el.setAttribute("marker-end", marker);
        anim.finished.then(back, back);
      }
      anims.push(anim);
    });
    this._anims = anims;
  }

  // jump to the end of the opening animation
  _finish() {
    for (const a of this._anims || []) a.finish();
    this._anims = [];
  }

  // highlight

  // a person and its account light both branches
  related(id) {
    if (!this._byId.has(id)) return new Set([id]);
    const rank = (x) => this._byId.get(x).rank;
    const links = (x) => this._adjacent.get(x) || [];
    const out = branch(id, rank, links);
    for (const e of links(id)) {
      if (e.type !== "account") continue;
      for (const x of branch(e.from === id ? e.to : e.from, rank, links)) out.add(x);
    }
    return out;
  }

  _highlight() {
    if (!this._nodes) return;
    let lit = null;
    let links = !!this._selected;
    for (const n of this._nodes) n.hit = !!this._query && fold(`${n.name} ${n.id}`).includes(this._query);
    if (this._selected) lit = this.related(this._selected);
    else if (this._query) lit = new Set(this._nodes.filter((n) => n.hit).map((n) => n.id));
    else if (this._spotlight) {
      const asleep = this._nodes.filter((n) => n.flags?.includes("dormant"));
      if (asleep.length) {
        lit = new Set();
        for (const n of asleep) {
          n.hit = true;
          for (const e of this._adjacent.get(n.id) || []) lit.add(e.source.id).add(e.target.id);
          lit.add(n.id);
        }
        links = true;
      }
    }
    for (const n of this._nodes) {
      const el = this._nodeEls.get(n.id);
      if (!el) continue;
      el.classList.toggle("dim", !!lit && !lit.has(n.id));
      el.classList.toggle("sel", n.id === this._selected);
      el.classList.toggle("hit", n.hit);
    }
    this._edges.forEach((e, i) => {
      const asleep = !this._selected && (e.source.hit || e.target.hit);
      const on = !lit || (lit.has(e.source.id) && lit.has(e.target.id) && links && (this._selected || asleep));
      this._edgeEls[i]?.classList.toggle("dim", !!lit && !on);
      this._edgeEls[i]?.classList.toggle("lit", !!lit && on);
    });
  }

  // view

  _applyView() {
    const { x, y, k } = this._view;
    this._vp.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
  }

  // fit the whole map, or the given ids
  fit(ids = null) {
    if (!this._nodes?.length || !this.clientWidth) return;
    const nodes = ids ? this._nodes.filter((n) => ids.has(n.id)) : this._nodes;
    if (!nodes.length) return;
    if (!ids) this._fitted = true;
    let { x0, y0, x1, y1 } = this._box(nodes);
    x0 -= 10;
    x1 += 10;
    y0 -= 50;
    y1 += 6;
    const w = this.clientWidth;
    const h = this.clientHeight;
    const k = Math.min(ids ? 1.1 : 1.4, Math.max(0.15, Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.95));
    if (!ids && w < 600 && k < PHONE_ZOOM) {
      // on a phone: accounts column at a readable zoom, pan for the rest
      const tall = (y1 - y0) * PHONE_ZOOM > h;
      this._view = {
        k: PHONE_ZOOM,
        x: 8 - x0 * PHONE_ZOOM,
        y: tall ? 8 - y0 * PHONE_ZOOM : h / 2 - ((y0 + y1) / 2) * PHONE_ZOOM,
      };
      this._applyView();
      return;
    }
    this._view = { k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k };
    this._applyView();
  }

  _center(n) {
    const k = Math.max(this._view.k, 0.9);
    this._view = { k, x: this.clientWidth / 2 - n.x * k, y: this.clientHeight / 2 - n.y * k };
    this._applyView();
  }

  _zoom(factor, cx, cy) {
    const { x, y, k } = this._view;
    const next = Math.min(3, Math.max(0.12, k * factor));
    const f = next / k;
    this._view = { k: next, x: cx - (cx - x) * f, y: cy - (cy - y) * f };
    this._applyView();
  }

  _point(ev) {
    const box = this._svg.getBoundingClientRect();
    return { x: ev.clientX - box.left, y: ev.clientY - box.top };
  }

  _world(p) {
    return { x: (p.x - this._view.x) / this._view.k, y: (p.y - this._view.y) / this._view.k };
  }

  _bind() {
    const svg = this._svg;
    svg.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const p = this._point(ev);
        this._zoom(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015)), p.x, p.y);
      },
      { passive: false },
    );
    svg.addEventListener("dblclick", (ev) => {
      if (!ev.target.closest(".node")) this.fit();
    });
    svg.addEventListener("pointerdown", (ev) => {
      this._finish();
      const p = this._point(ev);
      this._pointers.set(ev.pointerId, p);
      try {
        svg.setPointerCapture(ev.pointerId);
      } catch (_e) {
        // synthetic events have no live pointer to capture
      }
      const el = ev.target.closest(".node");
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), k: this._view.k };
        this._drag = null;
        return;
      }
      if (el) {
        const node = this._byId.get(el.dataset.id);
        const w = this._world(p);
        this._drag = { node, dx: node.x - w.x, dy: node.y - w.y, start: p, moved: false };
      } else {
        this._drag = { pan: true, start: p, view: { ...this._view }, moved: false };
      }
    });
    svg.addEventListener("pointermove", (ev) => {
      if (!this._pointers.has(ev.pointerId)) return;
      const p = this._point(ev);
      this._pointers.set(ev.pointerId, p);
      if (this._gesture && this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const factor = (this._gesture.k * dist) / this._gesture.pinch / this._view.k;
        this._zoom(factor, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      const d = this._drag;
      if (!d) return;
      if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) < 4) return;
      d.moved = true;
      if (d.pan) {
        svg.classList.add("panning");
        this._view = { ...d.view, x: d.view.x + p.x - d.start.x, y: d.view.y + p.y - d.start.y };
        this._applyView();
        return;
      }
      const w = this._world(p);
      d.node.x = w.x + d.dx;
      d.node.y = w.y + d.dy;
      this._place();
    });
    const end = (ev) => {
      this._pointers.delete(ev.pointerId);
      if (this._pointers.size < 2) this._gesture = null;
      const d = this._drag;
      this._drag = null;
      svg.classList.remove("panning");
      if (!d) return;
      if (!d.moved) {
        const id = d.node ? d.node.id : null;
        this.select(id);
        this.dispatchEvent(new CustomEvent("node-select", { detail: { id } }));
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }
}

if (!customElements.get("clan-graph")) customElements.define("clan-graph", ClanGraph);
