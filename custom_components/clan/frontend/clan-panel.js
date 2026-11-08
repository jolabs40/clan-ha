// Sidebar panel, admin only. Sibling modules get this module's version query so that a browser
// never mixes files from two releases.

const V = new URL(import.meta.url).search;
const { texts, esc, ago, fill, issueText } = await import(`./clan-texts.js${V}`);
const { COLORS, EDGE_COLORS, EDGE_DASH, RANK, nodeIcon, branch, hiding } = await import(`./clan-graph.js${V}`);
const { ICONS } = await import(`./clan-icons.js${V}`);

const PREFS_KEY = "clan-prefs";
const ISSUES = "https://github.com/jolabs40/clan-ha/issues";
// bump to drop saved pins when the layout changes
const PINS_LAYOUT = 2;
const TYPES = ["user", "person", "device", "tracker", "notify", "ui", "routine"];
const SEVERITIES = ["error", "warn", "info"];
const EDGE_TYPES = ["account", "registered", "tracks", "notifies", "includes", "calls", "watches", "mentions"];

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch (_e) {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_e) {
    // storage unavailable (private browsing)
  }
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function svgIcon(path, color, size = 18) {
  return `<svg class="ni" viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="12" fill="${color}"/><path d="${path}" fill="#fff" transform="translate(4.8,4.8) scale(.6)"/></svg>`;
}

const STYLES = `
  :host { display: flex; flex-direction: column; height: 100vh; background: var(--primary-background-color);
    color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
  [hidden] { display: none !important; }
  button { font: inherit; color: inherit; }
  .top { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 12px; flex: none;
    background: var(--app-header-background-color, var(--primary-color)); color: var(--app-header-text-color, #fff);
    border-bottom: var(--app-header-border-bottom, none); }
  .top .title { font-size: 20px; flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ic { background: none; border: none; padding: 8px; border-radius: 50%; cursor: pointer; display: inline-flex; color: inherit; }
  .ic:hover { background: rgba(127, 127, 127, .18); }
  .tabs { display: flex; gap: 2px; padding: 0 12px; flex: none; background: var(--card-background-color);
    border-bottom: 1px solid var(--divider-color); overflow-x: auto; }
  .tab { background: none; border: none; padding: 12px 14px 10px; cursor: pointer; border-bottom: 2px solid transparent;
    color: var(--secondary-text-color); white-space: nowrap; display: inline-flex; gap: 6px; align-items: center; }
  .tab.on { color: var(--primary-color); border-bottom-color: var(--primary-color); }
  .count { font-size: 11px; border-radius: 9px; padding: 1px 6px; color: #fff; background: var(--secondary-text-color); }
  .count.error { background: var(--error-color, #db4437); }
  .count.warn { background: var(--warning-color, #ffa600); }
  .health { display: flex; gap: 10px; align-items: flex-start; padding: 10px 16px; flex: none; font-size: 14px;
    background: var(--warning-color, #ffa600); color: #000; }
  .health ha-icon { --mdc-icon-size: 20px; flex: none; }
  .health a { color: inherit; font-weight: 500; }
  .body { flex: 1 1 auto; display: flex; min-height: 0; position: relative; }
  .pane { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px; flex: none;
    border-bottom: 1px solid var(--divider-color); background: var(--card-background-color); }
  .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--divider-color); border-radius: 16px;
    padding: 4px 10px 4px 6px; background: none; cursor: pointer; font-size: 13px; }
  .chip.off { opacity: .45; }
  .chip .dot { width: 12px; height: 12px; border-radius: 50%; }
  .chip.plain { padding-left: 10px; }
  .chip ha-icon { --mdc-icon-size: 16px; }
  .chip.plain.on { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  .sep { flex: 1 1 auto; }
  .seg { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 16px; overflow: hidden; }
  .seg button { background: none; border: none; padding: 4px 12px; cursor: pointer; font-size: 13px; }
  .seg button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .search { display: flex; align-items: center; gap: 4px; border: 1px solid var(--divider-color); border-radius: 16px; padding: 0 8px; }
  .search input { border: none; background: none; color: inherit; font: inherit; font-size: 13px; width: 130px; padding: 5px 0; outline: none; }
  .search ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
  .bar .ic { padding: 6px; color: var(--secondary-text-color); }
  .bar.scope { padding: 6px 12px; }
  .bar.scope .chip { padding: 2px 6px 2px 4px; }
  .bar.scope .chip ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
  .bar.scope .ni { margin-right: 0; }
  .acts { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px 0; }
  .act { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--divider-color); border-radius: 16px;
    padding: 4px 12px 4px 8px; background: none; cursor: pointer; font-size: 13px; }
  .act ha-icon { --mdc-icon-size: 18px; }
  .act.on { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  .card .tools { display: flex; flex: none; color: var(--secondary-text-color); }
  .card .tools .ic { padding: 6px; }
  .card .tools .ic.on { color: var(--primary-color); }
  .card.masked > :not(header), .card.masked header > :not(.tools) { opacity: .5; }
  .map { flex: 1 1 auto; position: relative; min-height: 0; }
  clan-graph { position: absolute; inset: 0; }
  .legend { position: absolute; left: 12px; bottom: 12px; background: var(--card-background-color); border-radius: 12px;
    box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,.2)); border: 1px solid var(--divider-color);
    padding: 8px 12px; font-size: 11px; opacity: .94; }
  .legend h4 { margin: 0 0 6px; font-size: 12px; color: var(--secondary-text-color); font-weight: 500; text-transform: uppercase; letter-spacing: .05em; }
  .legend .row { display: flex; align-items: center; gap: 6px; margin: 2px 0; white-space: nowrap; }
  .legend svg.line { flex: none; }
  .legend .cols { display: grid; grid-template-columns: auto auto; gap: 0 16px; }
  .status { padding: 32px; text-align: center; color: var(--secondary-text-color); }
  .status ha-icon { --mdc-icon-size: 40px; display: block; margin: 0 auto 12px; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .drawer { width: 360px; flex: none; border-left: 1px solid var(--divider-color); background: var(--card-background-color);
    overflow-y: auto; padding: 0 0 24px; }
  .drawer header { display: flex; align-items: center; gap: 10px; padding: 14px 8px 10px 16px; position: sticky; top: 0;
    background: var(--card-background-color); border-bottom: 1px solid var(--divider-color); z-index: 1; }
  .drawer header .name { flex: 1 1 auto; min-width: 0; }
  .drawer header .name b { display: block; font-size: 17px; font-weight: 500; overflow-wrap: anywhere; }
  .drawer header .name small { color: var(--secondary-text-color); }
  .badges { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 16px 0; }
  .badge { font-size: 12px; border-radius: 10px; padding: 2px 8px; background: var(--secondary-background-color, #eee); }
  .badge.gold { background: #f9a825; color: #000; }
  .badge.red { background: var(--error-color, #db4437); color: #fff; }
  .badge.blue { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  dl { margin: 0; padding: 4px 16px; }
  dt { font-size: 12px; color: var(--secondary-text-color); margin-top: 12px; }
  dd { margin: 2px 0 0; overflow-wrap: anywhere; font-size: 14px; }
  dd ul { margin: 2px 0 0; padding: 0; list-style: none; }
  dd li { padding: 3px 0; }
  .ni { vertical-align: -4px; margin-right: 6px; flex: none; }
  .sub { color: var(--secondary-text-color); font-size: 12px; }
  div.sub { margin: 1px 0 0 22px; }
  div.sub.via { margin: 4px 0 2px; }
  .pills { display: flex; flex-wrap: wrap; gap: 2px 12px; }
  .pill { white-space: nowrap; }
  a.node, a.go { color: var(--primary-color); cursor: pointer; text-decoration: none; }
  a.node:hover, a.go:hover { text-decoration: underline; }
  code { font-size: 12px; background: var(--secondary-background-color, #f2f2f2); padding: 0 4px; border-radius: 4px; }
  .issues { list-style: none; margin: 0; padding: 0; }
  .issue { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; }
  .issue ha-icon { --mdc-icon-size: 18px; flex: none; }
  .issue.error ha-icon { color: var(--error-color, #db4437); }
  .issue.warn ha-icon { color: var(--warning-color, #ffa600); }
  .issue.info ha-icon { color: var(--info-color, #039be5); }
  .links { display: flex; gap: 12px; padding: 14px 16px 0; flex-wrap: wrap; }
  .scroll { flex: 1 1 auto; overflow-y: auto; padding: 16px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; align-items: start; max-width: 1400px; margin: 0 auto; }
  .card { background: var(--card-background-color); border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none); border: 1px solid var(--divider-color); padding: 0 0 12px; }
  .card header { display: flex; align-items: center; gap: 12px; padding: 14px 16px 6px; }
  .card header img, .card header .avatar { width: 44px; height: 44px; border-radius: 50%; flex: none; object-fit: cover; }
  .card header .name { flex: 1 1 auto; min-width: 0; }
  .card header .name b { font-size: 17px; font-weight: 500; display: block; }
  .card header .name a { cursor: pointer; }
  .card .badges { padding: 4px 16px 0; }
  h2 { font-size: 15px; font-weight: 500; color: var(--secondary-text-color); margin: 28px auto 12px; max-width: 1400px;
    text-transform: uppercase; letter-spacing: .05em; }
  h2:first-child { margin-top: 4px; }
  .findings { max-width: 900px; margin: 0 auto; }
  .findings section { background: var(--card-background-color); border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px); padding: 4px 16px; margin-bottom: 16px; }
  .findings h3 { font-size: 14px; margin: 12px 0 4px; display: flex; gap: 8px; align-items: center; }
  .findings .issue { border-top: 1px solid var(--divider-color); padding: 10px 0; }
  .findings .issue:first-of-type { border-top: none; }
  .findings .issue .what { flex: 1 1 auto; }
  .findings .issue .what b { font-weight: 500; }
  .findings .issue button { flex: none; background: none; border: 1px solid var(--divider-color); border-radius: 14px;
    padding: 3px 10px; cursor: pointer; font-size: 12px; color: var(--primary-color); }
  .empty { color: var(--secondary-text-color); padding: 24px; text-align: center; }
  @media (max-width: 870px) {
    .drawer { position: absolute; left: 0; right: 0; bottom: 0; width: auto; max-height: 58%; border-left: none;
      border-top: 1px solid var(--divider-color); border-radius: 16px 16px 0 0; box-shadow: 0 -4px 16px rgba(0,0,0,.25); z-index: 2; }
    .legend { display: none; }
    .bar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
    .bar > * { flex: none; }
    .search input { width: 90px; }
    .cards { grid-template-columns: 1fr; }
  }
`;

class ClanPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const prefs = loadPrefs();
    this._prefs = {
      tab: prefs.tab || "map",
      layout: prefs.layout === "columns" ? "columns" : "force",
      hidden: Array.isArray(prefs.hidden) ? prefs.hidden : [],
      system: !!prefs.system,
      disabled: prefs.disabled !== false,
      legend: prefs.legend !== false,
      spotlight: !!prefs.spotlight,
      pins: prefs.pinsLayout === PINS_LAYOUT && prefs.pins && typeof prefs.pins === "object" ? prefs.pins : {},
      pinsLayout: PINS_LAYOUT,
      // isolated and hidden node ids
      focus: Array.isArray(prefs.focus) ? prefs.focus : [],
      masked: Array.isArray(prefs.masked) ? prefs.masked : [],
    };
    this._data = null;
    this._selected = null;
    this._query = "";
    // HA can set hass before this module is defined; the own property would then shadow the setter
    for (const prop of ["hass", "narrow", "panel", "route"]) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const value = this[prop];
        delete this[prop];
        this._pending = { ...(this._pending || {}), [prop]: value };
      }
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this.T = texts(hass);
    if (first) this._init();
  }

  get hass() {
    return this._hass;
  }

  set narrow(value) {
    this._narrow = value;
    this.shadowRoot.querySelector("[data-menu]")?.toggleAttribute("hidden", !value);
  }

  set panel(_value) {}
  set route(_value) {}

  connectedCallback() {
    if (this._pending) {
      const pending = this._pending;
      this._pending = null;
      for (const [prop, value] of Object.entries(pending)) this[prop] = value;
    }
    // reload data older than a minute
    if (this._data && Date.now() - this._now > 60000) this._load();
  }

  _save() {
    savePrefs(this._prefs);
  }

  _init() {
    const T = this.T;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="top">
        <button class="ic" data-menu ${this._narrow ? "" : "hidden"} aria-label="menu"><ha-icon icon="mdi:menu"></ha-icon></button>
        <ha-icon icon="mdi:account-network"></ha-icon>
        <div class="title">${esc(T.title)}</div>
        <button class="ic" data-refresh title="${esc(T.refresh)}" aria-label="${esc(T.refresh)}"><ha-icon icon="mdi:refresh"></ha-icon></button>
      </div>
      <div class="tabs" data-tabs></div>
      <div class="health" data-health hidden></div>
      <div class="body">
        <div class="pane" data-pane></div>
        <aside class="drawer" data-drawer hidden></aside>
      </div>`;
    const root = this.shadowRoot;
    root.querySelector("[data-menu]").addEventListener("click", () => {
      this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    });
    root.querySelector("[data-refresh]").addEventListener("click", () => this._load());
    root.addEventListener("click", (ev) => this._onClick(ev));
    this._load();
  }

  async _load() {
    const T = this.T;
    const pane = this.shadowRoot.querySelector("[data-pane]");
    if (!this._data) {
      pane.innerHTML = `<div class="status"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${esc(T.loading)}</div>`;
    }
    const button = this.shadowRoot.querySelector("[data-refresh] ha-icon");
    button?.classList.add("spin");
    try {
      const data = await this._hass.callWS({ type: "clan/graph" });
      this._setData(data);
    } catch (err) {
      const unauthorized = err?.code === "unauthorized";
      pane.innerHTML = `<div class="status"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(
        unauthorized ? T.admin_only : `${T.load_failed}: ${err?.message || err}`,
      )}</div>`;
      this._graph = null;
    } finally {
      button?.classList.remove("spin");
    }
  }

  _setData(data) {
    this._data = data;
    this._now = Date.now();
    this._byId = new Map(data.nodes.map((n) => [n.id, n]));
    this._out = new Map();
    this._in = new Map();
    for (const e of data.edges) {
      push(this._out, e.from, e);
      push(this._in, e.to, e);
    }
    this._rank = (id) => RANK[this._byId.get(id)?.type] ?? 2;
    this._links = (id) => [...(this._out.get(id) || []), ...(this._in.get(id) || [])];
    this._issues = new Map();
    for (const i of data.issues) push(this._issues, i.node, i);
    if (this._selected && !this._byId.has(this._selected)) this._selected = null;
    this._renderHealth();
    this._renderTabs();
    this._renderPane();
    this._renderDrawer();
  }

  // banner for internal structures that could not be read
  _renderHealth() {
    const T = this.T;
    const row = this.shadowRoot.querySelector("[data-health]");
    const health = this._data.health || [];
    row.hidden = !health.length;
    if (!health.length) return;
    const what = health.map((code) => T[`health_${code}`] || code).join(", ");
    row.innerHTML = `<ha-icon icon="mdi:alert"></ha-icon><span>${esc(
      fill(T.health, { version: this._data.version || "", what }),
    )} <a href="${ISSUES}" target="_blank" rel="noreferrer">${esc(T.health_report)}</a></span>`;
  }

  // tabs and panes

  _renderTabs() {
    const T = this.T;
    const counts = { error: 0, warn: 0, info: 0 };
    const seen = new Set();
    for (const i of this._data.issues) {
      const key = `${i.severity}|${issueText(this.T, i, this._now)}`;
      if (!seen.has(key)) counts[i.severity] += 1;
      seen.add(key);
    }
    const worst = counts.error ? "error" : counts.warn ? "warn" : "";
    const badge = counts.error + counts.warn || counts.info;
    const tabs = [
      ["map", T.tab_map, ""],
      ["people", T.tab_people, ""],
      ["issues", T.tab_issues, badge ? `<span class="count ${worst}">${badge}</span>` : ""],
    ];
    this.shadowRoot.querySelector("[data-tabs]").innerHTML = tabs
      .map(
        ([id, label, extra]) =>
          `<button class="tab ${this._prefs.tab === id ? "on" : ""}" data-tab="${id}">${esc(label)}${extra}</button>`,
      )
      .join("");
  }

  _renderPane() {
    const tab = this._prefs.tab;
    if (tab === "people") this._renderPeople();
    else if (tab === "issues") this._renderIssues();
    else this._renderMap();
  }

  _visible() {
    const hidden = new Set(this._prefs.hidden);
    const { system, disabled } = this._prefs;
    const { show, hide } = this._scope();
    return (n) =>
      !hidden.has(n.type) &&
      (system || !(n.type === "user" && n.flags.includes("system"))) &&
      (disabled || !(n.type === "routine" && n.flags.includes("disabled"))) &&
      (!show || show.has(n.id)) &&
      !hide.has(n.id);
  }

  // Visible set after isolating and hiding; unknown ids are ignored. A person and its account are
  // isolated or hidden together.
  _scope() {
    const known = (id) => this._byId.has(id);
    const focus = this._prefs.focus.filter(known);
    const masked = this._prefs.masked.filter(known);
    const both = (ids) => [
      ...new Set(
        ids.flatMap((id) => [
          id,
          ...this._links(id)
            .filter((e) => e.type === "account")
            .map((e) => (e.from === id ? e.to : e.from)),
        ]),
      ),
    ];
    const show = focus.length ? new Set(both(focus).flatMap((id) => [...branch(id, this._rank, this._links)])) : null;
    return { focus, masked, show, hide: hiding(both(masked), this._rank, this._links) };
  }

  _renderMap() {
    const T = this.T;
    const P = this._prefs;
    const stats = this._data.stats || {};
    const chips = TYPES.filter((t) => stats[t])
      .map(
        (t) =>
          `<button class="chip ${P.hidden.includes(t) ? "off" : ""}" data-type="${t}"><span class="dot" style="background:${COLORS[t]}"></span>${esc(
            T[`type_${t}`],
          )} <span class="sub">${stats[t]}</span></button>`,
      )
      .join("");
    const hasSystem = this._data.nodes.some((n) => n.type === "user" && n.flags.includes("system"));
    const hasDisabled = this._data.nodes.some((n) => n.type === "routine" && n.flags.includes("disabled"));
    const asleep = this._data.nodes.filter((n) => n.flags.includes("dormant")).length;
    const pane = this.shadowRoot.querySelector("[data-pane]");
    pane.innerHTML = `
      <div class="bar">
        ${chips}
        ${hasSystem ? `<button class="chip plain ${P.system ? "on" : ""}" data-toggle="system">${esc(T.show_system)}</button>` : ""}
        ${hasDisabled ? `<button class="chip plain ${P.disabled ? "on" : ""}" data-toggle="disabled">${esc(T.show_disabled)}</button>` : ""}
        ${
          asleep
            ? `<button class="chip plain ${P.spotlight ? "on" : ""}" data-spotlight title="${esc(T.show_dormant_title)}"><ha-icon icon="mdi:sleep"></ha-icon>${esc(
                T.show_dormant,
              )} <span class="sub">${asleep}</span></button>`
            : ""
        }
        <span class="sep"></span>
        <label class="search"><ha-icon icon="mdi:magnify"></ha-icon><input data-search type="search" placeholder="${esc(T.search)}" value="${esc(this._query)}"></label>
        <span class="seg"><button data-layout="force" class="${P.layout === "force" ? "on" : ""}">${esc(T.layout_force)}</button><button data-layout="columns" class="${P.layout === "columns" ? "on" : ""}">${esc(T.layout_columns)}</button></span>
        <button class="ic" data-relayout title="${esc(T.layout_force)} ↺" aria-label="relayout" ${P.layout === "force" ? "" : "hidden"}><ha-icon icon="mdi:shuffle-variant"></ha-icon></button>
        <button class="ic" data-fit title="${esc(T.fit)}" aria-label="${esc(T.fit)}"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button>
        <button class="ic" data-legend title="${esc(T.legend)}" aria-label="${esc(T.legend)}"><ha-icon icon="mdi:map-legend"></ha-icon></button>
      </div>
      <div class="bar scope" data-scope></div>
      <div class="map"><clan-graph></clan-graph>${this._legendMarkup()}</div>`;
    const graph = pane.querySelector("clan-graph");
    this._graph = graph;
    this._renderScope();
    graph.setData(this._data, {
      layout: P.layout,
      visible: this._visible(),
      pins: P.pins,
      heads: [T.type_user, T.type_person, T.type_device, T.type_notify, T.type_routine],
    });
    graph.setSpotlight(P.spotlight);
    if (this._query) graph.setQuery(this._query);
    graph.select(this._selected);
    requestAnimationFrame(() => graph.fit());
    graph.addEventListener("node-select", (ev) => {
      this._selected = ev.detail.id;
      this._renderDrawer();
    });
    graph.addEventListener("pins-changed", (ev) => {
      P.pins = ev.detail.pins;
      this._save();
    });
    const input = pane.querySelector("[data-search]");
    input.addEventListener("input", () => {
      this._query = input.value;
      graph.setQuery(this._query);
    });
    input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const hit = graph.setQuery(input.value);
      if (hit) this._select(hit.id, true);
    });
  }

  // row of isolated and hidden nodes
  _renderScope() {
    const row = this.shadowRoot.querySelector("[data-scope]");
    if (!row) return;
    const T = this.T;
    const { focus, masked } = this._scope();
    const chip = (id, attr, title) => {
      const n = this._byId.get(id);
      const color = n.type === "user" && n.flags.includes("admin") ? "#f9a825" : COLORS[n.type];
      return `<button class="chip" ${attr}="${esc(id)}" title="${esc(title)}">${svgIcon(nodeIcon(n), color, 16)}${esc(
        n.name,
      )}<ha-icon icon="mdi:close"></ha-icon></button>`;
    };
    row.hidden = !focus.length && !masked.length;
    row.innerHTML = [
      focus.length
        ? `<span class="sub">${esc(T.isolated)}</span>${focus.map((id) => chip(id, "data-unisolate", T.unisolate)).join("")}`
        : "",
      masked.length
        ? `<span class="sub">${esc(T.masked)}</span>${masked.map((id) => chip(id, "data-unmask", T.unhide)).join("")}`
        : "",
      focus.length + masked.length > 1 ? `<button class="chip plain" data-showall>${esc(T.show_all)}</button>` : "",
    ].join("");
  }

  // refresh the map, the row and the drawer
  _applyScope() {
    this._save();
    if (this._prefs.tab === "people") {
      this._renderPeople();
      return;
    }
    this._renderScope();
    if (!this._graph) return;
    this._graph.setVisible(this._visible());
    const selected = this._selected && this._byId.get(this._selected);
    if (selected && !this._visible()(selected)) this._select(null);
    else this._renderDrawer();
    this._graph.fit();
  }

  _legendMarkup() {
    const T = this.T;
    if (!this._prefs.legend) return "";
    const types = ["user", "person", "device", "notify", "routine"]
      .map(
        (t) =>
          `<div class="row"><span class="dot-l">${svgIcon(nodeIcon({ type: t, flags: [], kind: t === "routine" ? "automation" : "phone" }), COLORS[t], 16)}</span>${esc(T[`one_${t}`])}</div>`,
      )
      .concat(
        `<div class="row"><span class="dot-l">${svgIcon(ICONS.sleep, "#757575", 16)}</span>${esc(T.flag_dormant)}</div>`,
      )
      .join("");
    const edges = EDGE_TYPES.map((t) => {
      const dash = EDGE_DASH[t] ? `stroke-dasharray="${EDGE_DASH[t]}"` : "";
      return `<div class="row"><svg class="line" width="28" height="8"><line x1="1" y1="4" x2="27" y2="4" stroke="${EDGE_COLORS[t]}" stroke-width="2" stroke-linecap="round" ${dash}/></svg>${esc(T[`edge_${t}`])}</div>`;
    }).join("");
    return `<div class="legend"><h4>${esc(T.legend)}</h4><div class="cols"><div>${types}</div><div>${edges}</div></div></div>`;
  }

  // drawer

  _select(id, center = false) {
    this._selected = id;
    // render the drawer first so the map fits the remaining width
    this._renderDrawer();
    if (this._graph) this._graph.select(id, center);
  }

  _link(id) {
    const n = this._byId.get(id);
    if (!n) return esc(id);
    const icon = svgIcon(nodeIcon(n), n.type === "user" && n.flags.includes("admin") ? "#f9a825" : COLORS[n.type], 16);
    return `${icon}<a class="node" data-node="${esc(id)}">${esc(n.name)}</a>`;
  }

  _list(items) {
    return items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : "";
  }

  _row(label, value) {
    return value === undefined || value === null || value === "" ? "" : `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  }

  _neighbors(id, dir, type, kind) {
    const edges = (dir === "out" ? this._out : this._in).get(id) || [];
    return edges.filter(
      (e) => (!type || e.type === type) && (!kind || this._byId.get(dir === "out" ? e.to : e.from)?.type === kind),
    );
  }

  // routines reaching the devices, directly or through a group or service, grouped by action
  _notifiers(deviceIds) {
    const byVia = new Map();
    const add = (via, routine) => {
      if (!byVia.has(via)) byVia.set(via, new Set());
      byVia.get(via).add(routine);
    };
    for (const deviceId of deviceIds) {
      for (const e of this._neighbors(deviceId, "in", "notifies")) add(e.labels?.[0] || "", e.from);
      for (const inc of this._neighbors(deviceId, "in", "includes")) {
        const via = this._byId.get(inc.from)?.name || "";
        for (const e of this._neighbors(inc.from, "in", "notifies")) add(via, e.from);
      }
    }
    const name = (id) => this._byId.get(id)?.name || id;
    return [...byVia.entries()]
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .map(([via, routines]) => {
        const links = [...routines]
          .sort((a, b) => name(a).localeCompare(name(b)))
          .map((id) => `<span class="pill">${this._link(id)}</span>`)
          .join("");
        return `${via ? `<div class="sub via">${esc(this.T.via)} <code>${esc(via)}</code></div>` : ""}<div class="pills">${links}</div>`;
      });
  }

  _flags(n) {
    const T = this.T;
    const out = [];
    if (n.type === "user") {
      const groups = n.info?.groups || [];
      if (n.flags.includes("owner")) out.push(`<span class="badge gold">${esc(T.flag_owner)}</span>`);
      if (n.flags.includes("admin")) out.push(`<span class="badge gold">${esc(T.flag_admin)}</span>`);
      else if (groups.includes("system-read-only")) out.push(`<span class="badge">${esc(T.flag_read_only)}</span>`);
      else out.push(`<span class="badge">${esc(T.flag_user)}</span>`);
    }
    const names = {
      system: "flag_system",
      inactive: "flag_inactive",
      local_only: "flag_local_only",
      mfa: "flag_mfa",
      disabled: "flag_disabled",
      missing: "flag_missing",
      app: "flag_app",
      no_push: "flag_no_push",
      dormant: "flag_dormant",
    };
    for (const flag of n.flags) {
      if (!names[flag]) continue;
      const cls = flag === "missing" || flag === "no_push" ? "red" : flag === "mfa" || flag === "app" ? "blue" : "";
      out.push(`<span class="badge ${cls}">${esc(T[names[flag]])}</span>`);
    }
    return out.length ? `<div class="badges">${out.join("")}</div>` : "";
  }

  _issueList(id) {
    const issues = this._issues.get(id) || [];
    if (!issues.length) return "";
    const icon = { error: "mdi:alert-circle", warn: "mdi:alert", info: "mdi:information-outline" };
    return `<dt>${esc(this.T.findings)}</dt><dd><ul class="issues">${issues
      .map(
        (i) =>
          `<li class="issue ${i.severity}"><ha-icon icon="${icon[i.severity]}"></ha-icon><span>${esc(issueText(this.T, i, this._now))}</span></li>`,
      )
      .join("")}</ul></dd>`;
  }

  _state(value) {
    const T = this.T;
    if (value === "home") return T.home;
    if (value === "not_home") return T.not_home;
    if (!value || value === "unknown") return T.unknown;
    const zone = this._hass.states[`zone.${value}`];
    return zone?.attributes?.friendly_name || value;
  }

  _details(n) {
    const T = this.T;
    const info = n.info || {};
    const now = this._now;
    const lang = T.lang;
    let rows = "";
    const links = [];
    if (n.type === "user") {
      rows += this._row(T.usernames, (info.usernames || []).map((u) => `<code>${esc(u)}</code>`).join(" "));
      rows += this._row(T.providers, (info.providers || []).map((p) => esc(T[`provider_${p}`] || p)).join(", "));
      rows += this._row(T.last_seen, info.last_seen ? esc(ago(info.last_seen, now, lang, T)) : "");
      rows += this._row(T.sessions, info.sessions ? String(info.sessions) : "");
      rows += this._row(T.person, this._list(this._neighbors(n.id, "out", "account").map((e) => this._link(e.to))));
      const devices = this._neighbors(n.id, "out", "registered").map((e) => e.to);
      rows += this._row(T.devices, this._list(devices.map((d) => this._deviceLine(d))));
      rows += this._row(T.tokens, this._list(this._tokens(info.tokens)));
      const persons = this._neighbors(n.id, "out", "account").map((e) => e.to);
      const tracked = persons.flatMap((p) => this._neighbors(p, "out", "tracks").map((e) => e.to));
      rows += this._row(T.notified_by, this._list(this._notifiers([...new Set([...devices, ...tracked])])));
      const mentioned = this._neighbors(n.id, "in", "mentions").map((e) => this._link(e.from));
      if (mentioned.length) rows += this._row(T.used_by, this._list(mentioned));
      links.push(["/config/users", T.open]);
    } else if (n.type === "person") {
      rows += this._row(T.state, esc(this._state(info.state)));
      const account = this._neighbors(n.id, "in", "account").map((e) => this._link(e.from));
      rows += this._row(T.account, account.length ? this._list(account) : esc(T.no_account));
      const tracks = this._neighbors(n.id, "out", "tracks").map((e) => {
        const ids = (e.labels || []).map((l) => `<code>${esc(l)}</code>`).join(" ");
        return `${this._link(e.to)}<div class="sub">${ids}${e.main ? ` ★ ${esc(T.edge_source)}` : ""}</div>`;
      });
      rows += this._row(T.trackers, this._list(tracks));
      const devices = this._neighbors(n.id, "out", "tracks").map((e) => e.to);
      rows += this._row(T.notified_by, this._list(this._notifiers(devices)));
      rows += this._row(
        T.presence_used_by,
        this._list(this._neighbors(n.id, "in", "watches").map((e) => this._link(e.from))),
      );
      links.push(["/config/person", T.open_person]);
    } else if (n.type === "device" || n.type === "tracker") {
      const app = info.app;
      rows += this._row(T.model, esc([info.manufacturer, info.model].filter(Boolean).join(" ")));
      if (app) {
        rows += this._row(T.os, esc(app.os || ""));
        rows += this._row(T.app_version, esc(app.version || ""));
        rows += this._row(T.push, esc(app.push ? T.yes : T.no));
      }
      rows += this._row(T.area, esc(info.area || ""));
      rows += this._row(
        T.last_seen,
        info.silent ? esc(T.since_start) : info.last_seen ? esc(ago(info.last_seen, now, lang, T)) : "",
      );
      if (info.entity_id) rows += this._row("Entity", `<code>${esc(info.entity_id)}</code>`);
      if (info.state) rows += this._row(T.state, esc(this._state(info.state)));
      rows += this._row(
        T.registered_by,
        this._list(this._neighbors(n.id, "in", "registered").map((e) => this._link(e.from))),
      );
      rows += this._row(
        T.followed_by,
        this._list(
          this._neighbors(n.id, "in", "tracks").map(
            (e) =>
              `${this._link(e.from)}<div class="sub">${(e.labels || []).map((l) => `<code>${esc(l)}</code>`).join(" ")}</div>`,
          ),
        ),
      );
      rows += this._row(T.trackers, (info.trackers || []).map((t) => `<code>${esc(t)}</code>`).join(" "));
      rows += this._row(T.services, (info.services || []).map((s) => `<code>${esc(s)}</code>`).join(" "));
      rows += this._row(T.notify_entities, (info.notify || []).map((s) => `<code>${esc(s)}</code>`).join(" "));
      rows += this._row(T.notified_by, this._list(this._notifiers([n.id])));
      rows += this._row(
        T.presence_used_by,
        this._list(this._neighbors(n.id, "in", "watches").map((e) => this._link(e.from))),
      );
      if (info.app?.entry_id) {
        // Mobile App entry, where it can be renamed or deleted
        links.push([`/config/integrations/integration/mobile_app#config_entry=${info.app.entry_id}`, T.open_app]);
      } else if (info.device_id) {
        links.push([`/config/devices/device/${info.device_id}`, T.open_device]);
      }
    } else if (n.type === "notify") {
      rows += this._row(T.service, `<code>${esc(info.service || info.entity_id || n.name)}</code>`);
      rows += this._row(T.platform, esc(info.platform || ""));
      rows += this._row(T.one_notify, esc(T[`kind_${n.kind}`] || ""));
      rows += this._row(T.reaches, this._list(this._neighbors(n.id, "out", "includes").map((e) => this._link(e.to))));
      rows += this._row(T.used_by, this._list(this._neighbors(n.id, "in", "notifies").map((e) => this._link(e.from))));
    } else if (n.type === "ui") {
      rows += `<dd style="margin-top:12px">${esc(T.ui_text)}</dd>`;
      rows += this._row(T.used_by, this._list(this._neighbors(n.id, "in", "notifies").map((e) => this._link(e.from))));
    } else if (n.type === "routine") {
      rows += this._row("Entity", `<code>${esc(info.entity_id)}</code>`);
      if (info.kind === "automation") rows += this._row(T.enabled, esc(info.enabled ? T.yes : T.no));
      rows += this._row(T.last_triggered, info.kind !== "alert" ? esc(ago(info.last_triggered, now, lang, T)) : "");
      const targets = this._neighbors(n.id, "out", "notifies").map(
        (e) =>
          `${this._link(e.to)}<div class="sub">${(e.labels || []).map((l) => `<code>${esc(l)}</code>`).join(" ")}</div>`,
      );
      rows += this._row(T.targets, this._list(targets));
      rows += this._row(T.runs, this._list(this._neighbors(n.id, "out", "calls").map((e) => this._link(e.to))));
      rows += this._row(T.run_by, this._list(this._neighbors(n.id, "in", "calls").map((e) => this._link(e.from))));
      rows += this._row(
        T.edge_watches,
        this._list(this._neighbors(n.id, "out", "watches").map((e) => this._link(e.to))),
      );
      rows += this._row(
        T.names_users,
        this._list(this._neighbors(n.id, "out", "mentions").map((e) => this._link(e.to))),
      );
      if (info.path) links.push([info.path, T.edit]);
    }
    rows += this._issueList(n.id);
    return { rows, links };
  }

  // HA records a long-lived token's creation, not its use
  _tokens(tokens) {
    const T = this.T;
    return (tokens || []).map(
      (t) =>
        `<b>${esc(t.name || "?")}</b> <span class="sub">${esc(T.token_created)} ${esc(ago(t.created, this._now, T.lang, T))}</span>`,
    );
  }

  _deviceLine(id) {
    const n = this._byId.get(id);
    if (!n) return esc(id);
    const T = this.T;
    const app = n.info?.app;
    const bits = [app?.os, app?.version ? `${T.app_version} ${app.version.split(" ")[0]}` : null].filter(Boolean);
    const seen = n.info?.silent ? T.since_start : n.info?.last_seen ? ago(n.info.last_seen, this._now, T.lang, T) : "";
    const warn =
      n.status !== "ok"
        ? ` <ha-icon icon="mdi:alert" style="--mdc-icon-size:14px;color:var(--${n.status === "error" ? "error" : "warning"}-color)"></ha-icon>`
        : "";
    return `${this._link(id)}${warn}<div class="sub">${esc(bits.join(", "))}${seen ? ` · ${esc(seen)}` : ""}</div>`;
  }

  // isolate and hide buttons
  _actions(n) {
    const T = this.T;
    const isolated = this._prefs.focus.includes(n.id);
    const masked = this._prefs.masked.includes(n.id);
    return `<div class="acts">
      <button class="act ${isolated ? "on" : ""}" data-isolate="${esc(n.id)}" title="${esc(T.isolate_title)}"><ha-icon icon="mdi:filter-variant"></ha-icon>${esc(
        isolated ? T.unisolate : T.isolate,
      )}</button>
      <button class="act ${masked ? "on" : ""}" data-mask="${esc(n.id)}" title="${esc(T.hide_title)}"><ha-icon icon="${
        masked ? "mdi:eye-outline" : "mdi:eye-off-outline"
      }"></ha-icon>${esc(masked ? T.unhide : T.hide_branch)}</button>
    </div>`;
  }

  _renderDrawer() {
    const drawer = this.shadowRoot.querySelector("[data-drawer]");
    const n = this._selected && this._byId?.get(this._selected);
    const show = !!n && this._prefs.tab === "map";
    drawer.hidden = !show;
    if (!show) return;
    const T = this.T;
    const { rows, links } = this._details(n);
    const color = n.type === "user" && n.flags.includes("admin") ? "#f9a825" : COLORS[n.type];
    const kind = n.type === "routine" ? T[`kind_${n.kind}`] || T.one_routine : T[`one_${n.type}`];
    drawer.innerHTML = `
      <header>${svgIcon(nodeIcon(n), color, 36)}
        <div class="name"><b>${esc(n.name)}</b><small>${esc(kind)}</small></div>
        <button class="ic" data-close title="${esc(T.close)}" aria-label="${esc(T.close)}"><ha-icon icon="mdi:close"></ha-icon></button>
      </header>
      ${this._flags(n)}
      ${this._actions(n)}
      <dl>${rows}</dl>
      ${links.length ? `<div class="links">${links.map(([path, label]) => `<a class="go" data-go="${esc(path)}">${esc(label)} ›</a>`).join("")}</div>` : ""}`;
    drawer.scrollTop = 0;
  }

  // by person

  _renderPeople() {
    const T = this.T;
    this._hiddenNow = this._scope().hide;
    const users = this._data.nodes.filter((n) => n.type === "user");
    const rank = (n) => (n.flags.includes("owner") ? 0 : n.flags.includes("admin") ? 1 : 2);
    const humans = users
      .filter((n) => !n.flags.includes("system"))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const system = users.filter((n) => n.flags.includes("system"));
    const persons = this._data.nodes.filter((n) => n.type === "person");
    const lonely = persons.filter((p) => !this._neighbors(p.id, "in", "account").length);
    const owned = new Set();
    for (const e of this._data.edges) if (e.type === "registered" || e.type === "tracks") owned.add(e.to);
    const unowned = this._data.nodes.filter((n) => n.type === "device" && !owned.has(n.id));
    const others = this._data.nodes.filter((n) => (n.type === "notify" && n.kind !== "app_all") || n.type === "ui");

    let html = `<h2>${esc(T.people_title)}</h2><div class="cards">${humans.map((u) => this._userCard(u)).join("")}${lonely
      .map((p) => this._personCard(p))
      .join("")}</div>`;
    if (others.length) {
      html += `<h2>${esc(T.other_receivers)}</h2><div class="cards">${others.map((n) => this._miniCard(n)).join("")}</div>`;
    }
    if (unowned.length) {
      html += `<h2>${esc(T.unowned_devices)}</h2><div class="cards">${unowned.map((n) => this._miniCard(n)).join("")}</div>`;
    }
    if (system.length) {
      html += `<h2>${esc(T.system_accounts)}</h2><div class="cards">${system.map((u) => this._miniCard(u)).join("")}</div>`;
    }
    this.shadowRoot.querySelector("[data-pane]").innerHTML = `<div class="scroll">${html}</div>`;
    this._graph = null;
  }

  _avatar(n, person) {
    const picture = person?.info?.picture;
    if (picture) return `<img src="${esc(picture)}" alt="">`;
    const color = n.type === "user" && n.flags.includes("admin") ? "#f9a825" : COLORS[n.type];
    return svgIcon(nodeIcon(n), color, 44).replace('class="ni"', 'class="avatar"');
  }

  _userCard(u) {
    const T = this.T;
    const now = this._now;
    const personIds = this._neighbors(u.id, "out", "account").map((e) => e.to);
    const person = personIds.length ? this._byId.get(personIds[0]) : null;
    const devices = this._neighbors(u.id, "out", "registered").map((e) => e.to);
    let rows = "";
    rows += this._row(T.usernames, (u.info?.usernames || []).map((x) => `<code>${esc(x)}</code>`).join(" "));
    rows += this._row(T.last_seen, u.info?.last_seen ? esc(ago(u.info.last_seen, now, T.lang, T)) : "");
    let tracked = [];
    if (person) {
      const tracks = this._neighbors(person.id, "out", "tracks");
      tracked = tracks.map((e) => e.to);
      rows += this._row(
        T.person,
        `${this._link(person.id)} <span class="sub">${esc(this._state(person.info?.state))}</span>`,
      );
      rows += this._row(
        T.trackers,
        this._list(
          tracks.map((e) => `${this._link(e.to)}${e.main ? ` <span class="sub">★ ${esc(T.edge_source)}</span>` : ""}`),
        ),
      );
    } else {
      rows += this._row(T.person, `<span class="sub">${esc(T.no_person)}</span>`);
    }
    rows += this._row(T.devices, this._list(devices.map((d) => this._deviceLine(d))));
    const notified = this._notifiers([...new Set([...devices, ...tracked])]);
    rows += this._row(
      T.notified_by,
      notified.length ? this._list(notified) : `<span class="sub">${esc(T.nobody_notified)}</span>`,
    );
    if (person) {
      rows += this._row(
        T.presence_used_by,
        this._list(this._neighbors(person.id, "in", "watches").map((e) => this._link(e.from))),
      );
    }
    rows += this._row(T.tokens, this._list(this._tokens(u.info?.tokens)));
    const issues = [u.id, person?.id, ...devices]
      .filter(Boolean)
      .flatMap((id) => (this._issues.get(id) || []).map((i) => ({ ...i, id })));
    const icon = { error: "mdi:alert-circle", warn: "mdi:alert", info: "mdi:information-outline" };
    if (issues.length) {
      rows += `<dt>${esc(T.findings)}</dt><dd><ul class="issues">${issues
        .map(
          (i) =>
            `<li class="issue ${i.severity}"><ha-icon icon="${icon[i.severity]}"></ha-icon><span>${
              i.id !== u.id ? `<a class="node" data-node="${esc(i.id)}">${esc(this._byId.get(i.id)?.name)}</a> : ` : ""
            }${esc(issueText(T, i, now))}</span></li>`,
        )
        .join("")}</ul></dd>`;
    }
    return `<div class="card ${this._cardClass(u)}"><header>${this._avatar(u, person)}<div class="name"><b><a class="node" data-node="${esc(u.id)}">${esc(
      person?.name && person.name !== u.name ? `${u.name} · ${person.name}` : u.name,
    )}</a></b></div>${this._cardTools(u)}</header>${this._flags(u)}<dl>${rows}</dl></div>`;
  }

  _personCard(p) {
    const T = this.T;
    const tracks = this._neighbors(p.id, "out", "tracks");
    let rows = this._row(T.account, esc(T.no_account));
    rows += this._row(T.state, esc(this._state(p.info?.state)));
    rows += this._row(T.trackers, this._list(tracks.map((e) => this._link(e.to))));
    rows += this._row(T.notified_by, this._list(this._notifiers(tracks.map((e) => e.to))));
    rows += this._issueList(p.id);
    return `<div class="card ${this._cardClass(p)}"><header>${this._avatar(p, p)}<div class="name"><b><a class="node" data-node="${esc(p.id)}">${esc(p.name)}</a></b></div>${this._cardTools(p)}</header><dl>${rows}</dl></div>`;
  }

  _miniCard(n) {
    const T = this.T;
    const { rows } = this._details(n);
    const color = n.type === "user" && n.flags.includes("admin") ? "#f9a825" : COLORS[n.type];
    return `<div class="card ${this._cardClass(n)}"><header>${svgIcon(nodeIcon(n), color, 36)}<div class="name"><b><a class="node" data-node="${esc(n.id)}">${esc(
      n.name,
    )}</a></b><span class="sub">${esc(T[`one_${n.type}`])}</span></div>${this._cardTools(n)}</header>${this._flags(n)}<dl>${rows}</dl></div>`;
  }

  // hidden nodes keep their card, dimmed
  _cardClass(n) {
    return this._hiddenNow?.has(n.id) ? "masked" : "";
  }

  _cardTools(n) {
    const T = this.T;
    const masked = this._prefs.masked.includes(n.id);
    return `<span class="tools"><button class="ic" data-isolate="${esc(n.id)}" title="${esc(T.isolate_title)}" aria-label="${esc(
      T.isolate,
    )}"><ha-icon icon="mdi:filter-variant"></ha-icon></button><button class="ic ${masked ? "on" : ""}" data-mask="${esc(n.id)}" title="${esc(
      masked ? T.unhide : T.hide_title,
    )}" aria-label="${esc(masked ? T.unhide : T.hide_branch)}"><ha-icon icon="${masked ? "mdi:eye-outline" : "mdi:eye-off-outline"}"></ha-icon></button></span>`;
  }

  // findings

  _renderIssues() {
    const T = this.T;
    const icon = { error: "mdi:alert-circle", warn: "mdi:alert", info: "mdi:information-outline" };
    const html = SEVERITIES.map((sev) => {
      // identical findings on several nodes are merged
      const merged = new Map();
      for (const i of this._data.issues.filter((x) => x.severity === sev)) {
        const text = issueText(T, i, this._now);
        if (!merged.has(text)) merged.set(text, []);
        merged.get(text).push(i.node);
      }
      if (!merged.size) return "";
      const rows = [...merged.entries()]
        .map(([text, ids]) => {
          const first = this._byId.get(ids[0]);
          const kind = first ? (first.type === "routine" ? T[`kind_${first.kind}`] : T[`one_${first.type}`]) : "";
          const names = [...new Set(ids)].map(
            (id) => `<a class="node" data-show="${esc(id)}">${esc(this._byId.get(id)?.name || id)}</a>`,
          );
          return `<div class="issue ${sev}"><span class="what"><b>${names.join(", ")}</b> <span class="sub">${esc(kind)}</span><br>${esc(
            text,
          )}</span><button data-show="${esc(ids[0])}">${esc(T.show_on_map)}</button></div>`;
        })
        .join("");
      return `<section><h3 class="issue ${sev}"><ha-icon icon="${icon[sev]}"></ha-icon>${esc(T[`sev_${sev}`])} <span class="count ${sev}">${merged.size}</span></h3>${rows}</section>`;
    }).join("");
    this.shadowRoot.querySelector("[data-pane]").innerHTML = `<div class="scroll"><div class="findings">${
      html || `<div class="empty">${esc(T.no_findings)}</div>`
    }</div></div>`;
    this._graph = null;
  }

  // Make a node visible: clear its type filter, the isolation and the hides that cover it.
  _reveal(node) {
    const P = this._prefs;
    P.hidden = P.hidden.filter((t) => t !== node.type);
    if (node.flags.includes("system")) P.system = true;
    if (node.flags.includes("disabled")) P.disabled = true;
    const { show } = this._scope();
    if (show && !show.has(node.id)) P.focus = [];
    while (P.masked.length && this._scope().hide.has(node.id)) {
      const culprit = P.masked.find(
        (m) =>
          !hiding(
            P.masked.filter((x) => x !== m),
            this._rank,
            this._links,
          ).has(node.id),
      );
      P.masked = culprit ? P.masked.filter((x) => x !== culprit) : P.masked.slice(0, -1);
    }
  }

  // events

  _onClick(ev) {
    const target = ev.target.closest("button, a");
    if (!target) return;
    const P = this._prefs;
    const d = target.dataset;
    if (d.tab) {
      P.tab = d.tab;
      this._save();
      this._renderTabs();
      this._renderPane();
      this._renderDrawer();
    } else if (d.type) {
      P.hidden = P.hidden.includes(d.type) ? P.hidden.filter((t) => t !== d.type) : [...P.hidden, d.type];
      this._save();
      target.classList.toggle("off");
      this._graph?.setVisible(this._visible());
      this._graph?.fit();
    } else if (d.toggle) {
      P[d.toggle] = !P[d.toggle];
      this._save();
      target.classList.toggle("on");
      this._graph?.setVisible(this._visible());
      this._graph?.fit();
    } else if (d.layout) {
      if (P.layout === d.layout) return;
      P.layout = d.layout;
      this._save();
      this._renderMap();
    } else if (target.hasAttribute("data-spotlight")) {
      P.spotlight = !P.spotlight;
      this._save();
      target.classList.toggle("on", P.spotlight);
      this._graph?.setSpotlight(P.spotlight);
    } else if (target.hasAttribute("data-relayout")) {
      P.pins = this._graph?.resetPins() || {};
      this._save();
    } else if (target.hasAttribute("data-fit")) {
      this._graph?.fit();
    } else if (target.hasAttribute("data-legend")) {
      P.legend = !P.legend;
      this._save();
      const map = this.shadowRoot.querySelector(".map");
      map.querySelector(".legend")?.remove();
      if (P.legend) map.insertAdjacentHTML("beforeend", this._legendMarkup());
    } else if (target.hasAttribute("data-close")) {
      this._select(null);
    } else if (d.node || d.show) {
      const id = d.node || d.show;
      if (P.tab !== "map") {
        P.tab = "map";
        this._save();
        this._selected = id;
        this._renderTabs();
        this._renderPane();
        const node = this._byId.get(id);
        if (node && this._graph && !this._visible()(node)) {
          this._reveal(node);
          this._save();
          this._renderMap();
        }
        requestAnimationFrame(() => this._select(id, true));
      } else {
        this._select(id, true);
      }
    } else if (d.isolate) {
      // one isolated branch at a time; isolating it again clears it
      P.focus = P.focus.length === 1 && P.focus[0] === d.isolate ? [] : [d.isolate];
      if (P.tab !== "map") {
        P.tab = "map";
        this._selected = d.isolate;
        this._save();
        this._renderTabs();
        this._renderPane();
        requestAnimationFrame(() => this._select(d.isolate));
        return;
      }
      this._applyScope();
    } else if (d.mask) {
      P.masked = P.masked.includes(d.mask) ? P.masked.filter((x) => x !== d.mask) : [...P.masked, d.mask];
      this._applyScope();
    } else if (d.unisolate) {
      P.focus = P.focus.filter((x) => x !== d.unisolate);
      this._applyScope();
    } else if (d.unmask) {
      P.masked = P.masked.filter((x) => x !== d.unmask);
      this._applyScope();
    } else if (target.hasAttribute("data-showall")) {
      P.focus = [];
      P.masked = [];
      this._applyScope();
    } else if (d.go) {
      history.pushState(null, "", d.go);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
  }
}

if (!customElements.get("clan-panel")) customElements.define("clan-panel", ClanPanel);
