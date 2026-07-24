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
 *
 * Regras de negócio:
 *  - Desconto é um percentual global progressivo, calculado pelo ciclo ativo.
 *  - Cards do catálogo mostram apenas o preço cheio (sem desconto).
 *  - No carrinho/fatura o comprador vê preço cheio + preço com desconto.
 *  - Cadastro (nome + telefone) é obrigatório na entrada do app.
 *  - Tema claro/escuro alternável via botão no header.
 * ============================================================ */

const API_BASE = "/api/db";
function csrfToken(scope) {
  const prefix = `__Host-cc-${scope}-csrf=`;
  return document.cookie.split("; ").find((entry) => entry.startsWith(prefix))?.slice(prefix.length) || "";
}

/* ----------------------- Confirm modal customizado --------- */
function customConfirm(msg) {
  return new Promise((resolve) => {
    const wrap = document.getElementById("confirmModalWrap");
    const lines = msg.split("\n").filter(Boolean).map(l => `<p style="margin:4px 0">${l.replace(/</g,"&lt;")}</p>`).join("");
    wrap.innerHTML = `
      <div class="modal-overlay" id="confirmModalOverlay">
        <div class="modal-content" style="max-width:380px">
          <div class="modal-header" style="padding:20px 24px 8px">
            <h2 style="font-size:1.1rem">Confirmação</h2>
          </div>
          <div class="modal-body" style="padding:8px 24px 16px;font-size:0.92rem;line-height:1.5">${lines}</div>
          <div class="modal-footer" style="padding:8px 24px 20px">
            <button class="btn btn-ghost" id="confirmNo">Cancelar</button>
            <button class="btn btn-primary" id="confirmYes">Confirmar</button>
          </div>
        </div>
      </div>`;
    const close = (val) => { wrap.innerHTML = ""; resolve(val); };
    document.getElementById("confirmYes").addEventListener("click", () => close(true));
    document.getElementById("confirmNo").addEventListener("click", () => close(false));
    document.getElementById("confirmModalOverlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) close(false);
    });
  });
}

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
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  minus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
};

const icon = (name, attrs = "") => {
  const svg = ICONS[name] || ICONS.package;
  return svg.replace("<svg ", `<svg ${attrs} `);
};

const PRODUTO_INDEX = Object.fromEntries(
  (typeof PRODUTOS !== "undefined" ? PRODUTOS : []).map((produto) => [produto.codigo, produto])
);

/* ====================== App ====================== */
const app = {
  state: {
    cart: {},
    discountPct: 0, // percentual global vigente no ciclo coletivo
    discountProgress: null,
    currentGroup: "todos",
    sortBy: "nome",
    page: 1,
    perPage: 24,
    isAdminLoggedIn: false,
    isRegistered: false,
    user: { name: "", phone: "", email: "" },
    adminCycleId: null,
    adminCycleIsActive: true,
    useServer: true,
    theme: "light", // 'light' | 'dark'
    // Variante atualmente selecionada em cada grupo (grupoId -> codigo)
    variantSelection: {},
    lastOrder: null,
    editingPedido: null,
    orphanPedidos: [],
    _editCheckDone: false,
  },

  /* ----------------- Bootstrap ----------------- */
  async init() {
    this.loadLocal();
    this.applyTheme();
    this.checkRegistration();
    this.bindEvents();
    this.renderHeaderUser();
    this.renderGroupGrid();
    this.renderProducts();
    this.updateCartBar();
    await this.loadDiscountProgress();
    this._discountPollTimer = setInterval(() => {
      if (!document.hidden) this.loadDiscountProgress();
    }, 30000);
    await this.restoreSessions();
    // Restaura estado admin se estava logado
    if (this.state.isAdminLoggedIn) {
      const tabAdmin = document.getElementById("tabAdmin");
      if (tabAdmin) tabAdmin.hidden = false;
      document.getElementById("adminLoginSection")?.classList.add("hidden");
      document.getElementById("adminContent")?.classList.remove("hidden");
      this.switchTab("admin");
    }
    // Cadastro obrigatório logo na entrada
    const recoveryLink = new URLSearchParams(location.search).has("recover");
    if (!this.hasAppAccess() && !recoveryLink) {
      this.showRegistrationModal(true, "login");
    } else {
      // Detecta pedidos órfãos do banco para limpar histórico
      this.cleanupOrphanPedidos();
      // Pré-carrega pedido do servidor se não tem lastOrder local
      // (para quem acessa de outro dispositivo ou limpou o navegador)
      if (!this.state.lastOrder && !Object.keys(this.state.cart).length) {
        this.loadServerOrder().then(loaded => {
          if (loaded) {
            // Atualiza a tab Meu Pedido se estiver visível
            const tab = document.getElementById("tab-meu-pedido");
            if (tab && !tab.classList.contains("hidden")) {
              this.renderInvoice();
            }
          }
        });
      }
    }
  },

  bindEvents() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", (e) =>
        this.switchTab(e.currentTarget.dataset.tab)
      )
    );
    let st;
    document.getElementById("searchInput").addEventListener("input", () => {
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
    document.getElementById("themeToggle")?.addEventListener("click", () => {
      this.toggleTheme();
    });
  },

  /* ----------------- Tema ----------------- */
  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.state.theme);
  },
  toggleTheme() {
    this.state.theme = this.state.theme === "dark" ? "light" : "dark";
    this.applyTheme();
    localStorage.setItem("theme", this.state.theme);
  },

  /* ----------------- Lightbox ----------------- */
  openLightbox(src, alt) {
    let lb = document.getElementById("imgLightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "imgLightbox";
      lb.className = "img-lightbox";
      lb.innerHTML = `<div class="img-lightbox-backdrop" onclick="app.closeLightbox()"></div>
        <div class="img-lightbox-content">
          <button class="img-lightbox-close" onclick="app.closeLightbox()" aria-label="Fechar">×</button>
          <img id="imgLightboxImg" alt="" />
        </div>`;
      document.body.appendChild(lb);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.closeLightbox();
      });
    }
    const img = document.getElementById("imgLightboxImg");
    img.src = src;
    img.alt = alt || "";
    lb.classList.add("open");
  },
  closeLightbox() {
    const lb = document.getElementById("imgLightbox");
    if (lb) lb.classList.remove("open");
  },

  /* ----------------- API ----------------- */
  async api(path, method = "GET", body = null, authScope = null) {
    try {
      const isBuyerRoute =
        path === "comprador/session" ||
        path === "comprador/pin" ||
        path === "comprador/perfil" ||
        path === "comprador/logout" ||
        path === "pedidos/historico" ||
        (path === "pedidos" && method === "POST") ||
        (/^pedidos\/\d+$/.test(path) && method === "DELETE");
      const scope = authScope === "admin" ? "admin" : (isBuyerRoute ? "buyer" : "admin");
      const opts = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(["POST", "PUT", "DELETE"].includes(method)
            ? { "X-CSRF-Token": csrfToken(scope), "X-Session-Scope": scope }
            : {}),
        },
        credentials: "same-origin",
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}/${path}`, opts);
      if (res.status === 204) return { success: true };
      const data = await res.json();
      if (res.status === 401) {
        if (path.startsWith("admin/") || path.startsWith("pagamentos") || path.startsWith("pedidos/por-usuario") || path.startsWith("pedidos/consolidado") || path.startsWith("stats") || path.startsWith("compradores") || path.startsWith("descontos")) {
          this.clearAdminSession();
        }
        if (path.includes("historico") || path === "pedidos") {
          this.clearBuyerSession(false);
        }
      }
      return data;
    } catch (e) {
      console.warn("API offline:", e.message);
      this.state.useServer = false;
      return null;
    }
  },

  async restoreSessions() {
    const adminSession = await this.api("admin/session");
    if (adminSession?.success) {
      this.state.isAdminLoggedIn = true;
      const linkedBuyer = adminSession.data?.comprador;
      if (linkedBuyer) {
        this._saveUserSession(
          linkedBuyer.nome,
          linkedBuyer.telefone || "",
          linkedBuyer.email || "",
          "",
          { announce: false, refreshHistory: false },
        );
      }
    } else {
      this.clearAdminSession();
    }
    const buyerSession = await this.api("comprador/session");
    if (buyerSession?.success) {
      this.state.isRegistered = true;
      this.state.user.name = buyerSession.data.nome || this.state.user.name;
      this.state.user.phone = buyerSession.data.telefone || this.state.user.phone;
      this.state.user.email = buyerSession.data.email || this.state.user.email;
    } else if (!this.state.isAdminLoggedIn) {
      this.clearBuyerSession(false);
    }
  },

  /** Carrega o agregado público do ciclo e atualiza o desconto de todos. */
  async loadDiscountProgress(useAdminCycle = false) {
    // NOTE: When admin is viewing a specific cycle, pass ciclo_id so the
    // discount progress matches the selected cycle instead of the active one.
    const cicloParam = (useAdminCycle && this.state.adminCycleId)
      ? `?ciclo_id=${this.state.adminCycleId}`
      : '';
    const res = await this.api(`desconto-progresso${cicloParam}`);
    if (!res?.success || !res.data) return;
    this.state.discountProgress = res.data;
    this.state.discountPct = Number(res.data.percentual_atual) || 0;
    this.renderDiscountProgress();
    this.updateCartBar();
    if (
      document.getElementById("tab-meu-pedido") &&
      !document.getElementById("tab-meu-pedido").classList.contains("hidden")
    ) {
      this.renderInvoice();
    }
  },

  /** Mantém compatibilidade com chamadas antigas do painel. */
  async loadDiscountFromServer() {
    return this.loadDiscountProgress();
  },

  /** Renderiza a barra global acima das abas do comprador. */
  renderDiscountProgress() {
    const container = document.getElementById("discountProgress");
    const progress = this.state.discountProgress;
    if (!container || !progress) {
      if (container) container.hidden = true;
      return;
    }

    const currentPct = Number(progress.percentual_atual) || 0;
    const next = progress.proxima_faixa;
    const current = progress.faixa_atual;
    const total = Number(progress.total_final ?? progress.total_bruto) || 0;
    const progressPct = Math.min(100, Math.max(0, Number(progress.progresso_percentual) || 0));
    const title = currentPct > 0
      ? `${currentPct}% de desconto coletivo ativo`
      : "Desconto coletivo em construção";
    const detail = progress.maximo_alcancado
      ? "A maior faixa de desconto já foi alcançada para todos os compradores."
      : next
        ? `Faltam ${fmt.brl(progress.valor_faltante)} para liberar ${next.percentual}% de desconto para todos.`
        : "Assim que a próxima faixa for alcançada, o desconto será aplicado a todos.";
    const tierMarkers = (progress.faixas || []).map((tier) => {
      const reached = total >= Number(tier.valor_minimo);
      return `<span class="discount-progress-tier ${reached ? "is-reached" : ""}">
        <span>${Number(tier.percentual) || 0}%</span> · ${fmt.brl(tier.valor_minimo)}
      </span>`;
    }).join("");

    container.hidden = false;
    container.innerHTML = `
      <div class="discount-progress-heading">
        <div>
          <span class="discount-progress-eyebrow">Desconto da compra coletiva</span>
          <strong>${title}</strong>
        </div>
        <span class="discount-progress-total">${fmt.brl(total)} em pedidos</span>
      </div>
      <div class="discount-progress-track" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso para a próxima faixa de desconto">
        <span style="width:${progressPct}%"></span>
      </div>
      <div class="discount-progress-meta">
        <span>${fmt.escape(detail)}</span>
        <strong>${progress.maximo_alcancado ? "Desconto máximo" : next ? `Próxima faixa: ${next.percentual}%` : "Aguardando pedidos"}</strong>
      </div>
      <div class="discount-progress-tiers">${tierMarkers}</div>
      ${current ? `<small class="discount-progress-note">Faixa atual: ${fmt.escape(current.nome || `${current.percentual}%`)}</small>` : ""}
    `;
  },

  /* ----------------- Cadastro ----------------- */
  checkRegistration() {
    const reg = localStorage.getItem("userRegistered");
    if (reg === "true") {
      this.state.isRegistered = true;
      this.state.user.name = localStorage.getItem("registeredName") || "";
      this.state.user.phone = localStorage.getItem("registeredPhone") || "";
      this.state.user.email = localStorage.getItem("registeredEmail") || "";
    }
  },

  hasAppAccess() {
    return this.state.isRegistered || this.state.isAdminLoggedIn;
  },

  clearBuyerSession(showModal = true) {
    this.state.isRegistered = false;
    this.state.user = { name: "", phone: "", email: "" };
    localStorage.removeItem("userRegistered");
    localStorage.removeItem("registeredName");
    localStorage.removeItem("registeredPhone");
    localStorage.removeItem("registeredEmail");
    this.state.lastOrder = null;
    this.renderHeaderUser();
    this.saveLocal();
    if (showModal && !this.state.isAdminLoggedIn) this.showRegistrationModal(true, "login");
  },

  clearAdminSession() {
    this.state.isAdminLoggedIn = false;
    this.saveLocal();
  },

  requireRegistration() {
    if (!this.hasAppAccess()) {
      this.showRegistrationModal(true);
      return false;
    }
    return true;
  },

  // SECTION: Modal de login/cadastro do comprador
  // - mode="login"  → only Telefone-or-Email + PIN (sem nome)
  // - mode="signup" → nome + telefone + email + PIN (cadastro completo)
  showRegistrationModal(blocking = false, mode = "login") {
    const existing = document.getElementById("registrationModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "registrationModal";
    modal.className = "modal-wrap";
    const isLogin = mode === "login";
    modal.innerHTML = `
      <div class="modal-overlay${blocking ? " modal-blocking" : ""}">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-header-icon">${icon("user")}</div>
            <h2>${isLogin ? "Entrar na compra coletiva" : "Novo cadastro"}</h2>
            <p>${isLogin
              ? "Informe <b>telefone ou e-mail</b> e seu PIN. Se é sua primeira vez, clique em <b>Criar cadastro</b>."
              : "Cadastre-se informando seus dados e um PIN de 4 a 6 dígitos. Você usará o PIN para acessar seu histórico de compras."}</p>
          </div>
          <div class="modal-body">
            ${isLogin ? "" : `
            <div class="form-group">
              <label for="regName">Nome completo</label>
              <input type="text" id="regName" placeholder="Nome e sobrenome" autocomplete="name" />
              <small>Informe ao menos nome e sobrenome.</small>
            </div>`}
            <div class="form-group">
              <label for="regIdentifier">${isLogin ? "Telefone ou E-mail" : "Telefone / WhatsApp"}</label>
              <input type="text" id="regIdentifier" placeholder="${isLogin ? "(00) 00000-0000  ou  seu@email.com" : "(00) 00000-0000"}" autocomplete="${isLogin ? "username" : "tel"}" inputmode="${isLogin ? "text" : "tel"}" />
            </div>
            ${isLogin ? "" : `
            <div class="form-group">
              <label for="regEmail">E-mail</label>
              <input type="email" id="regEmail" placeholder="seu@email.com" autocomplete="email" />
            </div>`}
            <div class="form-group">
              <label for="regPin">${isLogin ? "PIN" : "Crie um PIN (4 a 6 dígitos)"}</label>
              <input type="password" id="regPin" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="${isLogin ? "current-password" : "new-password"}" />
              <small>Apenas números. Guarde seu PIN para acessar seu histórico.</small>
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px;flex-direction:column">
            <button class="btn btn-primary btn-block" onclick="app.submitRegistration('${mode}', this)">${isLogin ? "Entrar" : "Cadastrar e entrar"}</button>
            ${isLogin ? `<button class="btn btn-link btn-block" onclick="app.openPinRecoveryRequest(${blocking})">Esqueci meu PIN</button>` : ""}
            <button class="btn btn-ghost btn-block" onclick="app.showRegistrationModal(${blocking}, '${isLogin ? "signup" : "login"}')">
              ${isLogin ? "Criar cadastro (primeiro acesso)" : "Já tenho cadastro — entrar"}
            </button>
            <button class="btn btn-ghost btn-block" onclick="document.getElementById('registrationModal')?.remove(); app.promptAdminLogin()">
              Entrar como admin
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // SECTION: Focus + Enter key handling
    setTimeout(() => {
      const firstField = isLogin ? "regIdentifier" : "regName";
      document.getElementById(firstField)?.focus();
    }, 50);
    ["regName", "regIdentifier", "regEmail", "regPin"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.submitRegistration(mode);
      });
    });
  },

  async submitRegistration(mode = "login", submitButton = null) {
    const pinEl = document.getElementById("regPin");
    const pin = (pinEl?.value || "").replace(/\D/g, "");
    const identifierEl = document.getElementById("regIdentifier");
    const identifier = identifierEl?.value?.trim() || "";

    // SECTION: Modo signup — campos completos (nome + telefone + email + pin)
    if (mode === "signup") {
      const name = document.getElementById("regName")?.value?.trim() || "";
      const emailEl = document.getElementById("regEmail");
      const email = emailEl ? emailEl.value.trim() : "";

      if (!name || name.split(/\s+/).length < 2) {
        this.toast("Digite nome e sobrenome", "error");
        return;
      }
      if (identifier.replace(/\D/g, "").length < 8) {
        this.toast("Telefone inválido", "error");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        this.toast("E-mail inválido", "error");
        return;
      }
      if (!/^\d{4,6}$/.test(pin)) {
        this.toast("PIN deve ter de 4 a 6 dígitos", "error");
        return;
      }
      return this.runAuthSubmission(submitButton, "Cadastrando...", async () => {
        const res = await this.api("comprador/registro", "POST", {
          nome: name, telefone: identifier, email, pin,
        });
        if (!res?.success) {
          if (res?.code === "IDENTITY_ALREADY_REGISTERED") {
            this.openExistingBuyerLogin(identifier);
            return;
          }
          this.toast(res?.error || "Não foi possível concluir o cadastro. Tente novamente.", "error");
          return;
        }
        this._saveUserSession(
          res?.data?.nome || name,
          res?.data?.telefone || identifier,
          res?.data?.email || email,
          res?.token || res?.data?.token || ""
        );
      });
      return;
    }

    // SECTION: Modo login — identificador (telefone ou email) + pin
    if (!identifier) {
      this.toast("Informe telefone ou e-mail", "error");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      this.toast("Informe seu PIN (4 a 6 dígitos)", "error");
      return;
    }
    return this.runAuthSubmission(submitButton, "Entrando...", async () => {
      const res = await this.api("comprador/login", "POST", {
        identificador: identifier, pin,
      });
      if (!res?.success) {
        this.toast(res?.error || "Não foi possível entrar agora. Confira os dados e tente novamente.", "error");
        return;
      }
      const comprador = res.comprador || res.data || {};
      this._saveUserSession(
        comprador.nome,
        comprador.telefone || "",
        comprador.email || "",
        res?.token || comprador.token || ""
      );
    });
  },

  /** Executa uma submissão de autenticação com feedback visual e sem clique duplicado. */
  async runAuthSubmission(button, loadingLabel, operation) {
    const action = button || document.querySelector("#registrationModal .btn-primary");
    if (action?.disabled) return;
    const originalLabel = action?.textContent;
    if (action) {
      action.disabled = true;
      action.textContent = loadingLabel;
      action.setAttribute("aria-busy", "true");
    }
    try {
      return await operation();
    } catch {
      this.toast("Não foi possível concluir agora. Verifique sua conexão e tente novamente.", "error");
      return null;
    } finally {
      if (action && action.isConnected !== false) {
        action.disabled = false;
        action.textContent = originalLabel || "Continuar";
        action.removeAttribute("aria-busy");
      }
    }
  },

  /** Direciona um cadastro já existente para a jornada correta sem aparência de falha inerte. */
  openExistingBuyerLogin(identifier) {
    this.showRegistrationModal(true, "login");
    const input = document.getElementById("regIdentifier");
    if (input) input.value = identifier;
    this.toast("Este telefone ou e-mail já possui cadastro. Entre com seu PIN ou use “Esqueci meu PIN”.", "error");
  },

  _saveUserSession(name, phone, email, token, { announce = true, refreshHistory = true } = {}) {
    this.state.user.name = name;
    this.state.user.phone = phone;
    this.state.user.email = email;
    this.state.isRegistered = true;
    localStorage.setItem("userRegistered", "true");
    localStorage.setItem("registeredName", name);
    localStorage.setItem("registeredPhone", phone);
    localStorage.setItem("registeredEmail", email);
    document.getElementById("registrationModal")?.remove();
    this.renderHeaderUser();
    if (announce) this.toast(`Olá, ${name.split(" ")[0]}!`, "success");
    this.updateCartBar();
    this.saveLocal();
    // Opcional: atualizar aba histórico se estiver aberta
    if (refreshHistory && typeof this.renderHistorico === "function") this.renderHistorico();
  },

  async logoutUser() {
    if (!(await customConfirm("Sair da sua conta? O carrinho continuará salvo neste navegador."))) return;
    await this.api("comprador/logout", "POST");
    this.clearBuyerSession(true);
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
    const roleLabel = wrap.querySelector(".header-user-info small");
    if (roleLabel) roleLabel.textContent = this.state.isAdminLoggedIn ? "Comprador + Admin" : "Comprador";
    // SECTION: Edit profile button — inject visible "Meus dados" button
    this.renderAuthSecurityAction?.();
  },

  /**
   * Injects a visible "Meus dados" button into the header for the logged-in comprador.
   * Called from renderHeaderUser. No-op if the button already exists or user not logged in.
   */
  renderAuthSecurityAction() {
    const wrap = document.getElementById("headerUser");
    if (!wrap || !this.state.isRegistered) return;
    const existing = wrap.querySelector("[data-action='edit-profile']");
    if (existing) return;
    const btn = document.createElement("button");
    btn.setAttribute("data-action", "edit-profile");
    btn.className = "btn btn-ghost btn-sm";
    btn.style.cssText = "margin-right:4px;font-size:0.8rem;padding:4px 10px";
    btn.title = "Editar nome, telefone e e-mail";
    btn.innerHTML = `${icon("user")||'👤'} Meus dados`;
    btn.onclick = () => this.showEditProfileModal();
    // Insert before the icon-only edit button
    const iconBtn = wrap.querySelector("button[onclick='app.showEditProfileModal()']");
    if (iconBtn) {
      wrap.insertBefore(btn, iconBtn);
    } else {
      wrap.appendChild(btn);
    }
  },

  /* SECTION: Editar dados cadastrais (nome, telefone, e-mail) */
  showEditProfileModal() {
    const existing = document.getElementById("editProfileModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "editProfileModal";
    modal.className = "modal-wrap";
    modal.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.parentElement.remove()">
        <div class="modal-content" style="max-width:420px">
          <div class="modal-header">
            <div class="modal-header-icon">${icon("user")}</div>
            <h2>Meus dados</h2>
            <p>Atualize seu nome, telefone e e-mail de contato.</p>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="epNome">Nome completo</label>
              <input type="text" id="epNome" value="${fmt.escape(this.state.user.name)}" placeholder="Nome e sobrenome" autocomplete="name" />
            </div>
            <div class="form-group">
              <label for="epTelefone">Telefone / WhatsApp</label>
              <input type="text" id="epTelefone" value="${fmt.escape(this.state.user.phone)}" placeholder="(00) 00000-0000" autocomplete="tel" inputmode="tel" />
            </div>
            <div class="form-group">
              <label for="epEmail">E-mail</label>
              <input type="email" id="epEmail" value="${fmt.escape(this.state.user.email)}" placeholder="seu@email.com" autocomplete="email" />
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px">
            <button class="btn btn-ghost" onclick="document.getElementById('editProfileModal')?.remove()">Cancelar</button>
            <button class="btn btn-primary" style="flex:1" onclick="app.saveProfile()">Salvar alterações</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById("epNome")?.focus(), 50);
  },

  async saveProfile() {
    const nome = document.getElementById("epNome")?.value?.trim() || "";
    const telefone = document.getElementById("epTelefone")?.value?.trim() || "";
    const email = document.getElementById("epEmail")?.value?.trim() || "";

    if (!nome || nome.split(/\s+/).length < 2) {
      this.toast("Digite nome e sobrenome", "error");
      return;
    }
    if (telefone.replace(/\D/g, "").length < 8) {
      this.toast("Telefone inválido", "error");
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      this.toast("E-mail inválido", "error");
      return;
    }

    const r = await this.api("comprador/perfil", "PUT", { nome, telefone, email });
    if (r?.success) {
      const data = r.data || {};
      this.state.user.name = data.nome || nome;
      this.state.user.phone = data.telefone || telefone;
      this.state.user.email = data.email || email;
      localStorage.setItem("registeredName", this.state.user.name);
      localStorage.setItem("registeredPhone", this.state.user.phone);
      localStorage.setItem("registeredEmail", this.state.user.email);
      document.getElementById("editProfileModal")?.remove();
      this.renderHeaderUser();
      this.toast("Dados atualizados com sucesso", "success");
    } else {
      this.toast(r?.error || "Não foi possível salvar. Tente novamente.", "error");
    }
  },

  /* Admin: editar dados de qualquer comprador a partir do painel */
  showEditCompradorModal(buyerId, nome, telefone, email) {
    const existing = document.getElementById("editProfileModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "editProfileModal";
    modal.className = "modal-wrap";
    modal.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.parentElement.remove()">
        <div class="modal-content" style="max-width:420px">
          <div class="modal-header">
            <div class="modal-header-icon">${icon("user")}</div>
            <h2>Editar comprador</h2>
            <p>Altere os dados cadastrais de ${fmt.escape(nome)}.</p>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="epNome">Nome completo</label>
              <input type="text" id="epNome" value="${fmt.escape(nome)}" placeholder="Nome e sobrenome" />
            </div>
            <div class="form-group">
              <label for="epTelefone">Telefone / WhatsApp</label>
              <input type="text" id="epTelefone" value="${fmt.escape(telefone || "")}" placeholder="(00) 00000-0000" inputmode="tel" />
            </div>
            <div class="form-group">
              <label for="epEmail">E-mail</label>
              <input type="email" id="epEmail" value="${fmt.escape(email || "")}" placeholder="seu@email.com" />
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px">
            <button class="btn btn-ghost" onclick="document.getElementById('editProfileModal')?.remove()">Cancelar</button>
            <button class="btn btn-primary" style="flex:1" onclick="app.adminSaveComprador(${buyerId})">Salvar alterações</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById("epNome")?.focus(), 50);
  },

  async adminSaveComprador(buyerId) {
    const nome = document.getElementById("epNome")?.value?.trim() || "";
    const telefone = document.getElementById("epTelefone")?.value?.trim() || "";
    const email = document.getElementById("epEmail")?.value?.trim() || "";

    if (!nome || nome.split(/\s+/).length < 2) {
      this.toast("Digite nome e sobrenome", "error");
      return;
    }
    if (telefone.replace(/\D/g, "").length < 8) {
      this.toast("Telefone inválido", "error");
      return;
    }

    const r = await this.api(`admin/compradores/${buyerId}`, "PUT", { nome, telefone, email });
    if (r?.success) {
      document.getElementById("editProfileModal")?.remove();
      this.refreshAdmin();
      this.toast("Dados do comprador atualizados", "success");
    } else {
      this.toast(r?.error || "Não foi possível salvar", "error");
    }
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
    // SECTION: Fresh data on every tab switch — no stale views
    if (tab === "meu-pedido") {
      // Reset edit-check so reopening revalidates server-side pedido status
      this.state._editCheckDone = false;
      this.renderInvoice();
    } else if (tab === "historico") {
      // Always fetch fresh historico data from server
      this.renderHistorico();
    } else if (tab === "admin" && this.state.isAdminLoggedIn) {
      // renderAdmin carrega progresso e relatórios em paralelo.
      this.renderAdmin();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  /* ----------------- Descontos ----------------- */
  applyDiscountTo(preco) {
    const pct = this.state.discountPct || 0;
    return pct > 0 ? preco * (1 - pct / 100) : preco;
  },

  /* ----------------- Entradas do catálogo (com variantes) -----------------
   * Cada "entry" do catálogo é ou um produto único ou um grupo com variantes.
   * Formato:
   *   { kind: 'single', produto }              → produto único
   *   { kind: 'group',  grupo, variantes[] }   → grupo (dropdown no card)
   * Cada variante interna é { codigo, flavor, size, produto } onde `produto`
   * é a linha original de PRODUTOS com preço, imagem etc.
   * --------------------------------------------------------------------- */
  buildCatalogEntries() {
    const byCodigo = Object.fromEntries(PRODUTOS.map((p) => [p.codigo, p]));
    const grouped = new Set();
    const entries = [];

    // 1) Grupos de variantes
    if (typeof VARIANTES !== "undefined") {
      for (const g of VARIANTES) {
        const variantesResolvidas = g.variantes
          .map((v) => ({ ...v, produto: byCodigo[v.codigo] }))
          .filter((v) => v.produto);
        if (variantesResolvidas.length < 2) continue; // descarta grupos quebrados
        variantesResolvidas.forEach((v) => grouped.add(v.codigo));
        entries.push({
          kind: "group",
          grupo: g,
          variantes: variantesResolvidas,
        });
      }
    }

    // 2) Produtos únicos (não pertencem a nenhum grupo)
    for (const p of PRODUTOS) {
      if (!grouped.has(p.codigo)) {
        entries.push({ kind: "single", produto: p });
      }
    }
    return entries;
  },

  // Retorna a variante atualmente "ativa" de um grupo (default: primeira).
  getActiveVariant(entry) {
    if (entry.kind !== "group") return null;
    const sel = this.state.variantSelection[entry.grupo.id];
    return (
      entry.variantes.find((v) => v.codigo === sel) || entry.variantes[0]
    );
  },

  // Nome canônico do entry (para busca/ordenação)
  entryName(entry) {
    return entry.kind === "group"
      ? entry.grupo.nome
      : entry.produto.nome;
  },
  entryPrice(entry) {
    if (entry.kind === "single") return entry.produto.preco;
    // Para grupos, usamos o MENOR preço entre as variantes como "a partir de"
    return Math.min(...entry.variantes.map((v) => v.produto.preco));
  },
  // Para filtro por grupo/categoria, delega ao primeiro produto do entry.
  entryPrimaryProduct(entry) {
    return entry.kind === "single" ? entry.produto : entry.variantes[0].produto;
  },

  /* ----------------- Filtragem por grupo ----------------- */
  getFilteredProducts() {
    const search = document
      .getElementById("searchInput")
      ?.value.trim()
      .toLowerCase();
    const all = this.buildCatalogEntries();
    let list = all.filter((entry) => {
      // Busca: casa se qualquer variante ou o nome do grupo bate
      let matchesSearch = !search;
      if (!matchesSearch) {
        if (this.entryName(entry).toLowerCase().includes(search)) {
          matchesSearch = true;
        } else if (entry.kind === "single") {
          matchesSearch =
            entry.produto.nome.toLowerCase().includes(search) ||
            entry.produto.codigo.toLowerCase().includes(search);
        } else {
          matchesSearch = entry.variantes.some(
            (v) =>
              v.produto.nome.toLowerCase().includes(search) ||
              v.codigo.toLowerCase().includes(search)
          );
        }
      }
      const primary = this.entryPrimaryProduct(entry);
      const matchesGroup =
        this.state.currentGroup === "todos" ||
        getProductGroup(primary) === this.state.currentGroup;
      return matchesSearch && matchesGroup;
    });

    switch (this.state.sortBy) {
      case "preco_asc":
        list.sort((a, b) => this.entryPrice(a) - this.entryPrice(b));
        break;
      case "preco_desc":
        list.sort((a, b) => this.entryPrice(b) - this.entryPrice(a));
        break;
      case "codigo":
        list.sort((a, b) =>
          this.entryPrimaryProduct(a).codigo.localeCompare(
            this.entryPrimaryProduct(b).codigo
          )
        );
        break;
      default:
        list.sort((a, b) =>
          this.entryName(a).localeCompare(this.entryName(b))
        );
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

    grid.innerHTML = items
      .map((entry) =>
        entry.kind === "group"
          ? this.renderGroupCard(entry)
          : this.renderProductCard(entry.produto)
      )
      .join("");
    this.renderPagination(totalPages);
  },

  // Card de produto único — preço cheio, sem desconto no visual.
  renderProductCard(p) {
    const qty = this.state.cart[p.codigo] || 0;
    const hasImg = p.imagem && p.imagem.length > 0;

    const imgHtml = hasImg
      ? `<img src="${p.imagem}" alt="${fmt.escape(p.nome)}" loading="lazy" onclick="app.openLightbox('${p.imagem}','${fmt.escape(p.nome).replace(/'/g,"\\'")}')" style="cursor:zoom-in" />`
      : `<div class="product-img-placeholder">
           ${icon("package")}
           <span class="ph-code">${fmt.escape(p.codigo)}</span>
         </div>`;

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
          <div class="product-prices">
            <span class="price-main">${fmt.brl(p.preco)}</span>
          </div>
          <div class="qty-control">
            <button class="qty-btn" onclick="app.updateQty('${p.codigo}',-1)" aria-label="Diminuir">${icon("minus")}</button>
            <input type="number" class="qty-input" value="${qty}" min="0"
              onchange="app.setQty('${p.codigo}',this.value)" />
            <button class="qty-btn qty-btn-add" onclick="app.updateQty('${p.codigo}',1)" aria-label="Adicionar">${icon("plus")}</button>
          </div>
        </div>
      </div>`;
  },

  // Card de grupo com seletor(es) de variante (sabor e/ou tamanho).
  renderGroupCard(entry) {
    const g = entry.grupo;
    const active = this.getActiveVariant(entry);
    const p = active.produto;
    const qty = this.state.cart[p.codigo] || 0;
    const hasImg = p.imagem && p.imagem.length > 0;

    const imgHtml = hasImg
      ? `<img src="${p.imagem}" alt="${fmt.escape(p.nome)}" loading="lazy" onclick="app.openLightbox('${p.imagem}','${fmt.escape(p.nome).replace(/'/g,"\\'")}')" style="cursor:zoom-in" />`
      : `<div class="product-img-placeholder">
           ${icon("package")}
           <span class="ph-code">${fmt.escape(p.codigo)}</span>
         </div>`;

    // Monta o seletor. Se há sabor e tamanho, são 2 dropdowns.
    // Se só um, 1 dropdown. A troca aciona app.pickVariant().
    const selectorsHtml = this.buildVariantSelectors(entry, active);
    const countVariants = entry.variantes.length;

    return `
      <div class="product-card product-card-group ${qty > 0 ? "has-qty" : ""}">
        <div class="product-img-wrap">${imgHtml}</div>
        <div class="product-body">
          <div class="product-meta">
            <span class="product-code">${fmt.escape(p.codigo)}</span>
            <span class="variant-pill" title="${countVariants} opções disponíveis">${countVariants} opções</span>
          </div>
          <div class="product-name" title="${fmt.escape(g.nome)}">${fmt.escape(
      g.nome
    )}</div>
          ${selectorsHtml}
          <div class="product-prices">
            <span class="price-main">${fmt.brl(p.preco)}</span>
          </div>
          <div class="qty-control">
            <button class="qty-btn" onclick="app.updateQty('${p.codigo}',-1)" aria-label="Diminuir">${icon("minus")}</button>
            <input type="number" class="qty-input" value="${qty}" min="0"
              onchange="app.setQty('${p.codigo}',this.value)" />
            <button class="qty-btn qty-btn-add" onclick="app.updateQty('${p.codigo}',1)" aria-label="Adicionar">${icon("plus")}</button>
          </div>
        </div>
      </div>`;
  },

  // Monta os <select> para sabor e/ou tamanho.
  // A estratégia: quando o grupo tem ambos, cada select filtra o outro
  // considerando somente as combinações existentes.
  buildVariantSelectors(entry, active) {
    const g = entry.grupo;
    const all = entry.variantes;
    const parts = [];

    if (g.hasSize) {
      // Tamanhos disponíveis, opcionalmente filtrados pelo sabor ativo
      let pool = all;
      if (g.hasFlavor && active.flavor) {
        const sameFlavor = all.filter((v) => v.flavor === active.flavor);
        if (sameFlavor.length) pool = sameFlavor;
      }
      const sizes = [];
      const seen = new Set();
      for (const v of pool) {
        const key = v.size || "—";
        if (!seen.has(key)) {
          seen.add(key);
          sizes.push({ key, variante: v });
        }
      }
      if (sizes.length >= 2) {
        const opts = sizes
          .map(
            (s) =>
              `<option value="${s.variante.codigo}" ${
                s.variante.codigo === active.codigo ? "selected" : ""
              }>${fmt.escape(s.key)}</option>`
          )
          .join("");
        parts.push(`
          <label class="variant-select">
            <span>Tamanho</span>
            <select onchange="app.pickVariant('${g.id}', this.value)">${opts}</select>
          </label>`);
      }
    }

    if (g.hasFlavor) {
      // Sabores, opcionalmente filtrados pelo tamanho ativo
      let pool = all;
      if (g.hasSize && active.size) {
        const sameSize = all.filter((v) => v.size === active.size);
        if (sameSize.length) pool = sameSize;
      }
      const flavors = [];
      const seen = new Set();
      for (const v of pool) {
        const key = v.flavor || "Padrão";
        if (!seen.has(key)) {
          seen.add(key);
          flavors.push({ key, variante: v });
        }
      }
      if (flavors.length >= 2) {
        const opts = flavors
          .map(
            (s) =>
              `<option value="${s.variante.codigo}" ${
                s.variante.codigo === active.codigo ? "selected" : ""
              }>${fmt.escape(s.key)}</option>`
          )
          .join("");
        parts.push(`
          <label class="variant-select">
            <span>Sabor</span>
            <select onchange="app.pickVariant('${g.id}', this.value)">${opts}</select>
          </label>`);
      }
    }

    if (!parts.length) return "";
    return `<div class="variant-selectors">${parts.join("")}</div>`;
  },

  // Troca a variante ativa e re-renderiza apenas o card daquele grupo.
  pickVariant(grupoId, codigo) {
    this.state.variantSelection[grupoId] = codigo;
    this.renderProducts();
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
      const p = PRODUTO_INDEX[cod];
      if (p) this.toast(`${p.nome} adicionado`, "success");
    }
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
    if (document.getElementById("tab-meu-pedido") &&
        !document.getElementById("tab-meu-pedido").classList.contains("hidden"))
      this.renderInvoice();
  },

  setQty(cod, v) {
    if (!this.requireRegistration()) return;
    const q = parseInt(v) || 0;
    if (q <= 0) delete this.state.cart[cod];
    else this.state.cart[cod] = q;
    this.saveLocal();
    this.updateCartBar();
    if (document.getElementById("tab-meu-pedido") &&
        !document.getElementById("tab-meu-pedido").classList.contains("hidden"))
      this.renderInvoice();
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
    for (const [cod, qty] of Object.entries(this.state.cart)) {
      const p = PRODUTO_INDEX[cod];
      if (!p) continue;
      bruto += p.preco * qty;
    }
    const pct = this.state.discountPct || 0;
    const total = bruto * (1 - pct / 100);
    return {
      bruto,
      total,
      economia: bruto - total,
      pct,
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
      td.textContent = `Com ${t.pct}% off: ${fmt.brl(t.total)}`;
    } else {
      td.textContent = "";
    }

    const badge = document.getElementById("tabCartBadge");
    if (badge) {
      badge.hidden = distinct === 0;
      badge.textContent = distinct;
    }
  },

  /* Busca o pedido mais recente do comprador no servidor e preenche
     this.state.lastOrder para exibir na tab "Meu Pedido".
     Só é chamado quando o carrinho está vazio E não há lastOrder no localStorage. */
  async loadServerOrder() {
    if (!this.state.isRegistered || !this.state.user.name) return false;
    try {
      const res = await this.api("pedidos/historico");
      const pedidos = res?.data || [];
      // Mostra em “Meu Pedido” somente o pedido do ciclo ativo. Pedidos de
      // ciclos encerrados continuam exclusivamente no Histórico.
      const pendente = pedidos.find(p => p.ciclo_ativo && p.status === "pendente")
        || pedidos.find(p => p.ciclo_ativo);
      if (!pendente) return false;
      // Converte formato do servidor para formato do lastOrder
      const itens = (pendente.itens || []).filter(it => it && it.codigo).map(it => ({
        codigo: it.codigo,
        nome: it.nome,
        quantidade: it.quantidade,
        preco_bruto: it.preco_bruto,
        preco_desconto: it.preco_desconto,
      }));
      if (!itens.length) return false;
      const discountPct = itens[0] && itens[0].preco_bruto && itens[0].preco_desconto
        ? Math.round((1 - itens[0].preco_desconto / itens[0].preco_bruto) * 100)
        : 0;
      const totalBruto = parseFloat(pendente.total_bruto) || 0;
      const totalFinal = parseFloat(pendente.total_final) || 0;
      this.state.lastOrder = {
        id: pendente.id,
        data: pendente.created_at,
        usuario: this.state.user.name,
        telefone: this.state.user.phone,
        email: this.state.user.email,
        itens,
        discountPct,
        totalBruto,
        totalFinal,
        economia: totalBruto - totalFinal,
        _fromServer: true, // marca que veio do servidor (não localStorage)
      };
      return true;
    } catch (e) {
      console.error("loadServerOrder:", e);
      return false;
    }
  },

  /* ----------------- INVOICE (Meu Pedido) ----------------- */
  async renderInvoice() {
    const c = document.getElementById("myCartContent");

    // Verifica se há pedido aberto para edição no servidor
    if (this.state.isRegistered && !this.state._editCheckDone) {
      await this.checkPedidoAberto();
    }

    const items = Object.entries(this.state.cart);

    // Banner de edição ativa
    const editBanner = this.state.editingPedido
      ? `<div class="sent-order-banner" style="background:#fef3c7;border-color:#fde68a;margin-bottom:16px">
           ${icon("alert")}
           <div>
             <strong style="color:#92400e">Pedido aberto para edição</strong><br>
             <small style="color:#92400e">O administrador liberou seu pedido para alterações. Ajuste os itens e clique em <strong>Reenviar pedido</strong> quando terminar.</small>
           </div>
         </div>`
      : "";

    // Se o carrinho está vazio e o comprador está logado, busca sempre do servidor
    // (garante que descontos aplicados pelo admin sejam refletidos no perfil do comprador)
    if (!items.length && !this.state.editingPedido && this.state.isRegistered) {
      c.innerHTML = `<div class="card"><div class="empty-state">${icon("refresh")}<h3>Buscando seu pedido...</h3></div></div>`;
      const loaded = await this.loadServerOrder();
      if (loaded && this.state.lastOrder) {
        c.innerHTML = this.renderSentOrder(this.state.lastOrder);
        return;
      }
      // Pedidos deletados pelo admin não devem persistir no cache local
      if (!loaded && this.state.lastOrder?._fromServer) {
        this.state.lastOrder = null;
        this.saveLocal();
      }
      // Se não encontrou no servidor, cai para o fluxo normal abaixo
    }

    // Fallback: mostra lastOrder do cache local (quando não está logado)
    if (!items.length && this.state.lastOrder && !this.state.editingPedido) {
      c.innerHTML = this.renderSentOrder(this.state.lastOrder);
      return;
    }

    if (!items.length && !this.state.editingPedido) {
      // Mostra pedidos órfãos para limpeza se existirem
      const orphans = this.state.orphanPedidos || [];
      const orphanHtml = orphans.length ? `
        <div class="card" style="margin-bottom:14px">
          <div class="sent-order-banner" style="background:#fef3c7;border-color:#fde68a">
            ${icon("alert")}
            <div>
              <strong style="color:#92400e">${orphans.length} pedido(s) de teste encontrado(s) no histórico</strong><br>
              <small style="color:#92400e">Estes pedidos foram criados mas não correspondem a compras reais. Deseja removê-los?</small>
            </div>
          </div>
          <div style="padding:0 20px 16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-danger btn-sm" onclick="app.deleteAllOrphanPedidos()">${icon("trash")} Apagar todos os pedidos de teste</button>
          </div>
          ${orphans.map((p) => {
            const dt = new Date(p.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            const qtd = (p.itens || []).filter(it => it && it.codigo).length;
            return `<div style="padding:6px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--c-border)">
              <span style="font-size:0.85rem">Pedido #${p.id} · ${dt} · ${qtd} itens · ${fmt.brl(p.total_final)}</span>
              <button class="btn-icon btn-icon-danger" title="Remover" onclick="app.deleteOrphanPedido(${p.id})">${icon("trash")}</button>
            </div>`;
          }).join("")}
        </div>` : "";

      c.innerHTML = orphanHtml + `
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
    const pct = t.pct;

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
        const p = PRODUTO_INDEX[cod];
        if (!p) return "";
        const sub = p.preco * qty;
        const subD = this.applyDiscountTo(p.preco) * qty;
        const subPriceHtml =
          pct > 0
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
              )} · ${fmt.brl(p.preco)} un.</span>
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

    const editFinBtn = this.state.editingPedido
      ? `<button class="btn btn-primary btn-block" onclick="app.resubmitEditedOrder()">Reenviar pedido editado</button>`
      : `<button class="btn btn-primary btn-block" onclick="app.finalizeOrder()">Finalizar pedido</button>`;

    c.innerHTML = `
      ${editBanner}
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
            pct > 0
              ? `<div class="summary-line discount">
                <span>Desconto aplicado (${pct}%)</span>
                <strong>− ${fmt.brl(t.economia)}</strong>
              </div>`
              : `<div class="summary-line muted">
                <span>Sem desconto ativo no momento</span>
              </div>`
          }
          <div class="summary-total">
            <span>Total a pagar</span>
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
            ${editFinBtn}
            <button class="btn btn-ghost btn-block" onclick="app.switchTab('produtos')">Continuar comprando</button>
          </div>
        </aside>
      </div>`;
  },

  // Verifica no servidor se existe pedido com status 'aberto_edicao'
  async checkPedidoAberto() {
    this.state._editCheckDone = true;
    try {
      if (!this.state.user.name) return;
      const res = await this.api("pedidos/historico");
      const pedidos = res?.data || [];
      const aberto = pedidos.find((p) => p.status === "aberto_edicao");
      if (aberto) {
        this.state.editingPedido = aberto;
        // Carrega itens do pedido aberto para o carrinho
        const itens = (aberto.itens || []).filter((it) => it && it.codigo);
        const newCart = {};
        itens.forEach((it) => {
          newCart[it.codigo] = (newCart[it.codigo] || 0) + it.quantidade;
        });
        this.state.cart = newCart;
        this.saveLocal();
        this.updateCartBar();
        this.renderProducts();
      }
    } catch (e) {
      console.error("checkPedidoAberto error:", e);
    }
  },

  // Reenvia o pedido editado (exclui o antigo e cria novo)
  async resubmitEditedOrder() {
    const items = Object.entries(this.state.cart);
    if (!items.length) {
      this.toast("Adicione ao menos um item antes de reenviar", "error");
      return;
    }
    if (!(await customConfirm("Confirma o reenvio do pedido editado?"))) return;

    const pedidoAberto = this.state.editingPedido;
    if (!pedidoAberto?.id) {
      this.toast("Pedido em edição não encontrado", "error");
      return;
    }
    this.state.lastOrder = null;
    // O backend substitui o pedido antigo e cria o novo em uma única transação.
    await this.finalizeOrder();
  },

  /* Renderiza o pedido enviado para revisão do comprador. */
  renderSentOrder(order) {
    const dt = new Date(order.data);
    const dataFmt = dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const rows = order.itens
      .map((it) => {
        const sub = (it.preco_bruto || 0) * it.quantidade;
        const subD = (it.preco_desconto || it.preco_bruto || 0) * it.quantidade;
        const subHtml =
          order.discountPct > 0
            ? `<span class="invoice-strike">${fmt.brl(sub)}</span>
               <span class="invoice-final">${fmt.brl(subD)}</span>`
            : `<span class="invoice-final">${fmt.brl(sub)}</span>`;
        return `
          <tr>
            <td>
              <div class="invoice-product">
                <span class="invoice-product-name">${fmt.escape(it.nome)}</span>
                <span class="invoice-product-meta">${fmt.escape(it.codigo)} · ${fmt.brl(it.preco_bruto || 0)} un.</span>
              </div>
            </td>
            <td style="text-align:center">${it.quantidade}</td>
            <td>${subHtml}</td>
          </tr>`;
      })
      .join("");

    return `
      <div class="sent-order-banner">
        ${icon("check")}
        <div>
          <strong>${order._fromServer ? "Pedido recuperado do servidor" : "Pedido enviado"}</strong>
          <small>${order.id ? "Nº " + order.id + " · " : ""}${dataFmt}${order._fromServer ? " · sincronizado" : ""}</small>
        </div>
      </div>
      <div class="invoice-grid">
        <div>
          <div class="card">
            <h3 class="card-title">${icon("receipt")} Itens do pedido</h3>
            <div style="overflow-x:auto">
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style="text-align:center">Qtd</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <aside class="invoice-summary">
          <h3>Resumo</h3>
          <div class="summary-line">
            <span>Total bruto</span>
            <strong>${fmt.brl(order.totalBruto)}</strong>
          </div>
          ${
            order.discountPct > 0
              ? `<div class="summary-line discount">
                  <span>Desconto (${order.discountPct}%)</span>
                  <strong>− ${fmt.brl(order.economia)}</strong>
                </div>`
              : ""
          }
          <div class="summary-total">
            <span>Total a pagar</span>
            <strong>${fmt.brl(order.totalFinal)}</strong>
          </div>
          <div class="summary-actions">
            <button class="btn btn-secondary btn-block" onclick="app.reopenLastOrder()">Editar pedido</button>
            <button class="btn btn-danger btn-block" onclick="app.cancelLastOrder()">Cancelar pedido</button>
            <button class="btn btn-ghost btn-block" onclick="app.switchTab('produtos')">Voltar aos produtos</button>
          </div>
        </aside>
      </div>`;
  },

  /* ----------------- Finalizar pedido ----------------- */
  async finalizeOrder() {
    if (!this.requireRegistration()) return;
    if (this.state._submitting) {
      this.toast("Pedido já está sendo enviado, aguarde...", "info");
      return;
    }
    if (!Object.keys(this.state.cart).length) {
      this.toast("Carrinho vazio", "error");
      return;
    }
    const t = this.calcTotals();
    const msg = `Confirma o envio do pedido?\n\nBruto: ${fmt.brl(
      t.bruto
    )}\nDesconto: ${t.pct}%\nTotal: ${fmt.brl(t.total)}\nEconomia: ${fmt.brl(
      t.economia
    )}`;
    if (!(await customConfirm(msg))) return;

    this.state._submitting = true;

    const itens = Object.entries(this.state.cart).map(([codigo, quantidade]) => ({
      codigo,
      quantidade,
    }));

    let res;
    try {
      res = await this.api("pedidos", "POST", {
        usuario: this.state.user.name,
        telefone: this.state.user.phone,
        email: this.state.user.email,
        itens,
        replace_pedido_id: this.state.editingPedido?.id || null,
      });
    } finally {
      this.state._submitting = false;
    }

    if (res && res.success) {
      this.toast("Pedido enviado com sucesso!", "success");
    } else if (res && res.duplicate) {
      this.toast("Você já tem um pedido enviado. Edite-o na aba Meu Pedido.", "info");
      this.renderInvoice();
      return;
    } else {
      this.toast(res?.error || "Não foi possível enviar o pedido. Seu carrinho foi mantido para tentar novamente.", "error");
      return;
    }

    await this.loadDiscountProgress();
    const appliedPct = Number(res.desconto_percentual ?? this.state.discountPct ?? t.pct) || 0;
    const appliedItems = itens.map((item) => ({
      ...item,
      preco_desconto: item.preco_bruto * (1 - appliedPct / 100),
    }));
    const serverTotals = res.totais || {};

    // Persiste o pedido enviado para o comprador visualizar depois
    this.state.lastOrder = {
      id: res && res.pedido_id ? res.pedido_id : null,
      data: new Date().toISOString(),
      usuario: this.state.user.name,
      telefone: this.state.user.phone,
      email: this.state.user.email,
      itens: appliedItems,
      discountPct: appliedPct,
      totalBruto: Number(serverTotals.total_bruto) || t.bruto,
      totalFinal: Number(serverTotals.total_final) || t.total,
      economia: Number(serverTotals.total_desconto) || t.economia,
    };

    this.state.cart = {};
    this.state.editingPedido = null;
    this.saveLocal();
    this.updateCartBar();
    this.renderProducts();
    this.renderInvoice();
  },

  /* Cancelar pedido já enviado: remove do banco e limpa localmente.
     skipConfirm=true é usado internamente (ex: reopenLastOrder já perguntou). */
  async cancelLastOrder(skipConfirm = false) {
    const last = this.state.lastOrder;
    if (!last) return;
    if (!skipConfirm && !(await customConfirm("Cancelar este pedido? Esta ação não pode ser desfeita."))) return;
    if (last.id) {
      const res = await this.api(`pedidos/${last.id}`, "DELETE");
      if (res && res.success) {
        this.toast("Pedido cancelado e removido do histórico", "success");
      } else {
        this.toast("Não foi possível cancelar no servidor", "error");
        return;
      }
    } else {
      this.toast("Pedido removido localmente", "info");
    }
    this.state.lastOrder = null;
    await this.loadDiscountProgress();
    this.saveLocal();
    this.renderInvoice();
  },

  /* Reabre o pedido enviado voltando os itens para o carrinho para edição.
     Deleta o pedido antigo do banco para não ficar duplicado no histórico. */
  async reopenLastOrder() {
    const last = this.state.lastOrder;
    if (!last) return;
    if (!(await customConfirm("Editar este pedido? Os itens voltarão ao carrinho e o pedido atual será cancelado no servidor."))) return;
    // Carrega itens no carrinho
    last.itens.forEach((it) => {
      this.state.cart[it.codigo] = (this.state.cart[it.codigo] || 0) + it.quantidade;
    });
    // Deleta do banco sem pedir confirmação de novo
    await this.cancelLastOrder(true);
    // Atualiza UI
    this.saveLocal();
    this.updateCartBar();
    this.renderProducts();
    this.renderInvoice();
  },

  /* Limpa pedidos pendentes órfãos do comprador logado no banco.
     Chamado na inicialização para garantir que o histórico reflita a realidade. */
  async cleanupOrphanPedidos() {
    if (!this.state.isRegistered) return;
    try {
      const res = await this.api("pedidos/historico");
      const pedidos = res?.data || [];
      // Se não tem lastOrder no localStorage mas tem pedidos pendentes no banco,
      // são pedidos órfãos de sessões anteriores — exibe no renderInvoice para o user decidir.
      const pendentes = pedidos.filter((p) => p.status === "pendente");
      if (pendentes.length && !this.state.lastOrder) {
        this.state.orphanPedidos = pendentes;
      }
    } catch (e) {
      console.error("cleanupOrphanPedidos:", e);
    }
  },

  async deleteOrphanPedido(pedidoId) {
    const res = await this.api(`pedidos/${pedidoId}`, "DELETE");
    if (res?.success) {
      this.toast("Pedido removido do histórico", "success");
      if (this.state.orphanPedidos) {
        this.state.orphanPedidos = this.state.orphanPedidos.filter((p) => p.id !== pedidoId);
      }
      this.renderInvoice();
    } else {
      this.toast("Erro ao remover pedido", "error");
    }
  },

  async deleteAllOrphanPedidos() {
    if (!this.state.orphanPedidos?.length) return;
    if (!(await customConfirm(`Apagar ${this.state.orphanPedidos.length} pedido(s) de teste do histórico?`))) return;
    for (const p of this.state.orphanPedidos) {
      await this.api(`pedidos/${p.id}`, "DELETE");
    }
    this.state.orphanPedidos = [];
    this.toast("Pedidos de teste removidos", "success");
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

  // Modal de login administrativo — único ponto de entrada.
  // A aba "Painel Admin" permanece oculta até autenticação bem-sucedida.
  promptAdminLogin() {
    if (this.state.isAdminLoggedIn) {
      this.switchTab("admin");
      return;
    }
    document.getElementById("registrationModal")?.remove();
    const existing = document.getElementById("adminLoginModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "adminLoginModal";
    modal.className = "modal-wrap";
    modal.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.parentElement.remove()">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2>Acesso administrativo</h2>
            <p>Informe a senha de administrador para abrir o painel de gestão.</p>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="adminLoginPwd">Senha</label>
              <input type="password" id="adminLoginPwd" placeholder="••••••••" autocomplete="current-password" />
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px;">
            <button class="btn btn-ghost" onclick="document.getElementById('adminLoginModal').remove()">Cancelar</button>
            <button class="btn btn-primary" style="flex:1" onclick="app.loginAdmin()">Entrar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => {
      const input = document.getElementById("adminLoginPwd");
      input?.focus();
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.loginAdmin();
      });
    }, 50);
  },

  async loginAdmin() {
    const pwdEl =
      document.getElementById("adminLoginPwd") ||
      document.getElementById("adminPassword");
    const pwd = pwdEl?.value || "";
    if (!pwd) {
      this.toast("Digite a senha", "error");
      return;
    }
    const res = await this.api("admin/login", "POST", { senha: pwd });
    if (res && res.success) {
      this.state.isAdminLoggedIn = true;
      const adminBuyer = res?.comprador || res?.data?.comprador;
      if (adminBuyer) {
        this._saveUserSession(
          adminBuyer.nome,
          adminBuyer.telefone || "",
          adminBuyer.email || "",
          "",
          { refreshHistory: false },
        );
      }
      const tabAdmin = document.getElementById("tabAdmin");
      if (tabAdmin) tabAdmin.hidden = false;
      document
        .getElementById("adminLoginSection")
        ?.classList.add("hidden");
      document.getElementById("adminContent")?.classList.remove("hidden");
      document.getElementById("adminLoginModal")?.remove();
      document.getElementById("registrationModal")?.remove();
      this.switchTab("admin");
      this.saveLocal();
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

    const cycleQuery = this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : "";
    const [statsRes, conRes, usersRes, cyclesRes, progressRes] = await Promise.all([
      this.api(`stats${this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : ""}`),
      this.api(`pedidos/consolidado${this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : ""}`),
      this.api(`pedidos/por-usuario${this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : ""}`),
      this.api("ciclos-compra"),
      this.api(`desconto-progresso${cycleQuery}`),
    ]);

    if (progressRes?.success && progressRes.data) {
      this.state.discountProgress = progressRes.data;
      this.state.discountPct = Number(progressRes.data.percentual_atual) || 0;
      this.renderDiscountProgress();
      this.updateCartBar();
    }

    const stats = statsRes?.data || {};
    const con = conRes?.data || [];
    const users = usersRes?.data || [];
    const cycles = cyclesRes?.data || [];
    const activeCycle = cycles.find((cycle) => cycle.ativo);
    const selectedCycle = cycles.find((cycle) => Number(cycle.id) === Number(this.state.adminCycleId)) || activeCycle;
    const isHistoricalCycle = selectedCycle && !selectedCycle.ativo;
    this.state.adminCycleIsActive = !isHistoricalCycle;

    const statCard = (iconName, label, value) => `
      <div class="stat-card">
        <div class="stat-card-icon">${icon(iconName)}</div>
        <div class="stat-card-body">
          <small>${label}</small>
          <strong>${value}</strong>
        </div>
      </div>`;

    const pctAtual = this.state.discountPct || 0;
    const progress = this.state.discountProgress || {};
    const nextTier = progress.proxima_faixa;

    const valorBruto = parseFloat(stats.valor_bruto_geral || 0);
    const economia = parseFloat(stats.economia_geral || 0);
    const totalComDesconto = valorBruto - economia;

    const linkedBuyerNotice = this.state.isRegistered
      ? `<div class="card admin-access-banner" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:220px"><strong>Acesso unificado</strong><br>
            <small>Você está conectado como administrador e como comprador <strong>${fmt.escape(this.state.user.name)}</strong>. A aba <strong>Histórico</strong> mostra os seus pedidos.</small>
          </div>
          <button class="btn btn-primary btn-sm" onclick="app.switchTab('historico')">Ver meus pedidos</button>
        </div>`
      : `<div class="card admin-access-banner" style="margin-bottom:16px">
          <strong>Acesso administrativo ativo.</strong><br>
          <small>O cadastro de comprador deste administrador não está vinculado.</small>
        </div>`;

    let html = `
      ${linkedBuyerNotice}
      <div class="card" style="margin-bottom:16px;padding:14px 20px;display:flex;align-items:center;gap:10px">
        ${icon("calendar")} <div style="flex:1"><strong>Ciclo em exibição: ${fmt.escape(selectedCycle?.nome || "não configurado")}</strong><br><small style="color:var(--c-text-muted)">${isHistoricalCycle ? "Consulta histórica: este ciclo é somente leitura." : "Ciclo ativo: novos pedidos, pagamentos e exportações usam este período."}</small></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:.85rem">Ciclo
          <select onchange="app.selectAdminCycle(this.value)">${cycles.map((cycle) => `<option value="${cycle.id}" ${Number(cycle.id) === Number(selectedCycle?.id) ? "selected" : ""}>${fmt.escape(cycle.nome)}${cycle.ativo ? " · ativo" : ""}</option>`).join("")}</select>
        </label>
      </div>
      <div class="stats-grid">
        ${statCard("users", "Compradores", stats.total_compradores || 0)}
        ${statCard("box", "Produtos", stats.produtos_distintos || 0)}
        ${statCard("cart", "Unidades", stats.unidades_totais || 0)}
        ${statCard("dollar", "Valor bruto", fmt.brl(valorBruto))}
        ${statCard("tag", "Economia", fmt.brl(economia))}
        <div class="stat-card stat-highlight">
          <div class="stat-card-icon">${icon("dollar")}</div>
          <div class="stat-card-body">
            <small>Total c/ desconto</small>
            <strong>${fmt.brl(totalComDesconto)}</strong>
          </div>
        </div>
      </div>

      <div class="card discount-panel">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${icon("tag")}
          <div style="flex:1;min-width:220px">
            <strong>Desconto coletivo automático: ${pctAtual}%</strong><br>
            <small style="color:var(--c-text-muted)">
              ${nextTier
                ? `Faltam ${fmt.brl(progress.valor_faltante)} para liberar ${nextTier.percentual}% para todos.`
                : "A maior faixa configurada já foi alcançada para todos os compradores."}
            </small>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="app.refreshAdmin()">${icon("refresh")} Atualizar faixa</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px">
            ${icon("receipt")}
            <div>
              <strong>Controle de Pagamentos</strong><br>
              <small style="color:var(--c-text-muted)">Acompanhe parcelas e pagamentos dos compradores</small>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="app.renderPagamentos()">${icon("dollar")} Gerenciar Pagamentos</button>
        </div>
      </div>

      <div class="admin-toolbar">
        <button class="btn btn-secondary" onclick="app.renderAdmin()">${icon(
          "refresh"
        )} Atualizar</button>
        <button class="btn btn-primary" onclick="app.exportPedidoFornecedor()">${icon(
          "download"
        )} Exportar pedido (Excel)</button>
        <button class="btn btn-success" onclick="app.exportCSV()">${icon(
          "download"
        )} Exportar CSV</button>
        <button class="btn btn-secondary" onclick="app.openAdminPinRecovery()">${icon(
          "user"
        )} Definir acesso</button>
        <button class="btn btn-danger" onclick="app.clearAllOrders()">${icon(
          "trash"
        )} Apagar pedidos</button>
        <button class="btn btn-danger" onclick="app.clearAllHistory()">${icon(
          "trash"
        )} Apagar histórico</button>
        <button class="btn btn-ghost" onclick="app.exitAdmin()">${icon(
          "user"
        )} Sair do Admin</button>
      </div>

      ${this.renderConsolidatedSection(con)}

      <div class="card report-card">
        <div class="report-header">${icon("users")} Pedidos por comprador</div>
        ${this.renderBuyerCards(users)}
      </div>`;

    c.innerHTML = html;

    // Listener accordion: só um card aberto por vez
    c.querySelectorAll(".buyer-card-summary").forEach((summary) => {
      summary.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        e.stopPropagation();
        const thisCard = summary.closest(".buyer-card");
        const idx = thisCard.dataset.buyerIdx;
        const detail = document.getElementById("buyerDetail-" + idx);
        if (!detail) return;
        const wasOpen = detail.style.display !== "none";
        // Fecha TODOS os cards antes
        c.querySelectorAll(".buyer-card").forEach((bc) => {
          bc.classList.remove("buyer-card-open");
          const bd = bc.querySelector(".buyer-card-detail");
          if (bd) bd.style.display = "none";
        });
        // Se NÃO estava aberto, abre este
        if (!wasOpen) {
          detail.style.display = "block";
          thisCard.classList.add("buyer-card-open");
        }
      });
    });
  },

  renderConsolidatedSection(con) {
    if (!con.length) return `<div class="card report-card" style="margin-bottom:16px"><div style="padding:24px;text-align:center;color:var(--c-text-muted)">Nenhum pedido registrado.</div></div>`;
    let tBruto = 0, tFinal = 0, tQtd = 0;
    con.forEach((i) => {
      tBruto += parseFloat(i.total_bruto);
      tFinal += parseFloat(i.total_final);
      tQtd += parseInt(i.quantidade_total);
    });
    return `
      <div class="card report-card" style="margin-bottom:16px">
        <div class="report-header consolidated-toggle" onclick="document.getElementById('consolidadoDetail').style.display=document.getElementById('consolidadoDetail').style.display==='none'?'block':'none';this.querySelector('.buyer-card-chevron').classList.toggle('open')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <span>${icon("box")} Pedido consolidado por produto</span>
          <span class="buyer-card-chevron">&#9662;</span>
        </div>
        <div class="consolidated-summary" onclick="document.getElementById('consolidadoDetail').style.display=document.getElementById('consolidadoDetail').style.display==='none'?'block':'none'" style="cursor:pointer;padding:12px 20px;display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid var(--c-border)">
          <div><small style="color:var(--c-text-muted);font-size:0.72rem;text-transform:uppercase">Produtos</small><br><strong>${con.length}</strong></div>
          <div><small style="color:var(--c-text-muted);font-size:0.72rem;text-transform:uppercase">Unidades</small><br><strong>${tQtd}</strong></div>
          <div><small style="color:var(--c-text-muted);font-size:0.72rem;text-transform:uppercase">Total Bruto</small><br><strong>${fmt.brl(tBruto)}</strong></div>
          <div><small style="color:var(--c-text-muted);font-size:0.72rem;text-transform:uppercase">Total Final</small><br><strong style="color:var(--c-brand)">${fmt.brl(tFinal)}</strong></div>
          ${tBruto !== tFinal ? `<div><small style="color:var(--c-text-muted);font-size:0.72rem;text-transform:uppercase">Economia</small><br><strong style="color:var(--c-success)">${fmt.brl(tBruto - tFinal)}</strong></div>` : ""}
        </div>
        <div id="consolidadoDetail" style="display:none">
          <p class="card-subtitle" style="padding:12px 20px 8px;font-size:0.8rem">
            Clique no ícone ${icon("trash")} para remover um produto em falta de todos os pedidos.
          </p>
          ${this.renderConsolidatedTable(con)}
        </div>
      </div>`;
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
        const codigo = fmt.escape(i.codigo);
        const nome = fmt.escape(i.nome).replace(/'/g, "\\'");
        return `<tr>
          <td><strong>${codigo}</strong></td>
          <td>${fmt.escape(i.nome)}</td>
          <td>${i.quantidade_total}</td>
          <td>${fmt.brl(vb)}</td>
          <td>${fmt.brl(vd)}</td>
          <td><button class="btn-icon btn-icon-danger" title="Remover este produto de todos os pedidos (fornecedor em falta)" onclick="app.removeProdutoGlobal('${codigo}','${nome}')">${icon("trash")}</button></td>
        </tr>`;
      })
      .join("");
    return `
      <table class="data-table">
        <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Final</th><th></th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">TOTAL</td>
            <td>${tQtd}</td>
            <td>${fmt.brl(tBruto)}</td>
            <td>${fmt.brl(tDesc)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`;
  },

  renderBuyerCards(users) {
    if (!users.length)
      return `<div style="padding:24px;text-align:center;color:var(--c-text-muted)">Nenhum pedido registrado.</div>`;

    return `<div class="buyer-cards-grid">${users.map((u, idx) => {
      const usuarioEsc = fmt.escape(u.usuario).replace(/'/g, "\\'");
      const initials = fmt.initials(u.usuario);
      const totalFinal = parseFloat(u.total_desconto || u.total_bruto || 0);
      const totalBruto = parseFloat(u.total_bruto || 0);
      const qtdItens = parseInt(u.total_itens || 0);
      const statuses = u.statuses || [];
      const emEdicao = statuses.includes("aberto_edicao");
      const qtdPedidos = (u.pedido_ids || []).length;

      // Dedup itens
      const seen = new Set();
      const itensList = (u.itens || []).filter((it) => {
        const k = it.item_id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const itensRows = itensList
        .map(
          (it) =>
            `<tr>
              <td>${fmt.escape(it.codigo)}</td>
              <td>${fmt.escape(it.nome)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:4px">
                  <button class="btn-icon btn-sm" title="Diminuir" onclick="event.stopPropagation();app.adminChangeQty(${it.item_id},${it.quantidade - 1})">−</button>
                  <input type="number" class="qty-input admin-qty-input" value="${it.quantidade}" min="1" max="99" step="1"
                    style="width:48px;text-align:center;padding:2px 4px"
                    onchange="app.adminSetQty(${it.item_id},this.value)"
                    onkeydown="if(event.key==='Enter'){this.blur()}" />
                  <button class="btn-icon btn-sm" title="Aumentar" onclick="event.stopPropagation();app.adminChangeQty(${it.item_id},${it.quantidade + 1})">+</button>
                </div>
              </td>
              <td>${fmt.brl(it.preco_bruto * it.quantidade)}</td>
              <td>${fmt.brl(it.preco_desconto * it.quantidade)}</td>
              <td><button class="btn-icon btn-icon-danger" title="Remover item" onclick="event.stopPropagation();app.removeItemFromPedido(${it.item_id}, '${fmt.escape(it.nome).replace(/'/g, "\\'")}')">${icon("trash")}</button></td>
            </tr>`
        )
        .join("");

      return `
        <div class="buyer-card" data-buyer-idx="${idx}">
          <div class="buyer-card-summary">
            <div class="buyer-card-avatar">${initials}</div>
            <div class="buyer-card-info">
              <strong class="buyer-card-name">${fmt.escape(u.usuario)}</strong>
              <span class="buyer-card-meta">${qtdItens} ${qtdItens === 1 ? "item" : "itens"}${qtdPedidos > 1 ? ` · <span style="color:#d97706;font-weight:600">${qtdPedidos} pedidos separados</span>` : ''}${emEdicao ? ' · <span style="color:#d97706;font-weight:600">Em edição</span>' : ""}</span>
            </div>
            <div class="buyer-card-value">
              <strong>${fmt.brl(totalFinal)}</strong>
              ${totalBruto !== totalFinal ? `<small style="text-decoration:line-through;color:var(--c-text-muted);font-size:0.75rem">${fmt.brl(totalBruto)}</small>` : ""}
            </div>
            <span class="buyer-card-chevron">&#9662;</span>
          </div>
          <div class="buyer-card-detail" id="buyerDetail-${idx}" style="display:none">
            <div class="buyer-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();app.adminVerHistorico('${usuarioEsc}','${fmt.escape(u.telefone || '').replace(/'/g, "\\'")}')">${icon("receipt")} Histórico</button>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();app.showAdminAddItem(${u.pedido_ids[0]},'${usuarioEsc}')">${icon("plus")} Adicionar item</button>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();app.showEditCompradorModal(${u.comprador_id || 0}, '${usuarioEsc}', '${(u.telefone||"").replace(/'/g,"\\'")}', '${(u.email||"").replace(/'/g,"\\'")}')" ${!u.comprador_id ? 'disabled title="Sem ID de comprador"' : ''}>${icon("user")} Editar dados</button>
              ${emEdicao || qtdPedidos > 1
                ? `<button class="btn btn-secondary btn-sm" style="background:#059669;color:#fff;border-color:#059669" onclick="event.stopPropagation();app.adminConfirmarPedido('${usuarioEsc}')">${icon("check")} Confirmar pedido</button>`
                : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();app.adminLiberarEdicao('${usuarioEsc}')">${icon("refresh")} Liberar para edição</button>`
              }
              ${qtdPedidos > 1
                ? `<button class="btn btn-secondary btn-sm" style="background:#d97706;color:#fff;border-color:#d97706" onclick="event.stopPropagation();app.adminMergeOrders('${usuarioEsc}')">${icon("refresh")} Mesclar ${qtdPedidos} pedidos</button>`
                : ''}
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();app.deletePedidoUsuario('${usuarioEsc}')">${icon("trash")} Apagar pedido</button>
            </div>
            <table class="data-table">
              <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Final</th><th></th></tr></thead>
              <tbody>${itensRows}</tbody>
            </table>
            <div class="user-total-row">
              ${qtdItens} itens · Bruto: <strong>${fmt.brl(totalBruto)}</strong> · Final: <strong>${fmt.brl(totalFinal)}</strong>
            </div>
          </div>
        </div>`;
    }).join("")}</div>`;
  },

  /* Refresh discount progress then re-render admin panel.
     Called after any mutation that affects cycle totals. */
  // SECTION: Debounced admin refresh — prevents overlapping API calls (race conditions)
  async refreshAdmin() {
    // Coalesce overlapping refreshes while guaranteeing a final fresh render.
    if (this._refreshAdminInFlight) {
      this._refreshAdminPending = true;
      return this._refreshAdminInFlight;
    }
    const run = (async () => {
      do {
        this._refreshAdminPending = false;
        await this.renderAdmin();
      } while (this._refreshAdminPending);
    })();
    this._refreshAdminInFlight = run;
    try {
      return await run;
    } finally {
      this._refreshAdminInFlight = null;
    }
  },

  async adminMergeOrders(usuario) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(
      `Mesclar pedidos duplicados de "${usuario}"?\n\n` +
      `Os pedidos serão unificados em um só, mantendo os itens sem duplicar. ` +
      `Os pedidos extras serão removidos.`
    ))) return;
    const r = await this.api(
      `pedidos/usuario/${encodeURIComponent(usuario)}/merge`, "PUT", {}
    );
    if (r?.success) {
      this.toast(r.message || "Pedidos mesclados", "success");
      this.refreshAdmin();
    } else {
      this.toast(r?.error || "Erro ao mesclar pedidos", "error");
    }
  },

  async adminConfirmarPedido(usuario) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(
      `Confirmar o pedido de "${usuario}"?\n\nO status será revertido de "em edição" para "pendente".`
    ))) return;
    const r = await this.api(
      `pedidos/usuario/${encodeURIComponent(usuario)}/status`, "PUT",
      { status: "pendente" }
    );
    if (r?.success) {
      this.toast(`Pedido de ${usuario} confirmado`, "success");
      this.refreshAdmin();
    } else {
      this.toast(r?.error || "Erro ao confirmar pedido", "error");
    }
  },

  async adminLiberarEdicao(usuario) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(
      `Liberar o pedido de "${usuario}" para edição?\n\n` +
      `O comprador poderá remover itens, alterar quantidades ou ` +
      `adicionar novos produtos. Útil quando um item está em falta no fornecedor.`
    ))) return;
    const r = await this.api(
      `pedidos/usuario/${encodeURIComponent(usuario)}/status`, "PUT",
      { status: "aberto_edicao" }
    );
    if (r?.success) {
      this.toast(`Pedido de ${usuario} liberado para edição`, "success");
      this.refreshAdmin();
    } else {
      this.toast(r?.error || "Erro ao liberar pedido", "error");
    }
  },

  showAdminAddItem(pedidoId, usuario) {
    if (!this.canManageSelectedCycle()) return;
    // Modal para admin selecionar produto e quantidade para adicionar ao pedido
    const pct = this.state.discountPct || 0;
    const prodOptions = PRODUTOS.map(
      (p) => `<option value="${p.codigo}" data-preco="${p.preco}" data-nome="${fmt.escape(p.nome)}" data-cat="${p.categoria || ''}">${p.nome} — ${fmt.brl(p.preco)}</option>`
    ).join("");

    const wrap = document.getElementById("confirmModalWrap");
    wrap.innerHTML = `
      <div class="modal-overlay" id="addItemOverlay">
        <div class="modal-content" style="max-width:420px">
          <div class="modal-header" style="padding:20px 24px 8px">
            <h2 style="font-size:1.1rem">Adicionar item — ${fmt.escape(usuario)}</h2>
          </div>
          <div class="modal-body" style="padding:8px 24px 16px">
            <div class="form-group">
              <label for="adminAddProduto">Produto</label>
              <select id="adminAddProduto" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--c-border);font-size:0.95rem;background:var(--c-surface)">
                ${prodOptions}
              </select>
            </div>
            <div class="form-group">
              <label for="adminAddQty">Quantidade</label>
              <input type="number" id="adminAddQty" value="1" min="1" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--c-border);font-size:0.95rem" />
            </div>
            ${pct > 0 ? `<p style="font-size:0.85rem;color:var(--c-text-muted)">Desconto atual: ${pct}% será aplicado automaticamente.</p>` : ''}
          </div>
          <div class="modal-footer" style="padding:8px 24px 20px">
            <button class="btn btn-ghost" onclick="document.getElementById('confirmModalWrap').innerHTML=''">Cancelar</button>
            <button class="btn btn-primary" onclick="app.adminAddItem(${pedidoId})">Adicionar</button>
          </div>
        </div>
      </div>`;
  },

  async adminChangeQty(itemId, newQty) {
    if (!this.canManageSelectedCycle()) return;
    const qty = Number(newQty);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      this.toast("Use o botão de lixeira para remover", "info");
      return;
    }
    if (qty > 99) {
      this.toast("Quantidade máxima é 99", "error");
      return;
    }
    const r = await this.api(`itens/${itemId}/qty`, "PUT", { quantidade: qty });
    if (r?.success) {
      this.refreshAdmin();
    } else {
      this.toast(r?.error || "Erro ao alterar quantidade", "error");
    }
  },

  // SECTION: Direct qty input from admin panel (not just +/- unitary)
  adminSetQty(itemId, value) {
    const qty = Number(value);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      this.toast("Quantidade inválida", "error");
      this.refreshAdmin();
      return;
    }
    if (qty > 99) {
      this.toast("Quantidade máxima é 99", "error");
      this.refreshAdmin();
      return;
    }
    this.adminChangeQty(itemId, qty);
  },

  async adminAddItem(pedidoId) {
    if (!this.canManageSelectedCycle()) return;
    const sel = document.getElementById("adminAddProduto");
    const qty = parseInt(document.getElementById("adminAddQty").value) || 1;
    const opt = sel.options[sel.selectedIndex];
    const codigo = sel.value;
    const nome = opt.dataset.nome;
    const precoBruto = parseFloat(opt.dataset.preco);
    const cat = opt.dataset.cat;
    const pct = this.state.discountPct || 0;
    const precoDesconto = pct > 0 ? precoBruto * (1 - pct / 100) : precoBruto;

    const r = await this.api(`pedidos/${pedidoId}/itens`, "PUT", {
      codigo,
      nome,
      quantidade: qty,
      preco_bruto: precoBruto,
      preco_desconto: precoDesconto,
      categoria: cat,
    });

    document.getElementById("confirmModalWrap").innerHTML = "";

    if (r?.success) {
      this.toast(`${nome} adicionado ao pedido`, "success");
      this.refreshAdmin();
    } else {
      this.toast(r?.error || "Erro ao adicionar item", "error");
    }
  },

  adminVerHistorico(usuario, telefone) {
    // Troca para a aba histórico mostrando os pedidos do comprador escolhido
    this.switchTab("historico");
    this.renderHistorico(usuario, telefone);
  },

  selectAdminCycle(cycleId) {
    this.state.adminCycleId = Number(cycleId) || null;
    this.renderAdmin();
  },

  canManageSelectedCycle() {
    if (this.state.adminCycleIsActive) return true;
    this.toast("O ciclo encerrado é somente para consulta", "info");
    return false;
  },

  async deletePedidoUsuario(usuario) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(`Apagar TODOS os pedidos de "${usuario}"?`))) return;
    const r = await this.api(`pedidos/usuario/${encodeURIComponent(usuario)}`, "DELETE");
    if (r?.success) {
      this.toast(`Pedidos de ${usuario} apagados`, "success");
      this.refreshAdmin();
    } else {
      this.toast("Erro ao apagar pedido", "error");
    }
  },

  async removeItemFromPedido(itemId, nome) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(`Remover o item "${nome}" deste pedido? Os demais itens serão mantidos.`))) return;
    const r = await this.api(`itens/${itemId}`, "DELETE");
    if (r?.success) {
      this.toast("Item removido", "success");
      this.refreshAdmin();
    } else {
      this.toast("Erro ao remover item", "error");
    }
  },

  async removeProdutoGlobal(codigo, nome) {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm(
      `Remover o produto "${nome}" (${codigo}) de TODOS os pedidos?\n\n` +
      `Use esta opção quando o fornecedor estiver em falta. ` +
      `Os demais itens dos pedidos serão mantidos.`
    ))) return;
    const r = await this.api(`produtos/${encodeURIComponent(codigo)}`, "DELETE");
    if (r?.success) {
      this.toast(`Produto ${codigo} removido dos pedidos`, "success");
      this.refreshAdmin();
    } else {
      this.toast("Erro ao remover produto", "error");
    }
  },

  async applyDiscount() {
    if (!this.canManageSelectedCycle()) return;
    if (!this.state.isAdminLoggedIn) {
      this.toast("Apenas o administrador pode alterar o desconto", "error");
      return;
    }
    const pct = Math.max(
      0,
      Math.min(100, parseFloat(document.getElementById("discPctInput").value) || 0)
    );
    this.state.discountPct = pct;
    // Persistimos no backend sob categoria "todos" (compatível com API legada).
    await this.api("descontos", "POST", {
      categoria: "todos",
      percentual: pct,
    });
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
    this.refreshAdmin();
    this.toast(
      pct > 0 ? `Desconto global de ${pct}% aplicado` : "Desconto removido",
      "success"
    );
  },

  async clearDiscounts() {
    if (!this.canManageSelectedCycle()) return;
    if (!this.state.isAdminLoggedIn) {
      this.toast("Apenas o administrador pode remover o desconto", "error");
      return;
    }
    this.state.discountPct = 0;
    await this.api("descontos", "DELETE");
    this.saveLocal();
    this.renderProducts();
    this.updateCartBar();
    this.refreshAdmin();
    this.toast("Desconto removido", "success");
  },

  async clearAllOrders() {
    if (!(await customConfirm("Apagar TODOS os pedidos atuais?"))) return;
    if (!(await customConfirm("Confirmação final — esta ação é irreversível."))) return;
    await this.api("pedidos", "DELETE");
    this.refreshAdmin();
    this.toast("Pedidos apagados", "info");
  },

  async clearAllHistory() {
    if (!(await customConfirm("Apagar TODO o histórico de pedidos (incluindo pedidos antigos e atuais)?"))) return;
    if (!(await customConfirm("Confirmação final — esta ação é irreversível. Todos os pedidos de todos os compradores serão removidos."))) return;
    await this.api("pedidos", "DELETE");
    this.refreshAdmin();
    this.toast("Histórico completo apagado", "info");
  },

  exitAdmin() {
    this.clearAdminSession();
    this.saveLocal();
    const tabAdmin = document.getElementById("tabAdmin");
    if (tabAdmin) tabAdmin.hidden = true;
    this.switchTab("produtos");
    this.toast("Saiu do painel admin", "info");
  },

  // Tabela pronta para copy/paste no Excel do fornecedor.
  renderSupplierOrderTable(con) {
    if (!con.length)
      return `<div style="padding:24px;text-align:center;color:var(--c-text-muted)">Nenhum pedido registrado ainda.</div>`;
    // Ordena por nome para facilitar localização no catálogo Vitafor
    const sorted = [...con].sort((a, b) =>
      String(a.nome).localeCompare(String(b.nome))
    );
    let totalQtd = 0;
    let totalValor = 0;
    const rows = sorted
      .map((i) => {
        const qtd = parseInt(i.quantidade_total);
        const valor = parseFloat(i.total_bruto);
        totalQtd += qtd;
        totalValor += valor;
        return `<tr>
          <td><strong>${fmt.escape(i.codigo)}</strong></td>
          <td>${fmt.escape(i.nome)}</td>
          <td style="text-align:center;font-weight:700;font-size:1.05rem;color:var(--c-brand)">${qtd}</td>
          <td>${fmt.brl(valor)}</td>
        </tr>`;
      })
      .join("");
    return `
      <table class="data-table supplier-table">
        <thead>
          <tr>
            <th style="width:110px">Código</th>
            <th>Produto</th>
            <th style="width:100px;text-align:center">Qtd. total</th>
            <th style="width:140px">Valor bruto</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">TOTAL GERAL</td>
            <td style="text-align:center">${totalQtd}</td>
            <td>${fmt.brl(totalValor)}</td>
          </tr>
        </tbody>
      </table>`;
  },

  async exportPedidoFornecedor() {
    const cycleQuery = this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : "";
    const conRes = await this.api(`pedidos/consolidado${cycleQuery}`);
    const con = conRes?.data || [];
    if (!con.length) {
      this.toast("Nenhum pedido para exportar", "error");
      return;
    }
    if (typeof XLSX === "undefined") {
      this.toast("Biblioteca Excel indisponível", "error");
      return;
    }
    const sorted = [...con].sort((a, b) =>
      String(a.nome).localeCompare(String(b.nome))
    );
    // Linha de cabeçalho + dados
    const aoa = [
      ["PEDIDO CONSOLIDADO — COMPRA COLETIVA VIDA FORTE"],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [`Desconto global aplicado: ${this.state.discountPct}%`],
      [],
      ["Código", "Produto", "Quantidade", "Valor unitário", "Valor bruto", "Valor final"],
    ];
    let totalQtd = 0,
      totalBruto = 0,
      totalFinal = 0;
    sorted.forEach((i) => {
      const qtd = parseInt(i.quantidade_total);
      const vb = parseFloat(i.total_bruto);
      const vf = parseFloat(i.total_final);
      const unit = qtd > 0 ? vb / qtd : 0;
      totalQtd += qtd;
      totalBruto += vb;
      totalFinal += vf;
      aoa.push([i.codigo, i.nome, qtd, unit, vb, vf]);
    });
    aoa.push([]);
    aoa.push(["TOTAL GERAL", "", totalQtd, "", totalBruto, totalFinal]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Larguras de coluna
    ws["!cols"] = [
      { wch: 14 },
      { wch: 60 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    // Merge do título
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido Fornecedor");

    // Segunda aba: por comprador
    const usersRes = await this.api(`pedidos/por-usuario${cycleQuery}`);
    const users = usersRes?.data || [];
    if (users.length) {
      const aoa2 = [
        ["PEDIDO DETALHADO POR COMPRADOR"],
        [],
        ["Comprador", "Telefone", "E-mail", "Código", "Produto", "Qtd", "Bruto", "Final"],
      ];
      users.forEach((u) => {
        (u.itens || []).forEach((it) => {
          aoa2.push([
            u.usuario,
            u.telefone || "",
            u.email || "",
            it.codigo,
            it.nome,
            it.quantidade,
            it.preco_bruto * it.quantidade,
            it.preco_desconto * it.quantidade,
          ]);
        });
      });
      const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
      ws2["!cols"] = [
        { wch: 28 },
        { wch: 16 },
        { wch: 26 },
        { wch: 12 },
        { wch: 50 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
      ];
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
      XLSX.utils.book_append_sheet(wb, ws2, "Por Comprador");
    }

    const filename = `pedido_fornecedor_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, filename);
    this.toast("Planilha exportada", "success");
  },

  async exportCSV() {
    const cycleQuery = this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : "";
    const conRes = await this.api(`pedidos/consolidado${cycleQuery}`);
    const usersRes = await this.api(`pedidos/por-usuario${cycleQuery}`);
    const con = conRes?.data || [];
    const users = usersRes?.data || [];
    let csv = "\uFEFFCOMPRAS COLETIVAS — VIDA FORTE\n";
    csv += `Exportado em: ${new Date().toLocaleDateString("pt-BR")}\n`;
    csv += `Desconto global: ${this.state.discountPct}%\n\n`;
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
      csv += `\n${u.usuario} — ${u.telefone || ""} ${u.email || ""}\nCódigo;Produto;Qtd;Bruto;Final\n`;
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
  /* ----------------- Pagamentos ----------------- */
  async renderPagamentos() {
    const c = document.getElementById("adminContent");
    c.innerHTML = `<div class="card"><div class="empty-state">${icon("refresh")}<h3>Carregando pagamentos...</h3></div></div>`;

    const cycleQuery = this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : "";
    const [pgRes, resRes] = await Promise.all([
      this.api(`pagamentos${cycleQuery}`),
      this.api(`pagamentos/resumo${cycleQuery}`),
    ]);

    const pagamentos = pgRes?.data || [];
    const resumo = resRes?.data || {};

    if (!pagamentos.length) {
      c.innerHTML = `
        <div class="card">
          <div class="empty-state">
            ${icon("receipt")}
            <h3>Nenhum pagamento registrado</h3>
            <p>Clique em "Inicializar pagamentos" para criar registros a partir dos pedidos existentes.</p>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
              <button class="btn btn-primary" onclick="app.initPagamentos()">${icon("plus")} Inicializar pagamentos</button>
              <button class="btn btn-ghost" onclick="app.renderAdmin()">← Voltar</button>
            </div>
          </div>
        </div>`;
      return;
    }

    const totalCompras = parseFloat(resumo.total_compras) || 0;
    const totalRecebido = parseFloat(resumo.total_recebido) || 0;
    const totalPendente = parseFloat(resumo.total_pendente) || 0;

    const rows = pagamentos.map((pg) => {
      const tp = parseFloat(pg.total_pago) || 0;
      const td = parseFloat(pg.total_devido) || 0;
      const vc = parseFloat(pg.valor_compra) || 0;
      const rowColor = td <= 0 ? "color:var(--c-success)" : td > 0 && tp > 0 ? "color:#d97706" : "";
      return `
        <tr style="cursor:pointer;${rowColor}" onclick="app.editPagamento(${pg.id})">
          <td><strong>${fmt.escape(pg.comprador)}</strong></td>
          <td>${fmt.brl(vc)}</td>
          <td>${pg.parc1 != null ? fmt.brl(pg.parc1) : "—"}</td>
          <td>${pg.parc2 != null ? fmt.brl(pg.parc2) : "—"}</td>
          <td>${pg.parc3 != null ? fmt.brl(pg.parc3) : "—"}</td>
          <td><strong>${fmt.brl(tp)}</strong></td>
          <td style="font-weight:700;${td <= 0 ? 'color:var(--c-success)' : 'color:#dc2626'}">${fmt.brl(td)}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();app.editPagamento(${pg.id})">${icon("edit") || '✏'} Editar</button></td>
        </tr>`;
    }).join("");

    c.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px">
            ${icon("receipt")}
            <strong style="font-size:1.05rem">Controle de Pagamentos</strong>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="app.initPagamentos()">${icon("plus")} Inicializar</button>
            <button class="btn btn-secondary btn-sm" onclick="app.renderPagamentos()">${icon("refresh")} Atualizar</button>
            <button class="btn btn-ghost btn-sm" onclick="app.renderAdmin()">← Voltar</button>
          </div>
        </div>
        <div class="stats-grid" style="margin:0 20px 16px">
          <div class="stat-card">
            <div class="stat-card-icon">${icon("users")}</div>
            <div class="stat-card-body"><small>Compradores</small><strong>${resumo.total_compradores || 0}</strong></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon">${icon("dollar")}</div>
            <div class="stat-card-body"><small>Total Compras</small><strong>${fmt.brl(totalCompras)}</strong></div>
          </div>
          <div class="stat-card stat-highlight">
            <div class="stat-card-icon">${icon("check")}</div>
            <div class="stat-card-body"><small>Total Recebido</small><strong style="color:var(--c-success)">${fmt.brl(totalRecebido)}</strong></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon">${icon("alert")}</div>
            <div class="stat-card-body"><small>Total Pendente</small><strong style="color:#dc2626">${fmt.brl(totalPendente)}</strong></div>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Valor Compra</th>
                <th>Parc 1</th>
                <th>Parc 2</th>
                <th>Parc 3</th>
                <th>Total Pago</th>
                <th>Total Devido</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td>${fmt.brl(totalCompras)}</td>
                <td colspan="3"></td>
                <td><strong>${fmt.brl(totalRecebido)}</strong></td>
                <td style="color:#dc2626"><strong>${fmt.brl(totalPendente)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  },

  async initPagamentos() {
    if (!this.canManageSelectedCycle()) return;
    if (!(await customConfirm("Inicializar registros de pagamento para pedidos que ainda não têm?\n\nIsso criará um registro para cada pedido ativo (não cancelado)."))) return;
    const r = await this.api("pagamentos/inicializar", "POST");
    if (r?.success) {
      this.toast(r.message || "Pagamentos inicializados", "success");
      this.renderPagamentos();
    } else {
      this.toast(r?.error || "Erro ao inicializar pagamentos", "error");
    }
  },

  editPagamento(id) {
    if (!this.canManageSelectedCycle()) return;
    // Busca dados do pagamento do estado atual
    // Primeiro precisa ter os dados carregados; se não, busca
    const openEditModal = (pg) => {
      const wrap = document.getElementById("confirmModalWrap");
      wrap.innerHTML = `
        <div class="modal-overlay" id="editPgOverlay">
          <div class="modal-content" style="max-width:460px">
            <div class="modal-header" style="padding:20px 24px 8px">
              <h2 style="font-size:1.1rem">Editar Pagamento — ${fmt.escape(pg.comprador)}</h2>
              <p style="font-size:0.85rem;color:var(--c-text-muted)">Valor da compra: ${fmt.brl(pg.valor_compra)}</p>
            </div>
            <div class="modal-body" style="padding:8px 24px 16px">
              ${[1,2,3].map(i => `
                <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <label style="min-width:60px;font-weight:600;font-size:0.88rem" for="pgParc${i}">Parcela ${i}</label>
                  <input type="number" id="pgParc${i}" value="${pg["parc"+i] != null ? pg["parc"+i] : ""}" step="0.01" min="0" placeholder="0,00" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--c-border);font-size:0.95rem" />
                </div>`).join("")}
              <div class="form-group" style="margin-top:12px">
                <label for="pgObs" style="font-weight:600;font-size:0.88rem">Observações</label>
                <textarea id="pgObs" rows="2" placeholder="Notas sobre o pagamento..." style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--c-border);font-size:0.95rem;resize:vertical">${fmt.escape(pg.observacoes || "")}</textarea>
              </div>
            </div>
            <div class="modal-footer" style="padding:8px 24px 20px;display:flex;gap:10px">
              <button class="btn btn-ghost" onclick="document.getElementById('confirmModalWrap').innerHTML=''">Cancelar</button>
              <button class="btn btn-primary" style="flex:1" onclick="app.savePagamento(${id})">Salvar</button>
            </div>
          </div>
        </div>`;
    };

    // Se já temos os dados em cache, usa direto
    // Senão busca da API
    const cycleQuery = this.state.adminCycleId ? `?ciclo_id=${this.state.adminCycleId}` : "";
    this.api(`pagamentos${cycleQuery}`).then(res => {
      const pg = (res?.data || []).find(p => p.id === id);
      if (pg) openEditModal(pg);
      else this.toast("Pagamento não encontrado", "error");
    });
  },

  async savePagamento(id) {
    if (!this.canManageSelectedCycle()) return;
    const parc = {};
    for (let i = 1; i <= 3; i++) {
      const val = document.getElementById(`pgParc${i}`).value;
      parc[`parc${i}`] = val !== "" ? parseFloat(val) : null;
    }
    const observacoes = document.getElementById("pgObs").value.trim();
    const r = await this.api(`pagamentos/${id}`, "PUT", { ...parc, observacoes });
    document.getElementById("confirmModalWrap").innerHTML = "";
    if (r?.success) {
      this.toast("Pagamento atualizado", "success");
      this.renderPagamentos();
    } else {
      this.toast(r?.error || "Erro ao salvar pagamento", "error");
    }
  },

  /* ----------------- Histórico do comprador ----------------- */
  async renderHistorico(forcedUsuario, forcedTelefone) {
    const c = document.getElementById("historicoContent");
    if (!c) return;
    const usuario = forcedUsuario || this.state.user.name;
    const telefone = forcedTelefone || this.state.user.phone;
    if (!usuario) {
      c.innerHTML = `<div class="card"><div class="empty-state">${icon("user")}<h3>Faça login para ver seu histórico</h3><p>Entre com seu nome, telefone e PIN para visualizar suas compras anteriores.</p><button class="btn btn-primary" onclick="app.showRegistrationModal(false,'login')">Entrar</button></div></div>`;
      return;
    }
    c.innerHTML = `<div class="card"><div class="empty-state">${icon("refresh")}<h3>Carregando histórico...</h3></div></div>`;
    const params = new URLSearchParams();
    if (forcedUsuario) {
      params.set("usuario", usuario);
      params.set("telefone", telefone || "");
    }
    const res = await this.api(
      params.toString() ? `pedidos/historico?${params.toString()}` : "pedidos/historico",
      "GET",
      null,
      forcedUsuario ? "admin" : "buyer"
    );
    const pedidos = res?.data || [];
    const isAdminView = !!forcedUsuario;
    const header = isAdminView
      ? `<div class="card" style="margin-bottom:14px"><div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><strong>Histórico de ${fmt.escape(usuario)}</strong><br><small style="color:var(--c-text-muted)">${pedidos.length} pedido(s)</small></div><button class="btn btn-ghost btn-sm" onclick="app.renderAdmin()">← Voltar ao painel</button></div></div>`
      : `<div class="card" style="margin-bottom:14px"><div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><strong>Olá, ${fmt.escape(usuario.split(" ")[0])}</strong><br><small style="color:var(--c-text-muted)">${pedidos.length} pedido(s) no histórico</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="app.showEditProfileModal()">${icon("user")||'👤'} Meus dados</button><button class="btn btn-ghost btn-sm" onclick="app.logoutUser()">Sair da conta</button></div></div></div>`;
    if (!pedidos.length) {
      c.innerHTML = header + `<div class="card"><div class="empty-state">${icon("receipt")}<h3>Nenhum pedido encontrado</h3><p>Assim que você finalizar um pedido, ele aparecerá aqui.</p></div></div>`;
      return;
    }
    const blocks = pedidos.map((p) => {
      const data = new Date(p.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
      const itens = (p.itens || []).filter(it => it && it.codigo).map((it) => `
        <tr>
          <td>${fmt.escape(it.codigo)}</td>
          <td>${fmt.escape(it.nome)}</td>
          <td>${it.quantidade}</td>
          <td>${fmt.brl(it.subtotal_bruto)}</td>
          <td>${fmt.brl(it.subtotal_final)}</td>
        </tr>`).join("");
      const statusMap = {
        cancelado: '<span style="color:#dc2626">Cancelado</span>',
        pendente: '<span style="color:var(--c-text-muted)">Pendente</span>',
        confirmado: '<span style="color:var(--c-brand)">Confirmado</span>',
        entregue: '<span style="color:var(--c-brand)">Entregue</span>',
        aberto_edicao: '<span style="color:#d97706;font-weight:600">Aberto para edição</span>',
      };
      const statusLabel = statusMap[p.status] || p.status;
      const editBtn = p.status === "aberto_edicao" && !isAdminView
        ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="app.switchTab('meu-pedido')">Editar meu pedido</button>`
        : "";
      return `
        <div class="card report-card" style="margin-bottom:14px">
          <div class="report-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <span>${icon("receipt")} ${fmt.escape(p.ciclo_nome || "Ciclo não identificado")} · Pedido #${p.id} · ${data}</span>
            <span style="font-size:0.85rem;color:var(--c-text-muted)">${statusLabel}</span>
          </div>
          <table class="data-table">
            <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Final</th></tr></thead>
            <tbody>${itens}</tbody>
          </table>
          <div class="user-total-row">
            Bruto: <strong>${fmt.brl(p.total_bruto)}</strong> ·
            Desconto: <strong>${fmt.brl(p.total_desconto || 0)}</strong> ·
            Final: <strong>${fmt.brl(p.total_final)}</strong>
            ${editBtn}
          </div>
        </div>`;
    }).join("");
    c.innerHTML = header + blocks;
  },

  saveLocal() {
    localStorage.setItem("cart", JSON.stringify(this.state.cart));
    localStorage.setItem("discountPct", String(this.state.discountPct || 0));
    localStorage.setItem("lastOrder", JSON.stringify(this.state.lastOrder || null));
  },
  loadLocal() {
    try {
      const c = localStorage.getItem("cart");
      const d = localStorage.getItem("discountPct");
      const theme = localStorage.getItem("theme");
      const lo = localStorage.getItem("lastOrder");
      if (c) this.state.cart = JSON.parse(c);
      if (d) this.state.discountPct = parseFloat(d) || 0;
      if (theme === "dark" || theme === "light") this.state.theme = theme;
      if (lo && lo !== "null") this.state.lastOrder = JSON.parse(lo);
    } catch (e) {
      this.state.cart = {};
      this.state.discountPct = 0;
    }
  },
};

// Inicializa app quando o DOM estiver pronto.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => app.init());
} else {
  app.init();
}
