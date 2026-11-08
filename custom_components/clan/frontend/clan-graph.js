// Map element: force layout, like the Zigbee network maps, or columns from accounts to automations.

const V = new URL(import.meta.url).search;
const { ICONS } = await import(`./clan-icons.js${V}`);

// column of each node type, accounts first
export const RANK = { user: 0, person: 1, device: 2, tracker: 2, notify: 3, ui: 3, routine: 4 };
export const COLORS = {
  user: "#1e88e5",
  person: "#43a047",
  device: "#8e24aa",
  tracker: "#6d4c41",
  notify: "#ef6c00",
  ui: "#0288d1",
  routine: "#607d8b",
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
};
export const EDGE_DASH = {
  registered: "5 4",
  includes: "7 3",
  watches: "1 5",
  mentions: "1 5",
};
const RADIUS = { user: 20, person: 22, device: 17, tracker: 14, notify: 15, ui: 17, routine: 12 };
const LENGTH = {
  account: 70,
  registered: 110,
  tracks: 90,
  notifies: 120,
  includes: 95,
  calls: 70,
  watches: 140,
  mentions: 150,
};
const ARROWS = new Set(["notifies", "includes", "calls"]);
const COLUMN_GAP = 250;
const LABEL_MAX = 24;
// distance between levels around an account
const RING = 105;
// islands up to this size without a person go to the side column
const SMALL = 4;
const LANE_STEP = 130;
const LANE_ROW = 50;
const LIST_ROW = 27;

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
function labelText(n, layout) {
  return layout === "columns" && n.rank === 4 ? n.name : short(n.name);
}

function labelWidth(n, layout) {
  return labelText(n, layout).length * 6.4;
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

// above this node count, forces are computed on a grid
const GRID_FROM = 160;
const CELL = 260;
// half of the neighbouring cells, so that each pair of cells is visited once
const HALF_NEIGHBOURS = [
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

function cellKey(x, y) {
  return (x + 32768) * 65536 + (y + 32768);
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

// Velocity Verlet with repulsion, springs and box collisions. Ties are hidden springs that keep each
// node at its level's distance from its accounts.
class Simulation {
  constructor(nodes, links, ties = [], gravity = false) {
    this.nodes = nodes;
    this.links = links;
    this.alpha = 1;
    // fewer steps on large maps
    this.decay = nodes.length < GRID_FROM ? 0.0228 : nodes.length < 600 ? 0.03 : 0.04;
    this.target = 0;
    const count = new Map();
    for (const l of links) {
      count.set(l.source, (count.get(l.source) || 0) + 1);
      count.set(l.target, (count.get(l.target) || 0) + 1);
    }
    for (const l of links) {
      const a = count.get(l.source);
      const b = count.get(l.target);
      l.strength = (l.weak ? 0.2 : 1) / Math.min(a, b);
      l.bias = a / (a + b);
    }
    for (const n of nodes) n.charge = -260 - 50 * Math.min((count.get(n) || 0) + (n.items?.length || 0), 12);
    this.springs = [...links, ...ties];
    this.lists = nodes.filter((n) => n.items);
    if (gravity) {
      this.center = {
        x: nodes.reduce((s, n) => s + n.x, 0) / nodes.length,
        y: nodes.reduce((s, n) => s + n.y, 0) / nodes.length,
      };
    }
  }

  // repulsion and box collision
  pair(p, q, alpha) {
    // forces on a list move its parent
    const P = p.items ? p.parent : p;
    const Q = q.items ? q.parent : q;
    if (P === Q) return;
    let dx = q.x - p.x;
    let dy = q.y - p.y;
    let d2 = dx * dx + dy * dy;
    if (d2 < 1e-6) {
      dx = (hash(p.id + q.id) - 0.5) * 1e-3;
      dy = (hash(q.id + p.id) - 0.5) * 1e-3;
      d2 = dx * dx + dy * dy;
    }
    if (d2 < 640000) {
      Q.vx += (dx * -p.charge * alpha) / d2 / 2;
      Q.vy += (dy * -p.charge * alpha) / d2 / 2;
      P.vx -= (dx * -q.charge * alpha) / d2 / 2;
      P.vy -= (dy * -q.charge * alpha) / d2 / 2;
    }
    if (p.hw || q.hw) {
      // boxes include the label
      const ox = (p.hw || p.r + 9) + (q.hw || q.r + 9) - Math.abs(dx);
      const oy = (p.hh || p.r + 9) + (q.hh || q.r + 9) - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        const push = Math.min(ox, oy) * 0.35;
        const px = ox < oy ? Math.sign(dx) * push : 0;
        const py = ox < oy ? 0 : Math.sign(dy) * push;
        Q.vx += px;
        Q.vy += py;
        P.vx -= px;
        P.vy -= py;
      }
      return;
    }
    const min = p.r + q.r + 18;
    if (d2 < min * min) {
      const d = Math.sqrt(d2);
      const push = ((min - d) / d) * 0.35;
      Q.vx += dx * push;
      Q.vy += dy * push;
      P.vx -= dx * push;
      P.vy -= dy * push;
    }
  }

  tick() {
    const alpha = this.alpha;
    const nodes = this.nodes;
    if (nodes.length < GRID_FROM) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) this.pair(nodes[i], nodes[j], alpha);
      }
    } else {
      // only neighbouring cells interact; boxes larger than a cell are checked against every node
      const grid = new Map();
      const big = [];
      for (const n of nodes) {
        if ((n.hw || 0) > CELL / 2 || (n.hh || 0) > CELL / 2) {
          big.push(n);
          continue;
        }
        n.cx = Math.floor(n.x / CELL);
        n.cy = Math.floor(n.y / CELL);
        const key = cellKey(n.cx, n.cy);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(n);
      }
      for (const cell of grid.values()) {
        for (let i = 0; i < cell.length; i++) {
          for (let j = i + 1; j < cell.length; j++) this.pair(cell[i], cell[j], alpha);
        }
        const { cx, cy } = cell[0];
        for (const [ox, oy] of HALF_NEIGHBOURS) {
          const other = grid.get(cellKey(cx + ox, cy + oy));
          if (!other) continue;
          for (const p of cell) for (const q of other) this.pair(p, q, alpha);
        }
      }
      const boxes = new Set(big);
      for (let i = 0; i < big.length; i++) {
        for (let j = i + 1; j < big.length; j++) this.pair(big[i], big[j], alpha);
        for (const n of nodes) if (!boxes.has(n)) this.pair(big[i], n, alpha);
      }
    }
    for (const l of this.springs) {
      const s = l.source;
      const t = l.target;
      let x = t.x + t.vx - s.x - s.vx;
      let y = t.y + t.vy - s.y - s.vy;
      const len = Math.sqrt(x * x + y * y) || 1e-6;
      const k = ((len - l.length) / len) * alpha * l.strength;
      x *= k;
      y *= k;
      t.vx -= x * l.bias;
      t.vy -= y * l.bias;
      s.vx += x * (1 - l.bias);
      s.vy += y * (1 - l.bias);
    }
    const c = this.center;
    let mid = 0;
    for (const n of nodes) {
      if (n.items) continue;
      mid += n.x / (nodes.length - this.lists.length);
      if (c) {
        n.vx += (c.x - n.x) * 0.012 * alpha;
        n.vy += (c.y - n.y) * 0.012 * alpha;
      }
      if (n.fx != null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= 0.6;
      n.vy *= 0.6;
      n.x += n.vx;
      n.y += n.vy;
    }
    // a list sits level with its parent, on the side away from the island centre
    for (const b of this.lists) {
      const p = b.parent;
      if (p.x - mid > 30) b.right = true;
      else if (p.x - mid < -30) b.right = false;
      b.x = p.x + (b.right === false ? -1 : 1) * b.gap;
      b.y = p.y;
    }
    this.alpha += (this.target - this.alpha) * this.decay;
  }
}

const STYLES = `
  :host { display: block; position: relative; overflow: hidden; touch-action: none; user-select: none; }
  svg { width: 100%; height: 100%; display: block; cursor: grab; }
  svg.panning { cursor: grabbing; }
  .edge { fill: none; stroke-width: 1.6; stroke-linecap: round; transition: opacity .15s; }
  .edge.main { stroke-width: 3; }
  .edge.off { opacity: .35; }
  .edge.bulk { opacity: .3; }
  .edge.bulk.lit { opacity: 1; }
  .edge.broken { stroke: var(--error-color, #db4437) !important; stroke-dasharray: 4 4; }
  .node { cursor: pointer; transition: opacity .15s; }
  .node .ring { fill: none; stroke-width: 3; stroke: transparent; }
  .node.s-error .ring { stroke: var(--error-color, #db4437); }
  .node.s-warn .ring { stroke: var(--warning-color, #ffa600); }
  .node.dormant:not(.s-error) .ring { stroke: var(--secondary-text-color, #727272); stroke-dasharray: 3 3; }
  .node.dormant .body, .node.dormant image { filter: grayscale(1); opacity: .5; }
  .node.dormant .label { fill: var(--secondary-text-color, #727272); font-style: italic; }
  .node.sel .ring { stroke: var(--primary-color, #03a9f4); stroke-width: 4; }
  .node.off .body, .node.off .icon { opacity: .45; }
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
    this._layout = "force";
    this._visible = () => true;
    this._pins = {};
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
    cancelAnimationFrame(this._frame);
  }

  // data: { nodes, edges } as built by the integration; options: layout, visible, pins, heads
  setData(data, options = {}) {
    this._data = data;
    if (options.layout) this._layout = options.layout;
    if (options.visible) this._visible = options.visible;
    if (options.pins) this._pins = options.pins;
    if (options.heads) this._columnHeads = options.heads;
    this._build();
  }

  setLayout(layout) {
    this._layout = layout;
    this._build();
    this.fit();
  }

  setVisible(visible) {
    this._visible = visible;
    this._build();
  }

  resetPins() {
    this._pins = {};
    this._build();
    this.fit();
    return this._pins;
  }

  get pins() {
    return this._pins;
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
    cancelAnimationFrame(this._frame);
    const nodes = this._data.nodes.filter((n) => this._visible(n));
    const byId = new Map();
    for (const raw of nodes) {
      const n = {
        ...raw,
        r: RADIUS[raw.type] || 14,
        rank: RANK[raw.type] ?? 2,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        side: "below",
      };
      const pin = this._layout === "force" ? this._pins[raw.id] : null;
      if (pin) {
        n.x = n.fx = pin[0];
        n.y = n.fy = pin[1];
      }
      byId.set(n.id, n);
    }
    const edges = [];
    for (const e of this._data.edges) {
      const source = byId.get(e.from);
      const target = byId.get(e.to);
      if (source && target) edges.push({ ...e, source, target, length: LENGTH[e.type] || 100 });
    }
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

    this._ties = [];
    this._listsAll = [];
    this._sim = null;
    if (this._layout === "columns") this._columns();
    else this._force();
    this._render();
    this._highlight();
  }

  _islands() {
    const seen = new Set();
    const groups = [];
    for (const start of this._nodes) {
      if (seen.has(start.id)) continue;
      const group = this._island(start);
      for (const n of group) seen.add(n.id);
      groups.push(group);
    }
    return groups;
  }

  // Radial layout around each account: person and devices on the first ring, the rest further out.
  // Small islands without a person go to a side column.
  _force() {
    const main = [];
    const side = [];
    for (const g of this._islands()) {
      const pinned = g.some((n) => this._pins[n.id]);
      const small = g.length <= SMALL && !g.some((n) => n.type === "person");
      (small && !pinned ? side : main).push(g);
    }
    for (const e of this._edges) {
      // secondary links are weak, unless they are a node's only link
      const alone = [e.source, e.target].some((n) => this._adjacent.get(n.id).length === 1);
      e.bulk = e.source.kind === "app_all";
      e.weak = !alone && (e.bulk || e.type === "watches" || e.type === "mentions");
    }
    for (const n of this._nodes) {
      // collision box including the label
      n.hw = Math.max(n.r + 8, labelWidth(n, "force") / 2 + 6);
      n.hh = n.r + 16;
    }
    for (const g of main) {
      const ties = this._levels(g);
      g.lists = this._lists(g);
      for (const b of g.lists) {
        b.right = Math.cos(b.parent.angle ?? 0) >= 0;
        b.x = b.parent.x + (b.right ? 1 : -1) * b.gap;
        b.y = b.parent.y;
      }
      this._ties.push(...ties);
      const sim = this._simulation(g, true);
      // settle before the first render
      while (sim.alpha > 0.002) sim.tick();
      for (const b of g.lists) this._dock(b);
      // labels below nodes, beside them in lists
      for (const n of g) n.side = n.fixedSide || "below";
    }
    const box = this._pack(main);
    this._lane(side, box);
  }

  // simulation of one island; each list is a single box
  _simulation(group, gravity) {
    const lists = this._listsOf(group);
    const nodes = [...group.filter((n) => !n.dock && !n.listed), ...lists];
    const inside = new Set(nodes);
    const links = this._edges.filter((e) => inside.has(e.source) && inside.has(e.target));
    return new Simulation(
      nodes,
      links,
      this._ties.filter((t) => inside.has(t.target)),
      gravity,
    );
  }

  _listsOf(group) {
    const parents = new Set(group);
    return this._listsAll.filter((b) => parents.has(b.parent));
  }

  // Routines whose only link goes to the same node, three or more, become a list beside that node.
  _lists(group) {
    const leaves = new Map();
    for (const n of group) {
      const links = this._adjacent.get(n.id) || [];
      if (n.type !== "routine" || links.length !== 1 || this._pins[n.id]) continue;
      const p = links[0].source === n ? links[0].target : links[0].source;
      if (p.rank >= n.rank) continue;
      if (!leaves.has(p)) leaves.set(p, []);
      leaves.get(p).push(n);
    }
    const lists = [];
    for (const [parent, items] of leaves) {
      if (items.length < 3) continue;
      items.sort((a, b) => a.name.localeCompare(b.name));
      const w = 2 * RADIUS.routine + 8 + Math.max(...items.map((n) => labelWidth(n, "force")));
      const h = items.length * LIST_ROW + 8;
      const b = { id: `list:${parent.id}`, parent, items, hw: w / 2, hh: h / 2, x: 0, y: 0 };
      // distance grows with the list length
      b.gap = parent.r + 30 + 5 * items.length + b.hw;
      for (const n of items) n.listed = true;
      lists.push(b);
    }
    this._listsAll.push(...lists);
    return lists;
  }

  // place the items inside the list box; again when the list changes side
  _dock(b) {
    b.docked = b.right;
    const x = b.right ? -b.hw + RADIUS.routine : b.hw - RADIUS.routine;
    b.items.forEach((n, i) => {
      n.fixedSide = b.right ? "right" : "left";
      n.side = n.fixedSide;
      n.dock = { list: b, dx: x, dy: -b.hh + 4 + LIST_ROW / 2 + i * LIST_ROW };
      n.x = b.x + n.dock.dx;
      n.y = b.y + n.dock.dy;
    });
  }

  // BFS from the accounts: level and owners of each node, initial positions, and the ties.
  _levels(group) {
    let roots = group.filter((n) => n.type === "user");
    if (!roots.length) {
      const top = Math.min(...group.map((n) => n.rank));
      roots = group.filter((n) => n.rank === top);
    }
    roots.sort((a, b) => userWeight(a) - userWeight(b) || a.name.localeCompare(b.name));
    for (const n of group) {
      n.level = Infinity;
      n.owners = [];
    }
    const queue = [];
    const spread = roots.length > 1 ? Math.max(2 * RING, roots.length * 80) : 0;
    roots.forEach((n, i) => {
      n.level = 0;
      n.owners = [n];
      n.angle = -Math.PI / 2 + (2 * Math.PI * i) / roots.length;
      n.x = spread * Math.cos(n.angle);
      n.y = spread * Math.sin(n.angle);
      queue.push(n);
    });
    const children = new Map();
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      const next = (this._adjacent.get(cur.id) || [])
        .map((e) => (e.source === cur ? e.target : e.source))
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      for (const m of next) {
        if (m.level === Infinity) {
          m.level = cur.level + 1;
          m.owners = [...cur.owners];
          if (!children.has(cur)) children.set(cur, []);
          children.get(cur).push(m);
          queue.push(m);
        } else if (m.level === cur.level + 1) {
          for (const o of cur.owners) if (!m.owners.includes(o)) m.owners.push(o);
        }
      }
    }
    // initial positions: children spread out from their parent
    for (const cur of queue) {
      const kids = children.get(cur) || [];
      const fan = cur.level === 0 ? 2 * Math.PI : Math.min(Math.PI * 0.9, kids.length * 0.35);
      kids.forEach((m, i) => {
        m.angle = cur.angle + (kids.length > 1 ? (i / (kids.length - (cur.level === 0 ? 0 : 1)) - 0.5) * fan : 0);
        m.x = cur.x + RING * Math.cos(m.angle) + (hash(m.id) - 0.5) * 4;
        m.y = cur.y + RING * Math.sin(m.angle) + (hash(`${m.id}y`) - 0.5) * 4;
      });
    }
    const pins = group.filter((n) => n.fx != null);
    if (pins.length) {
      // a pinned island stays where it was left
      const dx = pins.reduce((s, n) => s + this._pins[n.id][0] - n.x, 0) / pins.length;
      const dy = pins.reduce((s, n) => s + this._pins[n.id][1] - n.y, 0) / pins.length;
      for (const n of group) {
        if (n.fx != null) continue;
        n.x += dx;
        n.y += dy;
      }
      for (const n of pins) {
        n.x = n.fx;
        n.y = n.fy;
      }
    }
    const ties = [];
    for (const n of group) {
      if (!n.level || n.level === Infinity || n.owners.length > 4) continue;
      for (const o of n.owners) {
        ties.push({ source: o, target: n, length: RING * n.level, strength: 0.6 / n.owners.length, bias: 0.9 });
      }
    }
    return ties;
  }

  // Shelf packing of the islands, largest first.
  _pack(groups) {
    const boxes = groups.map((g) => ({ g, ...this._box(g) }));
    const free = boxes
      .filter((b) => !b.g.some((n) => n.fx != null))
      .sort((a, b) => b.g.length - a.g.length || b.w * b.h - a.w * a.h);
    const area = free.reduce((s, b) => s + b.w * b.h, 0);
    const width = Math.max(free[0]?.w || 0, Math.sqrt(area) * 1.5);
    let x = 0;
    let y = 0;
    let row = 0;
    for (const b of free) {
      if (x > 0 && x + b.w > width) {
        x = 0;
        y += row + 20;
        row = 0;
      }
      for (const n of [...b.g, ...(b.g.lists || [])]) {
        n.x += x - b.x0;
        n.y += y - b.y0;
      }
      x += b.w + 20;
      row = Math.max(row, b.h);
    }
    return this._box(groups.flat());
  }

  _box(nodes) {
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const n of nodes) {
      const w = labelWidth(n, this._layout);
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

  // Small islands, laid out left to right and stacked in columns on the right.
  _lane(groups, box) {
    if (!groups.length) return;
    const blocks = groups.map((g) => {
      const root = [...g].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))[0];
      const depth = new Map([[root, 0]]);
      const order = [root];
      for (let i = 0; i < order.length; i++) {
        for (const e of this._adjacent.get(order[i].id) || []) {
          const other = e.source === order[i] ? e.target : e.source;
          if (depth.has(other)) continue;
          depth.set(other, depth.get(order[i]) + 1);
          order.push(other);
        }
      }
      const cols = [];
      for (const n of order) (cols[depth.get(n)] ||= []).push(n);
      cols.forEach((col, d) =>
        col.forEach((n, i) => {
          n.x = d * LANE_STEP;
          n.y = (i - (col.length - 1) / 2) * LANE_ROW;
          n.fixedSide = d === cols.length - 1 ? "right" : "below";
          n.side = n.fixedSide;
        }),
      );
      return { g, root, ...this._box(g) };
    });
    blocks.sort(
      (a, b) => a.root.rank - b.root.rank || a.g.length - b.g.length || a.root.name.localeCompare(b.root.name),
    );
    const top = Number.isFinite(box.y0) ? box.y0 : 0;
    const height = Math.max(Number.isFinite(box.h) ? box.h : 0, 360);
    let x = Number.isFinite(box.x1) ? box.x1 + 80 : 0;
    let y = top;
    let width = 0;
    for (const b of blocks) {
      if (y > top && y + b.h > top + height) {
        x += width + 40;
        y = top;
        width = 0;
      }
      for (const n of b.g) {
        n.x += x - b.x0;
        n.y += y - b.y0;
      }
      y += b.h + 14;
      width = Math.max(width, b.w);
    }
  }

  _columns() {
    const cols = [[], [], [], [], []];
    for (const n of this._nodes) {
      cols[n.rank].push(n);
      n.side = n.rank === 4 ? "right" : "below";
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
      for (let r = 1; r < 5; r++) {
        sweep(cols[r], -1);
        index();
      }
      keep();
      for (let r = 3; r >= 0; r--) {
        if (r === 0) continue; // the account column keeps its sort order
        sweep(cols[r], 1);
        index();
      }
      keep();
    }
    best.cols.forEach((col, r) => {
      cols[r] = col;
    });
    index();
    // y: mean of the linked nodes on the left, without overlap
    const gaps = [64, 64, 56, 56, 36];
    const near = (n, lower) =>
      (this._adjacent.get(n.id) || [])
        .map((e) => (e.source === n ? e.target : e.source))
        .filter((m) => (lower ? m.rank < n.rank : m.rank > n.rank));
    const settle = (col, gap, wish) => {
      const wanted = col.map((n) => wish.get(n.id)).filter(Number.isFinite);
      let last = (wanted.length ? Math.min(...wanted) : -((col.length - 1) / 2) * gap) - gap;
      const ys = col.map((n) => {
        const want = wish.get(n.id);
        last = Math.max(Number.isFinite(want) ? want : last + gap, last + gap);
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
      for (const n of col) {
        n.x = r * COLUMN_GAP;
        n.fx = null;
        n.fy = null;
      }
      if (r === 0) col.forEach((n, i) => (n.y = (i - (col.length - 1) / 2) * gaps[0]));
      else settle(col, gaps[r], new Map(col.map((n) => [n.id, mean(near(n, true))])));
    });
    // nodes without links to the left are placed from their links to the right
    for (const r of [3, 2, 1]) {
      const col = cols[r];
      if (!col.some((n) => !near(n, true).length)) continue;
      const wish = new Map(col.map((n) => [n.id, near(n, true).length ? n.y : mean(near(n, false))]));
      col.sort((a, b) => (wish.get(a.id) ?? 0) - (wish.get(b.id) ?? 0));
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
    if (this._layout === "columns" && this._columnHeads.length) {
      heads = this._columnHeads
        .map((label, r) =>
          this._colTops?.[r] == null
            ? ""
            : `<text class="col-head" x="${r * COLUMN_GAP}" y="${this._colTops[r]}">${esc(label)}</text>`,
        )
        .join("");
    }
    const edges = this._edges
      .map((e, i) => {
        const cls = [
          "edge",
          `t-${e.type}`,
          e.main ? "main" : "",
          e.off ? "off" : "",
          e.broken ? "broken" : "",
          e.bulk && this._layout === "force" ? "bulk" : "",
        ].join(" ");
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
    const clip = `clip-${hash(n.id).toString(36).slice(2)}`;
    const body = picture
      ? `<clipPath id="${clip}"><circle r="${n.r}"/></clipPath><circle class="body" r="${n.r}" fill="${COLORS.person}"/>
         <image href="${esc(picture)}" x="${-n.r}" y="${-n.r}" width="${2 * n.r}" height="${2 * n.r}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
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
      <circle class="ring" r="${n.r + 4}"/>${body}${badge}${sleep}<text class="label">${esc(labelText(n, this._layout))}</text></g>`;
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
    for (const b of this._listsAll || []) {
      if (b.docked !== b.right) this._dock(b);
    }
    for (const n of this._nodes) {
      const el = this._nodeEls.get(n.id);
      if (!el) continue;
      if (n.dock) {
        n.x = n.dock.list.x + n.dock.dx;
        n.y = n.dock.list.y + n.dock.dy;
      }
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
    if (this._layout === "columns") {
      if (s.rank === t.rank) {
        // same column: arc on the right
        const x1 = s.x + s.r;
        const x2 = t.x + t.r + pad;
        const bend = 46 + Math.min(Math.abs(t.y - s.y) / 4, 60);
        return `M${x1},${s.y} C${x1 + bend},${s.y} ${x2 + bend},${t.y} ${x2},${t.y}`;
      }
      const dir = t.x > s.x ? 1 : -1;
      const x1 = s.x + dir * s.r;
      const x2 = t.x - dir * (t.r + pad);
      const mid = (x1 + x2) / 2;
      return `M${x1},${s.y} C${mid},${s.y} ${mid},${t.y} ${x2},${t.y}`;
    }
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return `M${s.x + ux * s.r},${s.y + uy * s.r} L${t.x - ux * (t.r + pad)},${t.y - uy * (t.r + pad)}`;
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
    if (!ids && this.clientWidth < 600 && this._layout === "force") {
      // narrow screens start on the largest island
      const largest = this._nodes.reduce((best, n) => {
        const island = this._island(n);
        return island.length > best.length ? island : best;
      }, []);
      this._fitted = true;
      return this.fit(new Set(largest.map((n) => n.id)));
    }
    const nodes = ids ? this._nodes.filter((n) => ids.has(n.id)) : this._nodes;
    if (!nodes.length) return;
    if (!ids) this._fitted = true;
    let { x0, y0, x1, y1 } = this._box(nodes);
    x0 -= 10;
    x1 += 10;
    y0 -= this._layout === "columns" ? 50 : 10;
    y1 += 6;
    const w = this.clientWidth;
    const h = this.clientHeight;
    const k = Math.min(ids ? 1.1 : 1.4, Math.max(0.15, Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.95));
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

  _island(start) {
    const out = [start];
    const seen = new Set([start.id]);
    for (let i = 0; i < out.length; i++) {
      for (const e of this._adjacent.get(out[i].id) || []) {
        const other = e.source === out[i] ? e.target : e.source;
        if (!seen.has(other.id)) {
          seen.add(other.id);
          out.push(other);
        }
      }
    }
    return out;
  }

  _animate() {
    cancelAnimationFrame(this._frame);
    const step = () => {
      if (!this._sim) return;
      this._sim.tick();
      this._place();
      if (this._sim.alpha > 0.004 || this._sim.target > 0) this._frame = requestAnimationFrame(step);
    };
    this._frame = requestAnimationFrame(step);
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
      if (d.node.dock) {
        // a list item moves alone and keeps its new offset
        d.node.dock.dx = d.node.x - d.node.dock.list.x;
        d.node.dock.dy = d.node.y - d.node.dock.list.y;
        this._place();
        return;
      }
      d.node.fx = d.node.x;
      d.node.fy = d.node.y;
      if (this._layout === "force" && !this._sim?.nodes.includes(d.node)) {
        // simulate only the dragged node's island
        this._sim = this._simulation(this._island(d.node), false);
        this._sim.alpha = 0.12;
      }
      if (this._sim) {
        this._sim.target = 0.12;
        if (this._sim.alpha < 0.12) this._sim.alpha = 0.12;
        if (!d.running) {
          d.running = true;
          this._animate();
        }
      } else {
        this._place();
      }
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
        return;
      }
      if (d.node && this._layout === "force") {
        if (this._sim) {
          this._sim.target = 0;
          const sim = this._sim;
          setTimeout(() => {
            if (this._sim === sim && sim.alpha < 0.005) this._sim = null;
          }, 3000);
        }
        this._pins = { ...this._pins, [d.node.id]: [Math.round(d.node.x), Math.round(d.node.y)] };
        this.dispatchEvent(new CustomEvent("pins-changed", { detail: { pins: this._pins } }));
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }
}

if (!customElements.get("clan-graph")) customElements.define("clan-graph", ClanGraph);
