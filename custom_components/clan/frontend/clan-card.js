// Lovelace card: the household's phones, their last activity and last notification. Admin only, like the panel.

const V = new URL(import.meta.url).search;
const { texts, esc, ago } = await import(`./clan-texts.js${V}`);
const { ICONS } = await import(`./clan-icons.js${V}`);

// reload the data every five minutes while the card is shown
const REFRESH_MS = 5 * 60 * 1000;

const STYLES = `
  ha-card { overflow: hidden; }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px; }
  .head h1 { margin: 0; font-size: 20px; font-weight: 400; color: var(--ha-card-header-color, var(--primary-text-color)); }
  .head a { color: var(--primary-color); cursor: pointer; font-size: 14px; text-decoration: none; }
  .rows { padding: 0 16px 8px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--divider-color); }
  .main, .side { min-width: 0; }
  .main { flex: 1; }
  .side { text-align: right; flex: none; max-width: 40%; }
  .name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dormant { opacity: .55; font-style: italic; }
  ha-icon { --mdc-icon-size: 16px; vertical-align: -2px; }
  .warn { color: var(--warning-color, #ffa600); }
  .error { color: var(--error-color, #db4437); }
  .status { padding: 16px; color: var(--secondary-text-color); }
  svg { display: block; flex: none; }
`;

function icon(path, color) {
  return `<svg viewBox="0 0 24 24" width="24" height="24"><path d="${path}" fill="${color}"/></svg>`;
}

class ClanCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = config || {};
    if (this._data) this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this.T = texts(hass);
    if (first) this._load();
  }

  connectedCallback() {
    this._timer = setInterval(() => this._load(), REFRESH_MS);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() {
    return 2 + Math.ceil((this._rows?.length || 3) / 2);
  }

  async _load() {
    if (!this._hass) return;
    try {
      this._data = await this._hass.callWS({ type: "clan/graph" });
      this._error = null;
    } catch (err) {
      this._error =
        err?.code === "unauthorized" ? this.T.card_admin_only : `${this.T.load_failed}: ${err?.message || err}`;
    }
    this._render();
  }

  _phones() {
    const nodes = new Map(this._data.nodes.map((n) => [n.id, n]));
    const owner = new Map();
    for (const e of this._data.edges) if (e.type === "registered") owner.set(e.to, nodes.get(e.from)?.name || "");
    const showDormant = this._config.show_dormant !== false;
    return this._data.nodes
      .filter((n) => n.type === "device" && n.flags.includes("app"))
      .filter((n) => showDormant || !n.flags.includes("dormant"))
      .map((n) => ({ n, owner: owner.get(n.id) || "" }))
      .sort((a, b) => a.owner.localeCompare(b.owner) || a.n.name.localeCompare(b.n.name));
  }

  _render() {
    const T = this.T;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const title = this._config.title ?? T.phones_title;
    const head = `<div class="head"><h1>${esc(title)}</h1><a data-open>${esc(T.open_clan)} ›</a></div>`;
    let body;
    if (this._error) {
      body = `<div class="status">${esc(this._error)}</div>`;
    } else if (!this._data) {
      body = `<div class="status">${esc(T.loading)}</div>`;
    } else {
      const now = Date.now();
      this._rows = this._phones();
      // one row per device: name and account, last activity below; last notification on the right
      const rows = this._rows.map(({ n, owner }) => {
        const info = n.info || {};
        const dormant = n.flags.includes("dormant");
        const seen = info.silent ? T.since_start : info.last_seen ? ago(info.last_seen, now, T.lang, T) : T.never;
        const notified = info.notified ? ago(info.notified.at, now, T.lang, T) : "-";
        const mark = n.status === "ok" ? "" : ` <ha-icon class="${n.status}" icon="mdi:alert"></ha-icon>`;
        const color = dormant ? "#9e9e9e" : "#8e24aa";
        const who = [owner, dormant ? T.flag_dormant : seen].filter(Boolean).join(" · ");
        return `<div class="row${dormant ? " dormant" : ""}">${icon(ICONS[n.kind] || ICONS.device, color)}
          <div class="main"><div class="name">${esc(n.name)}${mark}</div><div class="sub">${esc(who)}</div></div>
          <div class="side"><div class="name">${esc(notified)}</div><div class="sub">${esc(T.card_notified)}</div></div></div>`;
      });
      body = rows.length ? `<div class="rows">${rows.join("")}</div>` : `<div class="status">${esc(T.no_phones)}</div>`;
    }
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card>${head}${body}</ha-card>`;
    this.shadowRoot.querySelector("[data-open]").addEventListener("click", () => {
      history.pushState(null, "", "/clan");
      window.dispatchEvent(new CustomEvent("location-changed"));
    });
  }
}

if (!customElements.get("clan-card")) {
  customElements.define("clan-card", ClanCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "clan-card",
    name: "Clan",
    description: "The household's phones: last activity and last notification. For administrators.",
  });
}
