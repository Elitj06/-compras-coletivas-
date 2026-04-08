/* ============================================================
 * Compras Coletivas Vida Forte — Frontend
 * --------------------------------------------------------------
 * Arquitetura modular dentro de um único objeto `app`:
 *   - state         → fonte única da verdade
 *   - api           → comunicação com /api/db
 *   - icons         → SVGs reutilizáveis (sem emojis)
 *   - format        → utilidades de formatação BR
 *   - groups        → integração com taxonomia (groups.js)
 *   - render*       → funções puras de UI (separadas por seção)
 *   - handlers      → reações a eventos do usuário
 * ============================================================ */

const API_BASE = "/api/db";

/* ----------------------- Utilidades ------------------------ */
const fmt = {
  brl: (n) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(n) || 0),
  initials: (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
  },
  escape: (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    ),
};

/* ----------------------- Ícones SVG ------------------------ */
// Centralizado para facilitar manutenção e padronização visual.
const ICONS = {
  dumbbell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  bolt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  fish:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/></svg>',
  pill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
  flame:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  wheat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/></svg>',
  leaf:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.4 18.2 18.2 0 0 1-2.6 14.6C16 21 13 22 11 20"/><path d="M2 22a10 10 0 0 1 9-10"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  cookie:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>',
  stethoscope:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>',
  sprout:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
  package:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  receipt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
  user:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  box:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m7.5 4.21 9 5.19"/><path d="m7.5 19.79 0-9.58"/><path d="m21 7.5-9 5.19"/><path d="M12 22V12"/><path d="m3 7.5 9 5.19"/></svg>',
  cart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
  dollar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  tag:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
};

const icon = (name, attrs = "") => {
  const svg = ICONS[name] || ICONS.package;
  return svg.replace("<svg ", `<svg ${attrs} `);
};

/* ====================== App ====================== */
const app = {
  // ---------- state ----------
  state: {
    cart: {},
    discounts: {},
    faixasDesconto: [],
    currentGroup: "todos",
    sortBy: "nome",
    page: 1,
    perPage: 24,
    isAdminLoggedIn: false,
    isRegistered: false,
    user: { name: "", phone: "", email: "" },
    useServer: true,
  },

  /* ----------------- Bootstrap ----------------- */
  async init() {
    this.loadLocal();
    this.checkRegistration();
    this.bindEvents();
    this.renderHeaderUser();
    this.renderGroupGrid();
    this.renderProducts();
    this.updateCartBar();
    await this.loadDiscountsFromServer();
    await this.loadFaixasFromServer();
  },

  bindEvents() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", (e) =>
        this.switchTab(e.currentTarget.dataset.tab)
      )
    );
    let st;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      clearTimeout(st);
      st = setTimeout(() => {
        this.state.page = 1;
        this.renderProducts();
      }, 150);
    });
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      this.state.sortBy = e.target.value;
      this.renderProducts();
    });
  },

  /* ----------------- API ----------------- */
  async api(path, method = "GET", body = null) {
    try {
      const opts = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}/${path}`, opts);
      return await res.json();
    } catch (e) {
      console.warn("API offline:", e.message);
      this.state.useServer = false;
      return null;
    }
  },

  async loadDiscountsFromServer() {
    const res = await this.api("descontos");
    if (res && res.success && res.data) {
      this.state.discounts = {};
      res.data.forEach((d) => {
        this.state.discounts[d.categoria] = parseFloat(d.percentual);
      });
      this.renderProducts();
      this.updateCartBar();
    }
  },

  async loadFaixasFromServer() {
    const res = await this.api("faixas-desconto");
    if (res && res.success && res.data) {
      this.state.faixasDesconto = res.data;
      this.updateCartBar();
    }
  },

  /* ----------------- Cadastro ----------------- */
  checkRegistration() {
    const reg = localStorage.getItem("userRegistered");
    if (reg === "true") {
      this.state.isRegistered = true;
      this.state.user.name = localStorage.getItem("registeredName") || "";
      this.state.user.phone = localStorage.getItem("registeredPhone") || "";
      this.state.user.email = localStorage.getItem("currentEmail") || "";
    }
  },

  requireRegistration() {
    if (!this.state.isRegistered) {
      this.showRegistrationModal();
      return false;
    }
    return true;
  },

  showRegistrationModal() {
    const existing = document.getElementById("registrationModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "registrationModal";
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-header-icon">${icon("user")}</div>
            <h2>Identifique-se para comprar</h2>
            <p>Precisamos do seu nome e contato para incluir você na compra coletiva.</p>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="regName">Nome completo</label>
              <input type="text" id="regName" placeholder="Nome e sobrenome" />
              <small>Informe ao menos nome e sobrenome.</small>
            </div>
            <div class="form-group">
              <label for="regPhone">Telefone / WhatsApp</label>
              <input type="tel" id="regPhone" placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary btn-block" onclick="app.submitRegistration()">Confirmar cadastro</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById("regName")?.focus(), 50);
    document.getElementById("regName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitRegistration();
    });
    document.getElementById("regPhone").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitRegistration();
    });
  },

  submitRegistration() {
    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    if (!name || name.split(/\s+/).length < 2) {
      this.toast("Digite nome e sobrenome", "error");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      this.toast("Telefone inválido", "error");
      return;
    }
    this.state.user.name = name;
    this.state.user.phone = phone;
    this.state.isRegistered = true;
    localStorage.setItem("userRegistered", "true");
    localStorage.setItem("registeredName", name);
    localStorage.setItem("registeredPhone", phone);
    document.getElementById("registrationModal")?.remove();
    this.renderHeaderUser();
    this.toast("Cadastro confirmado", "success");
    this.updateCartBar();
  },

  /* ----------------- Header user ----------------- */
  renderHeaderUser() {
    const wrap = document.getElementById("headerUser");
    if (!wrap) return;
    if (!this.state.isRegistered) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    document.getElementById("headerUserAvatar").textContent = fmt.initials(
      this.state.user.name
    );
    document.getElementById("headerUserName").textContent =
      this.state.user.name;
  },

  /* ----------------- Tabs ----------------- */
  switchTab(tab) {
    document
      .querySelectorAll(".tab")
      .forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.add("hidden"));
    document.getElementById(`tab-${tab}`)?.classList.remove("hidden");
    if (tab === "meu-pedido") this.renderInvoice();
    else if (tab === "admin" && this.state.isAdminLoggedIn) this.renderAdmin();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  /* ----------------- Descontos ----------------- */
  getDiscount(catId) {
    if (this.state.discounts["todos"] > 0) return this.state.discounts["todos"];
    return this.state.discounts[catId] || 0;
  },
  getDiscountedPrice(preco, catId) {
    const pct = this.getDiscount(catId);
    return pct > 0 ? preco * (1 - pct / 100) : preco;
  },
  calcFaixaProgressiva(totalBruto) {
    if (!totalBruto || !this.state.faixasDesconto.length) return 0;
    const faixa = this.state.faixasDesconto
      .filter((f) => f.ativo)
      .find(
        (f) =>
          totalBruto >= f.valor_minimo &&
          (f.valor_maximo === null || totalBruto < f.valor_maximo)
      );
    return faixa ? parseFloat(faixa.percentual) : 0;
  },

  /* ----------------- Filtragem por grupo ----------------- */
  getFilteredProducts() {
    const search = document
      .getElementById("searchInput")
      ?.value.trim()
      .toLowerCase();
    let list = PRODUTOS.filter((p) => {
      const matchesSearch =
        !search ||
        p.nome.toLowerCase().includes(search) ||
        p.codigo.toLowerCase().includes(search);
      const matchesGroup =
        this.state.currentGroup === "todos" ||
        getProductGroup(p) === this.state.currentGroup;
      return matchesSearch && matchesGroup;
    });

    switch (this.state.sortBy) {
      case "preco_asc":
        list.sort((a, b) => a.preco - b.preco);
        break;
      case "preco_desc":
        list.sort((a, b) => b.preco - a.preco);
        break;
      case "codigo":
        list.sort((a, b) => a.codigo.localeCompare(b.codigo));
        break;
      default:
        list.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return list;
  },

  /* ----------------- Render: Group grid ----------------- */
  renderGroupGrid() {
    const grid = document.getElementById("groupGrid");
    if (!grid) return;
    const groups = getGroupsWithCounts(PRODUTOS);

    const allCard = `
      <button class="group-card ${
        this.state.currentGroup === "todos" ? "active" : ""
      }" onclick="app.selectGroup('todos')">
        <span class="group-icon">${icon("box")}</span>
        <span class="group-name">Todos os produtos</span>
        <span class="group-desc">Catálogo completo</span>
        <span class="group-count">${PRODUTOS.length} itens</span>
      </button>`;

    const cards = groups
      .map(
        (g) => `
      <button class="group-card ${
        this.state.currentGroup === g.id ? "active" : ""
      }" onclick="app.selectGroup('${g.id}')">
        <span class="group-icon">${icon(g.icon)}</span>
        <span class="group-name">${fmt.escape(g.nome)}</span>
        <span class="group-desc">${fmt.escape(g.descricao)}</span>
        <span class="group-count">${g.count} itens</span>
      </button>`
      )
      .join("");

    grid.innerHTML = allCard + cards;
  },

  selectGroup(id) {
    this.state.currentGroup = id;
    this.state.page = 1;
    this.renderGroupGrid();
    this.renderProducts();
    document
      .getElementById("productsGrid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  /* ----------------- Render: Products ----------------- */
  renderProducts() {
    const grid = document.getElementById("productsGrid");
    const countEl = document.getElementById("searchCount");
    const filtered = this.getFilteredProducts();
    const total = filtered.length;
    if (countEl)
      countEl.textContent = `${total} produto${total !== 1 ? "s" : ""}`;

    if (!total) {
      grid.innerHTML = `
        <div class="empty-state">
          ${icon("search")}
          <h3>Nenhum produto encontrado</h3>
          <p>Tente outra busca ou selecione outro grupo.</p>
        </div>`;
      document.getElementById("pagination").innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(total / this.state.perPage);
    if (this.state.page > totalPages) this.state.page = 1;
    const start = (this.state.page - 1) * this.state.perPage;
    const items = filtered.slice(start, start + this.state.perPage);

    grid.innerHTML = items.map((p) => this.renderProductCard(p)).join("");
    this.renderPagination(totalPages);
  },

  renderProductCard(p) {
    const qty = this.state.cart[p.codigo] || 0;
    const disc = this.getDiscount(p.categoria);
    const dp = this.getDiscountedPrice(p.preco, p.categoria);
    const hasDisc = disc > 0;
    const hasImg = p.imagem && p.imagem.length > 100;

    const imgHtml = hasImg
      ? `<img src="${p.imagem}" alt="${fmt.escape(p.nome)}" loading="lazy" />`
      : `<div class="product-img-placeholder">
           ${icon("package")}
           <span class="ph-code">${fmt.escape(p.codigo)}</span>
         </div>`;

    const priceHtml = hasDisc
      ? `<span class="price-original">${fmt.brl(p.preco)}</span>
         <span class="price-main">${fmt.brl(dp)}</span>
         <span class="discount-tag">-${disc}%</span>`
      : `<span class="price-main">${fmt.brl(p.preco)}</span>`;

    return `
      <div class="product-card ${qty > 0 ? "has-qty" : ""}">
        <div class="product-img-wrap">${imgHtml}</div>
        <div class="product-body">
          <div class="product-meta">
            <span class="product-code">${fmt.escape(p.codigo)}</span>
            <span class="product-emb">Cx: ${p.embalagem}</span>
          </div>
          <div class="product-name" title="${fmt.escape(p.nome)}">${fmt.escape(
      p.nome
    )}</div>
          <div class="product-prices">${priceHtml}</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="app.updateQty('${p.codigo}',-1)">−</button>
            <input type="number" class="qty-input" value="${qty}" min="0"
              onchange="app.setQty('${p.codigo}',this.value)" />
            <button class="qty-btn" onclick="app.updateQty('${p.codigo}',1)">+</button>
          </div>
        </div>
      </div>`;
  },

  renderPagination(totalPages) {
    const pag = document.getElementById("pagination");
    if (!pag) return;
    if (totalPages <= 1) {
      pag.innerHTML = "";
      return;
    }
    const current = this.state.page;
    let html = `<button class="page-btn" onclick="app.goToPage(${
      current - 1
    })" ${current === 1 ? "disabled" : ""}>‹</button>`;
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);
    if (start > 1) {
      html += `<button class="page-btn" onclick="app.goToPage(1)">1</button>`;
      if (start > 2) html += `<span class="page-info">…</span>`;
    }
    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${
        i === current ? "active" : ""
      }" onclick="app.goToPage(${i})">${i}</button>`;
    }
    if (end < totalPages) {
      if (end < totalPages - 1) html += `<span class="page-info">…</span>`;
      html += `<button class="page-btn" onclick="app.goToPage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="page-btn" onclick="app.goToPage(${
      current + 1
    })" ${current === totalPages ? "disabled" : ""}>›</button>`;
    pag.innerHTML = html;
  },

  goToPage(p) {
    this.state.page = p;
    this.renderProducts();
    document
      .getElementById("productsGrid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  /* ----------------- Cart ops ----------------- */
  updateQty(cod, delta) {
    if (!this.requireRegistration()) return;
    const newQty = Math.max(0, (this.state.cart[cod] || 0) + delta);
    if (newQty === 0) delete this.state.cart[cod];
    else this.state.cart[cod] = newQty;
    if (delta > 0 && newQty === 1) {
      const p = PRODUTOS.find((x) => x.codigo === cod);
      if (p) this.toast(`${p.nome} adicionado`, "success");
    }
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
  },

  setQty(cod, v) {
    if (!this.requireRegistration()) return;
    const q = parseInt(v) || 0;
    if (q <= 0) delete this.state.cart[cod];
    else this.state.cart[cod] = q;
    this.saveLocal();
    this.updateCartBar();
  },

  removeFromCart(cod) {
    delete this.state.cart[cod];
    this.saveLocal();
    this.renderInvoice();
    this.renderProducts();
    this.updateCartBar();
  },

  calcTotals() {
    let bruto = 0;
    let comDescCategoria = 0;
    let descontoCategoriaTotal = 0;
    for (const [cod, qty] of Object.entries(this.state.cart)) {
      const p = PRODUTOS.find((x) => x.codigo === cod);
      if (!p) continue;
      const sub = p.preco * qty;
      const subD = this.getDiscountedPrice(p.preco, p.categoria) * qty;
      bruto += sub;
      comDescCategoria += subD;
      descontoCategoriaTotal += sub - subD;
    }
    const faixaPct = this.calcFaixaProgressiva(bruto);
    let total = comDescCategoria;
    let descontoFaixa = 0;
    if (faixaPct > 0) {
      // A faixa sobrepõe o desconto por categoria (mais vantajoso)
      const totalComFaixa = bruto * (1 - faixaPct / 100);
      if (totalComFaixa < comDescCategoria) {
        descontoFaixa = bruto - totalComFaixa - descontoCategoriaTotal;
        total = totalComFaixa;
      }
    }
    return {
      bruto,
      total,
      descontoCategoriaTotal,
      descontoFaixa,
      faixaPct,
      economia: bruto - total,
    };
  },

  /* ----------------- Cart bar ----------------- */
  updateCartBar() {
    const items = Object.values(this.state.cart).reduce((a, b) => a + b, 0);
    const distinct = Object.keys(this.state.cart).length;
    const t = this.calcTotals();
    const bar = document.getElementById("cartBar");
    bar?.classList.toggle("empty", distinct === 0);

    document.getElementById("cartCount").textContent = items;
    document.getElementById("cartTotal").textContent = fmt.brl(t.bruto);
    const td = document.getElementById("cartTotalDisc");
    if (t.economia > 0) {
      td.textContent = `Você economiza ${fmt.brl(t.economia)} → ${fmt.brl(
        t.total
      )}`;
    } else {
      td.textContent = "";
    }

    const badge = document.getElementById("tabCartBadge");
    if (badge) {
      badge.hidden = distinct === 0;
      badge.textContent = distinct;
    }
  },

  /* ----------------- INVOICE (Meu Pedido) ----------------- */
  renderInvoice() {
    const c = document.getElementById("myCartContent");
    const items = Object.entries(this.state.cart);
    if (!items.length) {
      c.innerHTML = `
        <div class="card">
          <div class="empty-state">
            ${icon("cart")}
            <h3>Sua fatura está vazia</h3>
            <p>Volte para a aba <strong>Produtos</strong> e adicione os itens da sua compra.</p>
          </div>
        </div>`;
      return;
    }

    const t = this.calcTotals();
    const buyer = this.state.isRegistered
      ? `<div class="invoice-buyer">
          <div class="invoice-buyer-avatar">${fmt.initials(
            this.state.user.name
          )}</div>
          <div class="invoice-buyer-info">
            <strong>${fmt.escape(this.state.user.name)}</strong>
            <small>${fmt.escape(this.state.user.phone)}${
          this.state.user.email ? " · " + fmt.escape(this.state.user.email) : ""
        }</small>
          </div>
        </div>`
      : "";

    const rows = items
      .map(([cod, qty]) => {
        const p = PRODUTOS.find((x) => x.codigo === cod);
        if (!p) return "";
        const disc = this.getDiscount(p.categoria);
        const sub = p.preco * qty;
        const subD = this.getDiscountedPrice(p.preco, p.categoria) * qty;
        const subPriceHtml =
          disc > 0
            ? `<span class="invoice-strike">${fmt.brl(sub)}</span>
               <span class="invoice-final">${fmt.brl(subD)}</span>`
            : `<span class="invoice-final">${fmt.brl(sub)}</span>`;
        return `
        <tr>
          <td>
            <div class="invoice-product">
              <span class="invoice-product-name">${fmt.escape(p.nome)}</span>
              <span class="invoice-product-meta">${fmt.escape(
                p.codigo
              )} · ${fmt.brl(p.preco)} un.${
          disc > 0 ? ` · ${disc}% off` : ""
        }</span>
            </div>
          </td>
          <td>
            <div class="invoice-qty">
              <button onclick="app.updateQty('${cod}',-1)">−</button>
              <input type="number" value="${qty}" min="1"
                onchange="app.setQty('${cod}',this.value)" />
              <button onclick="app.updateQty('${cod}',1)">+</button>
            </div>
          </td>
          <td>${subPriceHtml}</td>
          <td>
            <button class="btn-icon-remove" onclick="app.removeFromCart('${cod}')" title="Remover">${icon(
          "trash"
        )}</button>
          </td>
        </tr>`;
      })
      .join("");

    c.innerHTML = `
      <div class="invoice-grid">
        <div>
          <div class="card">
            <h3 class="card-title">${icon("receipt")} Resumo do pedido</h3>
            ${buyer}
            <div style="overflow-x:auto">
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>

        <aside class="invoice-summary">
          <h3>Fatura</h3>
          <div class="summary-line">
            <span>Subtotal (${items.length} ${
      items.length === 1 ? "item" : "itens"
    })</span>
            <strong>${fmt.brl(t.bruto)}</strong>
          </div>
          ${
            t.descontoCategoriaTotal > 0
              ? `<div class="summary-line discount">
                <span>Desconto por categoria</span>
                <strong>− ${fmt.brl(t.descontoCategoriaTotal)}</strong>
              </div>`
              : ""
          }
          ${
            t.faixaPct > 0
              ? `<div class="summary-line tier">
                  ${icon("tag", 'style="width:16px;height:16px"')}
                  Faixa progressiva ativa: <strong>${t.faixaPct}%</strong> sobre o bruto
                </div>`
              : ""
          }
          <div class="summary-total">
            <span>Total</span>
            <strong>${fmt.brl(t.total)}</strong>
          </div>
          ${
            t.economia > 0
              ? `<div class="savings-pill">${icon(
                  "check"
                )} Você economiza ${fmt.brl(t.economia)}</div>`
              : ""
          }
          <div class="summary-actions">
            <button class="btn btn-primary btn-block" onclick="app.finalizeOrder()">Finalizar pedido</button>
            <button class="btn btn-ghost btn-block" onclick="app.switchTab('produtos')">Continuar comprando</button>
          </div>
        </aside>
      </div>`;
  },

  /* ----------------- Finalizar pedido ----------------- */
  async finalizeOrder() {
    if (!this.requireRegistration()) return;
    if (!Object.keys(this.state.cart).length) {
      this.toast("Carrinho vazio", "error");
      return;
    }
    const t = this.calcTotals();
    const msg = `Confirma o envio do pedido?\n\nBruto: ${fmt.brl(
      t.bruto
    )}\nTotal: ${fmt.brl(t.total)}\nEconomia: ${fmt.brl(t.economia)}`;
    if (!confirm(msg)) return;

    const itens = Object.entries(this.state.cart).map(([cod, qty]) => {
      const p = PRODUTOS.find((x) => x.codigo === cod);
      return {
        codigo: cod,
        nome: p?.nome || cod,
        quantidade: qty,
        preco_bruto: p?.preco || 0,
        preco_desconto: p
          ? this.getDiscountedPrice(p.preco, p.categoria)
          : 0,
        categoria: p?.categoria || "",
      };
    });

    const res = await this.api("pedidos", "POST", {
      usuario: this.state.user.name,
      telefone: this.state.user.phone,
      email: this.state.user.email,
      itens,
    });
    if (res && res.success) {
      this.toast("Pedido enviado com sucesso!", "success");
    } else {
      this.toast("Pedido salvo localmente", "info");
    }

    this.state.cart = {};
    this.saveLocal();
    this.updateCartBar();
    this.renderProducts();
    this.renderInvoice();
  },

  /* ----------------- Admin ----------------- */
  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(inputId + "Toggle");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    if (toggle) toggle.innerHTML = icon(showing ? "eye" : "eyeOff");
  },

  async loginAdmin() {
    const pwd = document.getElementById("adminPassword").value;
    const res = await this.api("admin/login", "POST", { senha: pwd });
    if (res && res.success) {
      this.state.isAdminLoggedIn = true;
      document.getElementById("adminLoginSection").classList.add("hidden");
      document.getElementById("adminContent").classList.remove("hidden");
      await this.renderAdmin();
      this.toast("Acesso liberado", "success");
    } else {
      this.toast("Senha incorreta", "error");
    }
  },

  async renderAdmin() {
    const c = document.getElementById("adminContent");
    c.innerHTML = `<div class="card"><div class="empty-state">${icon(
      "refresh"
    )}<h3>Carregando dados...</h3></div></div>`;

    const [statsRes, conRes, usersRes] = await Promise.all([
      this.api("stats"),
      this.api("pedidos/consolidado"),
      this.api("pedidos/por-usuario"),
    ]);

    const stats = statsRes?.data || {};
    const con = conRes?.data || [];
    const users = usersRes?.data || [];

    const statCard = (iconName, label, value) => `
      <div class="stat-card">
        <div class="stat-card-icon">${icon(iconName)}</div>
        <div class="stat-card-body">
          <small>${label}</small>
          <strong>${value}</strong>
        </div>
      </div>`;

    let html = `
      <div class="stats-grid">
        ${statCard("users", "Compradores", stats.total_compradores || 0)}
        ${statCard("box", "Produtos", stats.produtos_distintos || 0)}
        ${statCard("cart", "Unidades", stats.unidades_totais || 0)}
        ${statCard("dollar", "Valor bruto", fmt.brl(stats.valor_bruto_geral || 0))}
        ${statCard("tag", "Economia", fmt.brl(stats.economia_geral || 0))}
      </div>

      <div class="card discount-panel">
        <h3 class="card-title">${icon("tag")} Configurar descontos</h3>
        <div class="discount-row">
          <label>Categoria</label>
          <select id="discCatSelect">
            <option value="todos">Todas as categorias</option>
            ${(() => {
              const seen = new Set();
              return PRODUTOS.filter((p) => {
                if (seen.has(p.categoria)) return false;
                seen.add(p.categoria);
                return true;
              })
                .sort((a, b) => a.categoriaNome.localeCompare(b.categoriaNome))
                .map(
                  (p) =>
                    `<option value="${p.categoria}">${fmt.escape(
                      p.categoriaNome
                    )}</option>`
                )
                .join("");
            })()}
          </select>
        </div>
        <div class="discount-row">
          <label>Percentual</label>
          <input type="number" id="discPctInput" value="0" min="0" max="100" style="width:100px" />
          <button class="btn btn-primary btn-sm" onclick="app.applyDiscount()">Aplicar</button>
          <button class="btn btn-secondary btn-sm" onclick="app.clearDiscounts()">Limpar todos</button>
        </div>
      </div>

      <div class="admin-toolbar">
        <button class="btn btn-secondary" onclick="app.renderAdmin()">${icon(
          "refresh"
        )} Atualizar</button>
        <button class="btn btn-success" onclick="app.exportCSV()">${icon(
          "download"
        )} Exportar CSV</button>
        <button class="btn btn-danger" onclick="app.clearAllOrders()">${icon(
          "trash"
        )} Apagar pedidos</button>
      </div>

      <div class="card report-card" style="margin-bottom:16px">
        <div class="report-header">${icon("chart")} Consolidado por produto</div>
        ${this.renderConsolidatedTable(con)}
      </div>

      <div class="card report-card">
        <div class="report-header">${icon("users")} Pedidos por comprador</div>
        ${this.renderUsersTable(users)}
      </div>`;

    c.innerHTML = html;
  },

  renderConsolidatedTable(con) {
    if (!con.length)
      return `<div style="padding:24px;text-align:center;color:var(--c-text-muted)">Nenhum pedido registrado.</div>`;
    let tBruto = 0,
      tDesc = 0,
      tQtd = 0;
    const rows = con
      .map((i) => {
        const vb = parseFloat(i.total_bruto);
        const vd = parseFloat(i.total_final);
        tBruto += vb;
        tDesc += vd;
        tQtd += parseInt(i.quantidade_total);
        return `<tr>
          <td><strong>${fmt.escape(i.codigo)}</strong></td>
          <td>${fmt.escape(i.nome)}</td>
          <td>${i.quantidade_total}</td>
          <td>${fmt.brl(vb)}</td>
          <td>${fmt.brl(vd)}</td>
        </tr>`;
      })
      .join("");
    return `
      <table class="data-table">
        <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Final</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">TOTAL</td>
            <td>${tQtd}</td>
            <td>${fmt.brl(tBruto)}</td>
            <td>${fmt.brl(tDesc)}</td>
          </tr>
        </tbody>
      </table>`;
  },

  renderUsersTable(users) {
    if (!users.length)
      return `<div style="padding:24px;text-align:center;color:var(--c-text-muted)">Nenhum pedido registrado.</div>`;
    return users
      .map((u) => {
        const contato = [u.telefone, u.email].filter(Boolean).join(" · ");
        const itens = (u.itens || [])
          .map(
            (it) =>
              `<tr>
                <td>${fmt.escape(it.codigo)}</td>
                <td>${fmt.escape(it.nome)}</td>
                <td>${it.quantidade}</td>
                <td>${fmt.brl(it.preco_bruto * it.quantidade)}</td>
                <td>${fmt.brl(it.preco_desconto * it.quantidade)}</td>
              </tr>`
          )
          .join("");
        return `
          <div class="user-section-header">
            ${icon("user")} ${fmt.escape(u.usuario)}
            ${contato ? `<small style="font-weight:400;color:var(--c-text-muted)">— ${fmt.escape(contato)}</small>` : ""}
          </div>
          <table class="data-table">
            <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Final</th></tr></thead>
            <tbody>${itens}</tbody>
          </table>
          <div class="user-total-row">
            ${u.total_itens} itens · Bruto: <strong>${fmt.brl(
          u.total_bruto
        )}</strong> · Final: <strong>${fmt.brl(u.total_desconto)}</strong>
          </div>`;
      })
      .join("");
  },

  async applyDiscount() {
    const cat = document.getElementById("discCatSelect").value;
    const pct = parseFloat(document.getElementById("discPctInput").value) || 0;
    this.state.discounts[cat] = pct;
    await this.api("descontos", "POST", { categoria: cat, percentual: pct });
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
    this.renderAdmin();
    this.toast(`Desconto de ${pct}% aplicado`, "success");
  },

  async clearDiscounts() {
    this.state.discounts = {};
    await this.api("descontos", "DELETE");
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
    this.renderAdmin();
    this.toast("Descontos removidos", "success");
  },

  async clearAllOrders() {
    if (!confirm("Apagar TODOS os pedidos?")) return;
    if (!confirm("Confirmação final — esta ação é irreversível.")) return;
    await this.api("pedidos", "DELETE");
    this.renderAdmin();
    this.toast("Pedidos apagados", "info");
  },

  async exportCSV() {
    const conRes = await this.api("pedidos/consolidado");
    const usersRes = await this.api("pedidos/por-usuario");
    const con = conRes?.data || [];
    const users = usersRes?.data || [];
    let csv = "\uFEFFCOMPRAS COLETIVAS — VIDA FORTE\n";
    csv += `Exportado em: ${new Date().toLocaleDateString("pt-BR")}\n\n`;
    csv += "CONSOLIDADO\nCódigo;Produto;Qtd;Bruto;Final\n";
    con.forEach((i) => {
      csv += `${i.codigo};"${i.nome}";${i.quantidade_total};${parseFloat(
        i.total_bruto
      )
        .toFixed(2)
        .replace(".", ",")};${parseFloat(i.total_final).toFixed(2).replace(".", ",")}\n`;
    });
    csv += "\nPOR COMPRADOR\n";
    users.forEach((u) => {
      csv += `\n${u.usuario}\nCódigo;Produto;Qtd;Bruto;Final\n`;
      (u.itens || []).forEach((it) => {
        csv += `${it.codigo};"${it.nome}";${it.quantidade};${(it.preco_bruto * it.quantidade)
          .toFixed(2)
          .replace(".", ",")};${(it.preco_desconto * it.quantidade)
          .toFixed(2)
          .replace(".", ",")}\n`;
      });
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `compras_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    this.toast("CSV exportado", "success");
  },

  /* ----------------- Toast ----------------- */
  toast(msg, type = "success") {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    const ic =
      type === "success" ? "check" : type === "error" ? "alert" : "tag";
    t.innerHTML = `${icon(ic)}<span>${fmt.escape(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  /* ----------------- LocalStorage ----------------- */
  saveLocal() {
    localStorage.setItem("cart", JSON.stringify(this.state.cart));
    localStorage.setItem("discounts", JSON.stringify(this.state.discounts));
  },
  loadLocal() {
    try {
      const c = localStorage.getItem("cart");
      const d = localStorage.getItem("discounts");
      if (c) this.state.cart = JSON.parse(c);
      if (d) this.state.discounts = JSON.parse(d);
    } catch (e) {
      this.state.cart = {};
      this.state.discounts = {};
    }
  },
};

window.addEventListener("DOMContentLoaded", () => app.init());
