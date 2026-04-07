// ============================================================
// App Compras Coletivas — Vida Forte v5.1
// Backend: Neon PostgreSQL via Vercel Serverless
// Novo: Interface de categorias melhorada + paginação
// ============================================================
const API = '/api/db';

const app = {
    currentUser: '',
    currentPhone: '',
    currentEmail: '',
    cart: {},
    allOrders: {},
    isAdminLoggedIn: false,
    currentCat: 'todos',
    discounts: {},
    faixasDesconto: [], // Novo: faixas progressivas
    useServer: true,
    
    // Novo: Paginação e categorias
    currentPage: 1,
    itemsPerPage: 24,
    categoriesExpanded: false,

    async init() {
        this.loadLocal();
        this.setupEventListeners();
        this.renderCategoryGrid();
        this.renderCategoryPills();
        this.renderProducts();
        this.updateCartBar();
        const saved = localStorage.getItem('currentUser');
        if (saved) { this.currentUser = saved; this.setUserInputs(saved); }
        const savedPhone = localStorage.getItem('currentPhone');
        if (savedPhone) this.currentPhone = savedPhone;
        const savedEmail = localStorage.getItem('currentEmail');
        if (savedEmail) this.currentEmail = savedEmail;
        await this.loadDiscountsFromServer();
        await this.loadFaixasDescontoFromServer();
    },

    // ===== SERVER COMMUNICATION =====
    async api(path, method = 'GET', body = null) {
        try {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(`${API}/${path}`, opts);
            const data = await res.json();
            return data;
        } catch (e) {
            console.warn('API offline, using localStorage fallback:', e.message);
            this.useServer = false;
            return null;
        }
    },

    async loadDiscountsFromServer() {
        const res = await this.api('descontos');
        if (res && res.success && res.data) {
            this.discounts = {};
            res.data.forEach(d => { this.discounts[d.categoria] = parseFloat(d.percentual); });
            this.renderProducts(document.getElementById('searchInput').value);
            this.updateCartBar();
        }
    },

    async loadFaixasDescontoFromServer() {
        const res = await this.api('faixas-desconto');
        if (res && res.success && res.data) {
            this.faixasDesconto = res.data;
            this.updateCartBar();
        }
    },

    calcularDescontoProgressivo(totalBruto) {
        if (!totalBruto || !this.faixasDesconto.length) return 0;
        
        // Encontrar a faixa aplicável
        const faixa = this.faixasDesconto
            .filter(f => f.ativo)
            .find(f => totalBruto >= f.valor_minimo && (f.valor_maximo === null || totalBruto < f.valor_maximo));
        
        return faixa ? parseFloat(faixa.percentual) : 0;
    },

    // ===== USER =====
    setUserInputs(n) {
        const d = document.getElementById('userName'), m = document.getElementById('userNameMobile');
        if (d) d.value = n; if (m) m.value = n;
    },
    handleUserNameChange(v) {
        this.currentUser = v.trim();
        localStorage.setItem('currentUser', this.currentUser);
        this.setUserInputs(this.currentUser);
    },
    handlePhoneChange(v) {
        this.currentPhone = v.trim();
        localStorage.setItem('currentPhone', this.currentPhone);
    },
    handleEmailChange(v) {
        this.currentEmail = v.trim();
        localStorage.setItem('currentEmail', this.currentEmail);
    },

    // ===== EVENTS =====
    setupEventListeners() {
        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', e => this.switchTab(e.currentTarget.dataset.tab)));
        let st; document.getElementById('searchInput').addEventListener('input', e => { 
            clearTimeout(st); 
            st = setTimeout(() => {
                this.currentPage = 1; // Reset página ao buscar
                this.renderProducts(e.target.value);
            }, 150); 
        });
        const d = document.getElementById('userName'), m = document.getElementById('userNameMobile');
        [d, m].forEach(el => { if (el) { el.addEventListener('change', e => this.handleUserNameChange(e.target.value)); el.addEventListener('blur', e => this.handleUserNameChange(e.target.value)); } });
    },

    switchTab(t) {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelector(`[data-tab="${t}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${t}`)?.classList.remove('hidden');
        if (t === 'meu-pedido') this.renderMyCart();
        else if (t === 'admin' && this.isAdminLoggedIn) this.renderAdminPanel();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ===== DESCONTO =====
    getDiscount(catId) {
        if (this.discounts['todos'] > 0) return this.discounts['todos'];
        return this.discounts[catId] || 0;
    },
    getDiscountedPrice(preco, catId) {
        const pct = this.getDiscount(catId);
        return pct > 0 ? preco * (1 - pct / 100) : preco;
    },

    // ===== CATEGORIAS GRID =====
    getCategories() {
        const seen = new Set();
        const cats = [];
        PRODUTOS.forEach(p => {
            if (!seen.has(p.categoria)) {
                seen.add(p.categoria);
                cats.push({ 
                    id: p.categoria, 
                    nome: p.categoriaNome,
                    count: PRODUTOS.filter(x => x.categoria === p.categoria).length
                });
            }
        });
        return cats.sort((a, b) => a.nome.localeCompare(b.nome));
    },

    getCategoryIcon(catId) {
        const icons = {
            'whey_fort': '💪', 'whey_protein_isolate': '💪', 'creatine': '💪', 'creafort': '💪',
            'aminovita': '⚡', 'bcaafort': '⚡', 'arginofor': '⚡', 'glutamax': '⚡',
            'colagentek': '✨', 'colagentek_beauty': '✨', 'hyaluronic_hair': '✨',
            'omegafor': '🐟', 'mega_dha': '🐟', 'omegafor_plus': '🐟',
            'vita_d3': '☀️', 'vita_c3': '🍊', 'vitamina_b12': '💊',
            'termoplus': '🔥', 'v_fort_intenso': '🔥', 'endurance': '🔥',
            'simfort': '🌿', 'colosfort': '🌿', 'enzyfor': '🌿',
            'isofort': '🥛', 'isofort_plant': '🥛', 'sustevit': '🥛',
            'carbofor': '🏃', 'palatinose': '🏃', 'mct': '🏃',
            'fitzei': '🍎', 'choco_family': '🍫', 'xilitol_family': '🍫'
        };
        return icons[catId] || '📦';
    },

    toggleCategories() {
        this.categoriesExpanded = !this.categoriesExpanded;
        const grid = document.getElementById('categoryGrid');
        const btn = document.getElementById('toggleCatBtn');
        if (grid) grid.classList.toggle('hidden', !this.categoriesExpanded);
        if (btn) btn.textContent = this.categoriesExpanded ? '📂 Ocultar' : '📂 Categorias';
    },

    renderCategoryGrid() {
        const grid = document.getElementById('categoryGrid');
        if (!grid) return;
        
        const cats = this.getCategories();
        let html = `<div class="cat-card ${this.currentCat === 'todos' ? 'active' : ''}" onclick="app.selectCatFromGrid('todos')">
            <div class="cat-card-icon">📦</div>
            <div class="cat-card-name">Todos</div>
            <div class="cat-card-count">${PRODUTOS.length} produtos</div>
        </div>`;
        
        cats.forEach(cat => {
            html += `<div class="cat-card ${this.currentCat === cat.id ? 'active' : ''}" onclick="app.selectCatFromGrid('${cat.id}')">
                <div class="cat-card-icon">${this.getCategoryIcon(cat.id)}</div>
                <div class="cat-card-name">${cat.nome}</div>
                <div class="cat-card-count">${cat.count} produtos</div>
            </div>`;
        });
        
        grid.innerHTML = html;
    },

    selectCatFromGrid(id) {
        this.currentCat = id;
        this.currentPage = 1;
        this.renderCategoryGrid();
        this.renderCategoryPills();
        this.renderProducts(document.getElementById('searchInput').value);
        
        // Scroll para produtos
        document.getElementById('productsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // ===== CATEGORIAS PILLS (mantido para compatibilidade) =====
    renderCategoryPills() {
        const c = document.getElementById('catPills'); if (!c) return;
        const cats = this.getCategories();
        let html = `<button class="cat-pill ${this.currentCat === 'todos' ? 'active' : ''}" onclick="app.selectCat('todos')">Todos (${PRODUTOS.length})</button>`;
        cats.forEach(cat => {
            html += `<button class="cat-pill ${this.currentCat === cat.id ? 'active' : ''}" onclick="app.selectCat('${cat.id}')">${cat.nome}</button>`;
        });
        c.innerHTML = html;
    },

    selectCat(id) { 
        this.currentCat = id; 
        this.currentPage = 1;
        this.renderCategoryGrid();
        this.renderCategoryPills(); 
        this.renderProducts(document.getElementById('searchInput').value); 
    },

    // ===== PRODUTOS COM PAGINAÇÃO =====
    renderProducts(search = '') {
        const grid = document.getElementById('productsGrid');
        const countEl = document.getElementById('searchCount');
        
        // Filtrar
        let filtered = PRODUTOS.filter(p => {
            const s = search.toLowerCase();
            return (!s || p.nome.toLowerCase().includes(s) || p.codigo.toLowerCase().includes(s)) &&
                   (this.currentCat === 'todos' || p.categoria === this.currentCat);
        });
        
        // Total
        const total = filtered.length;
        if (countEl) countEl.textContent = `${total} produto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
        
        if (!total) { 
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><h3>Nenhum produto encontrado</h3><p>Tente outra busca ou categoria</p></div>`;
            document.getElementById('pagination').innerHTML = '';
            return; 
        }

        // Paginar
        const totalPages = Math.ceil(total / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = filtered.slice(start, end);

        // Renderizar cards
        grid.innerHTML = pageItems.map((p, i) => {
            const qty = this.cart[p.codigo] || 0;
            const disc = this.getDiscount(p.categoria);
            const dp = this.getDiscountedPrice(p.preco, p.categoria);
            const hasDisc = disc > 0;
            const hasImg = p.imagem && !p.imagem.endsWith('/') && p.imagem.length > 100;
            
            // Card com ou sem imagem
            let imgH;
            if (hasImg) {
                imgH = `<img class="product-img" src="${p.imagem}" alt="${p.nome}" onerror="this.parentElement.classList.add('no-image');this.outerHTML='<div class=product-no-img><div class=product-no-img-code>${p.codigo}</div><div class=product-no-img-name>${p.nome.substring(0,40)}</div></div>'" loading="lazy"/>`;
            } else {
                imgH = `<div class="product-no-img"><div class="product-no-img-code">${p.codigo}</div><div class="product-no-img-name">${p.nome.substring(0,40)}</div></div>`;
            }
            
            let prH = hasDisc 
                ? `<span class="price-full struck">R$ ${p.preco.toFixed(2)}</span><span class="price-discount">R$ ${dp.toFixed(2)}</span><span class="discount-badge">-${disc}%</span>`
                : `<span class="price-full">R$ ${p.preco.toFixed(2)}</span>`;
            
            return `<div class="product-card ${qty > 0 ? 'has-qty' : ''} ${!hasImg ? 'no-image' : ''}" style="animation-delay:${Math.min(i*.03,.3)}s">
                ${imgH}
                <div class="product-body">
                    <div class="product-card-header">
                        <span class="product-code">${p.codigo}</span>
                        <span class="product-emb">Emb: ${p.embalagem}</span>
                    </div>
                    <div class="product-name">${p.nome}</div>
                    <div class="product-prices">${prH}</div>
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="app.updateQty('${p.codigo}',-1)">−</button>
                        <input type="number" class="qty-input" value="${qty}" min="0" onchange="app.setQty('${p.codigo}',this.value)">
                        <button class="qty-btn" onclick="app.updateQty('${p.codigo}',1)">+</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Renderizar paginação
        this.renderPagination(totalPages);
    },

    renderPagination(totalPages) {
        const pag = document.getElementById('pagination');
        if (!pag || totalPages <= 1) { if (pag) pag.innerHTML = ''; return; }

        let html = `<button class="page-btn" onclick="app.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>←</button>`;
        
        // Mostrar páginas ao redor
        const start = Math.max(1, this.currentPage - 2);
        const end = Math.min(totalPages, this.currentPage + 2);
        
        if (start > 1) html += `<button class="page-btn" onclick="app.goToPage(1)">1</button>`;
        if (start > 2) html += `<span class="page-info">...</span>`;
        
        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="app.goToPage(${i})">${i}</button>`;
        }
        
        if (end < totalPages - 1) html += `<span class="page-info">...</span>`;
        if (end < totalPages) html += `<button class="page-btn" onclick="app.goToPage(${totalPages})">${totalPages}</button>`;
        
        html += `<button class="page-btn" onclick="app.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>→</button>`;
        html += `<span class="page-info">Página ${this.currentPage} de ${totalPages}</span>`;
        
        pag.innerHTML = html;
    },

    goToPage(page) {
        const totalPages = Math.ceil(PRODUTOS.filter(p => 
            (this.currentCat === 'todos' || p.categoria === this.currentCat)
        ).length / this.itemsPerPage);
        
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderProducts(document.getElementById('searchInput').value);
        
        // Scroll para o topo da grid
        document.getElementById('productsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    updateQty(cod, chg) {
        if (!this.currentUser) { this.toast('Digite seu nome primeiro!', 'error'); return; }
        const nq = Math.max(0, (this.cart[cod] || 0) + chg);
        if (nq === 0) delete this.cart[cod]; else this.cart[cod] = nq;
        if (chg > 0 && nq === 1) { const p = PRODUTOS.find(x => x.codigo === cod); if (p) this.toast(`${p.nome} adicionado`, 'success'); }
        this.saveLocal(); this.renderProducts(document.getElementById('searchInput').value); this.updateCartBar();
    },
    setQty(cod, v) {
        if (!this.currentUser) { this.toast('Digite seu nome!', 'error'); return; }
        const q = parseInt(v) || 0;
        if (q === 0) delete this.cart[cod]; else this.cart[cod] = Math.max(0, q);
        this.saveLocal(); this.updateCartBar();
    },

    // ===== CART BAR =====
    updateCartBar() {
        const items = Object.keys(this.cart).length;
        const { total, totalDisc, faixaPct } = this.calcTotals();
        const bar = document.getElementById('cartBar');
        if (bar) bar.classList.toggle('empty', items === 0);
        const ce = document.getElementById('cartCount'), te = document.getElementById('cartTotal'), td = document.getElementById('cartTotalDisc');
        if (ce) ce.innerHTML = `<strong>${items}</strong> ite${items === 1 ? 'm' : 'ns'}`;
        if (te) te.textContent = `R$ ${total.toFixed(2)}`;
        if (td) { 
            if (faixaPct > 0) {
                td.textContent = `→ R$ ${totalDisc.toFixed(2)} (${faixaPct}% faixa)`; 
                td.style.display = ''; 
            } else if (totalDisc < total) {
                td.textContent = `→ R$ ${totalDisc.toFixed(2)}`; 
                td.style.display = ''; 
            } else {
                td.style.display = 'none'; 
            }
        }
    },
    calcTotals(cart) {
        cart = cart || this.cart; let total = 0, totalDisc = 0;
        for (const [cod, qty] of Object.entries(cart)) { const p = PRODUTOS.find(x => x.codigo === cod); if (p) { total += p.preco * qty; totalDisc += this.getDiscountedPrice(p.preco, p.categoria) * qty; } }
        
        // Aplicar desconto progressivo por faixa de valor
        const faixaPct = this.calcularDescontoProgressivo(total);
        if (faixaPct > 0) {
            totalDisc = total * (1 - faixaPct / 100);
        }
        
        return { total, totalDisc, faixaPct };
    },

    // ===== MEU PEDIDO =====
    renderMyCart() {
        const c = document.getElementById('myCartContent');
        const items = Object.entries(this.cart);
        if (!items.length) { c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛒</div><h3>Pedido vazio</h3><p>Adicione produtos na aba Produtos</p></div>`; return; }
        const { total, totalDisc, faixaPct } = this.calcTotals();
        let h = '';
        if (this.currentUser) {
            h += `<div class="user-badge">👤 <strong>${this.currentUser}</strong></div>`;
            h += `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">`;
            h += `<input type="tel" id="userPhone" value="${this.currentPhone}" placeholder="📞 WhatsApp / Telefone" style="flex:1;min-width:150px;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:.85rem;font-family:var(--fb);background:var(--bg-card);color:var(--text)" oninput="app.handlePhoneChange(this.value)"/>`;
            h += `<input type="email" id="userEmail" value="${this.currentEmail}" placeholder="✉️ E-mail" style="flex:1;min-width:180px;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:.85rem;font-family:var(--fb);background:var(--bg-card);color:var(--text)" oninput="app.handleEmailChange(this.value)"/>`;
            h += `</div>`;
        }
        items.forEach(([cod, qty], i) => {
            const p = PRODUTOS.find(x => x.codigo === cod); if (!p) return;
            const sub = p.preco * qty, subD = this.getDiscountedPrice(p.preco, p.categoria) * qty, disc = this.getDiscount(p.categoria);
            h += `<div class="cart-item" style="animation-delay:${i*.04}s"><div class="cart-item-info"><h4>${p.nome}</h4><small>${cod} · R$ ${p.preco.toFixed(2)} × ${qty}</small></div><div class="cart-item-right"><div class="cart-item-prices"><div class="cart-item-subtotal">R$ ${sub.toFixed(2)}</div>${disc > 0 ? `<div class="cart-item-disc">c/ ${disc}%: R$ ${subD.toFixed(2)}</div>` : ''}</div><button class="btn-remove" onclick="app.removeFromCart('${cod}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div>`;
        });
        h += `<div class="order-total-bar"><div><div class="order-total-line" style="margin:0"><span>Total Bruto</span><h2>R$ ${total.toFixed(2)}</h2></div>`;
        if (totalDisc < total) {
            h += `<div class="order-total-line"><span>Com Desconto</span><h2 style="color:#FFD">R$ ${totalDisc.toFixed(2)}</h2></div>`;
            if (faixaPct > 0) {
                h += `<div class="order-total-line" style="font-size:0.85rem;color:#E07C24"><span>Faixa aplicada</span><strong>${faixaPct}%</strong></div>`;
            }
        }
        h += `</div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-primary" onclick="app.finalizeOrder()">Finalizar Pedido</button></div>`;
        c.innerHTML = h;
    },
    removeFromCart(cod) {
        const p = PRODUTOS.find(x => x.codigo === cod); delete this.cart[cod];
        this.saveLocal(); this.renderMyCart(); this.renderProducts(document.getElementById('searchInput').value); this.updateCartBar();
        if (p) this.toast(`${p.nome} removido`, 'error');
    },

    // ===== FINALIZAR PEDIDO =====
    async finalizeOrder() {
        if (!this.currentUser) { this.toast('Digite seu nome!', 'error'); return; }
        if (!this.currentPhone) { this.toast('Informe seu telefone em Meu Pedido!', 'error'); this.switchTab('meu-pedido'); return; }
        if (!this.currentEmail) { this.toast('Informe seu e-mail em Meu Pedido!', 'error'); this.switchTab('meu-pedido'); return; }
        if (!Object.keys(this.cart).length) { this.toast('Carrinho vazio!', 'error'); return; }
        const { total, totalDisc } = this.calcTotals();
        let msg = `${this.currentUser}, confirma o pedido?\n\nBruto: R$ ${total.toFixed(2)}`;
        if (totalDisc < total) msg += `\nCom desconto: R$ ${totalDisc.toFixed(2)}`;
        if (!confirm(msg)) return;

        const itens = Object.entries(this.cart).map(([cod, qty]) => {
            const p = PRODUTOS.find(x => x.codigo === cod);
            return {
                codigo: cod, nome: p ? p.nome : cod, quantidade: qty,
                preco_bruto: p ? p.preco : 0,
                preco_desconto: p ? this.getDiscountedPrice(p.preco, p.categoria) : 0,
                categoria: p ? p.categoria : ''
            };
        });

        const res = await this.api('pedidos', 'POST', { usuario: this.currentUser, telefone: this.currentPhone, email: this.currentEmail, itens });
        if (res && res.success) {
            this.toast('Pedido enviado ao servidor!', 'success');
        } else {
            if (!this.allOrders[this.currentUser]) this.allOrders[this.currentUser] = {};
            for (const [cod, qty] of Object.entries(this.cart)) {
                this.allOrders[this.currentUser][cod] = (this.allOrders[this.currentUser][cod] || 0) + qty;
            }
            this.toast('Pedido salvo localmente', 'success');
        }

        this.cart = {};
        this.saveLocal(); this.updateCartBar(); this.renderProducts();
        this.switchTab('meu-pedido');
    },

    // ===== ADMIN =====
    async loginAdmin() {
        const pwd = document.getElementById('adminPassword').value;
        const res = await this.api('admin/login', 'POST', { senha: pwd });
        if (res && res.success) {
            this.isAdminLoggedIn = true;
            document.getElementById('adminLoginSection').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            await this.renderAdminPanel();
            this.toast('Acesso liberado', 'success');
        } else { this.toast('Senha incorreta!', 'error'); }
    },

    async renderAdminPanel() {
        const c = document.getElementById('adminContent');
        c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando...</div>';

        const [statsRes, conRes, usersRes, discRes] = await Promise.all([
            this.api('stats'), this.api('pedidos/consolidado'),
            this.api('pedidos/por-usuario'), this.api('descontos')
        ]);

        const stats = statsRes?.data || {};
        const con = conRes?.data || [];
        const users = usersRes?.data || [];
        const discounts = discRes?.data || [];

        let h = `<div class="stats-bar">
            <div class="stat-card"><div class="stat-number">${stats.total_compradores || 0}</div><div class="stat-label">Compradores</div></div>
            <div class="stat-card"><div class="stat-number">${stats.produtos_distintos || 0}</div><div class="stat-label">Produtos</div></div>
            <div class="stat-card"><div class="stat-number">${stats.unidades_totais || 0}</div><div class="stat-label">Unidades</div></div>
            <div class="stat-card"><div class="stat-number">R$ ${parseFloat(stats.valor_bruto_geral || 0).toFixed(0)}</div><div class="stat-label">Bruto</div></div>
            <div class="stat-card"><div class="stat-number">R$ ${parseFloat(stats.economia_geral || 0).toFixed(0)}</div><div class="stat-label">Economia</div></div>
        </div>`;

        h += `<div class="discount-panel"><h3>💰 Configurar Desconto</h3>
            <div class="discount-row"><label>Aplicar em:</label><select id="discCatSelect"><option value="todos">Todos</option>`;
        const seenCats = new Set();
        PRODUTOS.forEach(p => { if (!seenCats.has(p.categoria)) { seenCats.add(p.categoria); h += `<option value="${p.categoria}">${p.categoriaNome}</option>`; } });
        h += `</select></div>
            <div class="discount-row"><label>%:</label><input type="number" id="discPctInput" value="0" min="0" max="100" style="width:70px"><button class="btn btn-primary btn-sm" onclick="app.applyDiscount()">Aplicar</button><button class="btn btn-secondary btn-sm" onclick="app.clearDiscounts()">Limpar</button></div></div>`;

        h += `<div class="admin-toolbar">
            <button class="btn btn-success" onclick="app.exportCSV()">📥 CSV</button>
            <button class="btn btn-danger" onclick="app.clearAllOrders()">🗑️ Limpar</button>
            <button class="btn btn-secondary" onclick="app.renderAdminPanel()">🔄</button>
        </div>`;

        h += `<div class="report-section"><div class="report-card"><div class="report-header">📊 Consolidado</div>`;
        if (!con.length) { h += `<div style="padding:16px" class="alert alert-info">Nenhum pedido.</div>`; }
        else {
            let tB = 0, tD = 0;
            h += `<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Total Bruto</th><th>Total Desc.</th></tr></thead><tbody>`;
            con.forEach(i => { const vb = parseFloat(i.total_bruto), vd = parseFloat(i.total_final); tB += vb; tD += vd;
                h += `<tr><td><strong>${i.codigo}</strong></td><td>${i.nome}</td><td>${i.quantidade_total}</td><td>R$ ${vb.toFixed(2)}</td><td>R$ ${vd.toFixed(2)}</td></tr>`; });
            h += `<tr class="total-row"><td colspan="2">TOTAL</td><td><strong>${con.reduce((a,i)=>a+parseInt(i.quantidade_total),0)}</strong></td><td><strong>R$ ${tB.toFixed(2)}</strong></td><td><strong>R$ ${tD.toFixed(2)}</strong></td></tr></tbody></table>`;
        }
        h += `</div></div>`;

        h += `<div class="report-section"><div class="report-card"><div class="report-header">👥 Por Comprador</div>`;
        if (!users.length) { h += `<div style="padding:16px" class="alert alert-info">Nenhum pedido.</div>`; }
        else {
            users.forEach(u => {
                const contato = [u.telefone, u.email].filter(Boolean).join(' · ');
                h += `<div class="user-section-header">📋 ${u.usuario}${contato ? ` <span style="font-weight:400;color:var(--muted);font-size:.75rem">— ${contato}</span>` : ''}</div>`;
                h += `<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>Desc.</th></tr></thead><tbody>`;
                (u.itens || []).forEach(it => { h += `<tr><td>${it.codigo}</td><td>${it.nome}</td><td>${it.quantidade}</td><td>R$ ${it.preco_bruto.toFixed(2)}</td><td>R$ ${it.preco_desconto.toFixed(2)}</td></tr>`; });
                h += `</tbody></table>`;
                h += `<div class="user-total-row">${u.total_itens} itens · Bruto: <strong>R$ ${parseFloat(u.total_bruto).toFixed(2)}</strong> · Desc: <strong>R$ ${parseFloat(u.total_desconto).toFixed(2)}</strong></div>`;
            });
        }
        h += `</div></div>`;
        c.innerHTML = h;
    },

    async applyDiscount() {
        const cat = document.getElementById('discCatSelect').value;
        const pct = parseFloat(document.getElementById('discPctInput').value) || 0;
        this.discounts[cat] = pct;
        await this.api('descontos', 'POST', { categoria: cat, percentual: pct });
        this.saveLocal(); this.renderProducts(); this.updateCartBar(); this.renderAdminPanel();
        this.toast(`Desconto ${pct}% aplicado`, 'success');
    },

    async clearDiscounts() {
        this.discounts = {};
        await this.api('descontos', 'DELETE');
        this.saveLocal(); this.renderProducts(); this.updateCartBar(); this.renderAdminPanel();
        this.toast('Descontos removidos', 'success');
    },

    async clearAllOrders() {
        if (confirm('Apagar TODOS os pedidos?') && confirm('Confirmação final?')) {
            await this.api('pedidos', 'DELETE');
            this.allOrders = {};
            this.saveLocal(); this.renderAdminPanel();
            this.toast('Pedidos apagados', 'error');
        }
    },

    async exportCSV() {
        const conRes = await this.api('pedidos/consolidado');
        const usersRes = await this.api('pedidos/por-usuario');
        const con = conRes?.data || [];
        const users = usersRes?.data || [];

        let csv = '\uFEFFCOMPRAS COLETIVAS\n';
        csv += `Exportado: ${new Date().toLocaleDateString('pt-BR')}\n\nCONSOLIDADO\nCódigo;Produto;Qtd;Bruto;Desc\n`;
        con.forEach(i => { csv += `${i.codigo};"${i.nome}";${i.quantidade_total};${parseFloat(i.total_bruto).toFixed(2).replace('.',',')};${parseFloat(i.total_final).toFixed(2).replace('.',',')}\n`; });
        csv += `\nINDIVIDUAL\n`;
        users.forEach(u => {
            csv += `\n${u.usuario}\nCódigo;Produto;Qtd;Bruto;Desc\n`;
            (u.itens || []).forEach(it => { csv += `${it.codigo};"${it.nome}";${it.quantidade};${(it.preco_bruto*it.quantidade).toFixed(2).replace('.',',')};${(it.preco_desconto*it.quantidade).toFixed(2).replace('.',',')}\n`; });
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `compras_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        this.toast('CSV exportado!', 'success');
    },

    toast(msg, type = 'success') {
        const c = document.getElementById('toastContainer'); if (!c) return;
        const t = document.createElement('div'); t.className = `toast toast-${type}`;
        t.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
        c.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
    },

    saveLocal() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        localStorage.setItem('allOrders', JSON.stringify(this.allOrders));
        localStorage.setItem('discounts', JSON.stringify(this.discounts));
    },
    loadLocal() {
        try {
            const c = localStorage.getItem('cart'), o = localStorage.getItem('allOrders'), d = localStorage.getItem('discounts');
            if (c) this.cart = JSON.parse(c);
            if (o) this.allOrders = JSON.parse(o);
            if (d) this.discounts = JSON.parse(d);
        } catch (e) { this.cart = {}; this.allOrders = {}; this.discounts = {}; }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
