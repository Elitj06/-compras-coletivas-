// ============================================================
// App Compras Coletivas — Vida Forte v3.0
// Com sistema de desconto, categorias, fotos e relatórios
// ============================================================
const app = {
    currentUser: '',
    cart: {},
    allOrders: {},
    adminPassword: 'admin123',
    isAdminLoggedIn: false,
    currentCat: 'todos',
    // Descontos: { categoria_id: percentual } ou { "todos": percentual }
    discounts: {},

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderCategoryPills();
        this.renderProducts();
        this.updateCartBar();
        const saved = localStorage.getItem('currentUser');
        if (saved) { this.currentUser = saved; this.setUserInputs(saved); }
    },

    setUserInputs(n) {
        const d = document.getElementById('userName'), m = document.getElementById('userNameMobile');
        if (d) d.value = n; if (m) m.value = n;
    },

    handleUserNameChange(v) {
        this.currentUser = v.trim();
        localStorage.setItem('currentUser', this.currentUser);
        this.setUserInputs(this.currentUser);
        this.saveData();
    },

    setupEventListeners() {
        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', e => this.switchTab(e.currentTarget.dataset.tab)));
        let st; document.getElementById('searchInput').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => this.renderProducts(e.target.value), 150); });
        const d = document.getElementById('userName'), m = document.getElementById('userNameMobile');
        if (d) { d.addEventListener('change', e => this.handleUserNameChange(e.target.value)); d.addEventListener('blur', e => this.handleUserNameChange(e.target.value)); }
        if (m) { m.addEventListener('change', e => this.handleUserNameChange(e.target.value)); m.addEventListener('blur', e => this.handleUserNameChange(e.target.value)); }
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

    // ========== DESCONTO ==========
    getDiscount(catId) {
        if (this.discounts['todos'] && this.discounts['todos'] > 0) return this.discounts['todos'];
        return this.discounts[catId] || 0;
    },

    getDiscountedPrice(preco, catId) {
        const pct = this.getDiscount(catId);
        if (pct <= 0) return preco;
        return preco * (1 - pct / 100);
    },

    // ========== CATEGORIAS ==========
    renderCategoryPills() {
        const c = document.getElementById('catPills');
        if (!c) return;
        // Get unique categories preserving order
        const seen = new Set();
        const cats = [{ id: 'todos', nome: 'Todos' }];
        PRODUTOS.forEach(p => {
            if (!seen.has(p.categoria)) { seen.add(p.categoria); cats.push({ id: p.categoria, nome: p.categoriaNome }); }
        });
        c.innerHTML = cats.map(cat =>
            `<button class="cat-pill ${this.currentCat === cat.id ? 'active' : ''}" onclick="app.selectCat('${cat.id}')">${cat.nome}</button>`
        ).join('');
    },

    selectCat(id) {
        this.currentCat = id;
        this.renderCategoryPills();
        this.renderProducts(document.getElementById('searchInput').value);
    },

    // ========== PRODUTOS ==========
    renderProducts(search = '') {
        const grid = document.getElementById('productsGrid');
        const countEl = document.getElementById('searchCount');
        let filtered = PRODUTOS.filter(p => {
            const s = search.toLowerCase();
            const matchSearch = !s || p.nome.toLowerCase().includes(s) || p.codigo.toLowerCase().includes(s);
            const matchCat = this.currentCat === 'todos' || p.categoria === this.currentCat;
            return matchSearch && matchCat;
        });

        if (countEl) countEl.textContent = `${filtered.length} produto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;

        if (!filtered.length) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><h3>Nenhum produto encontrado</h3><p>Tente outro termo ou categoria</p></div>`;
            return;
        }

        grid.innerHTML = filtered.map((p, i) => {
            const qty = this.cart[p.codigo] || 0;
            const hasQty = qty > 0;
            const disc = this.getDiscount(p.categoria);
            const discPrice = this.getDiscountedPrice(p.preco, p.categoria);
            const hasDisc = disc > 0;

            let imgHtml = p.imagem && p.imagem !== 'img/'
                ? `<img class="product-img" src="${p.imagem}" alt="${p.nome}" onerror="this.outerHTML='<div class=no-img>📦</div>'" loading="lazy"/>`
                : `<div class="no-img">📦</div>`;

            let priceHtml;
            if (hasDisc) {
                priceHtml = `<span class="price-full struck">R$ ${p.preco.toFixed(2)}</span><span class="price-discount">R$ ${discPrice.toFixed(2)}</span><span class="discount-badge">-${disc}%</span>`;
            } else {
                priceHtml = `<span class="price-full">R$ ${p.preco.toFixed(2)}</span>`;
            }

            return `<div class="product-card ${hasQty ? 'has-qty' : ''}" style="animation-delay:${Math.min(i * .025, .25)}s">
                ${imgHtml}
                <div class="product-body">
                    <div class="product-card-header"><span class="product-code">${p.codigo}</span><span class="product-emb">Emb: ${p.embalagem}</span></div>
                    <div class="product-name">${p.nome}</div>
                    <div class="product-prices">${priceHtml}</div>
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="app.updateQty('${p.codigo}',-1)">−</button>
                        <input type="number" class="qty-input" value="${qty}" min="0" onchange="app.setQty('${p.codigo}',this.value)">
                        <button class="qty-btn" onclick="app.updateQty('${p.codigo}',1)">+</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    updateQty(cod, chg) {
        if (!this.currentUser) { this.toast('Digite seu nome primeiro!', 'error'); return; }
        const cur = this.cart[cod] || 0;
        const nq = Math.max(0, cur + chg);
        if (nq === 0) delete this.cart[cod]; else this.cart[cod] = nq;
        if (chg > 0 && nq === 1) { const p = PRODUTOS.find(x => x.codigo === cod); if (p) this.toast(`${p.nome} adicionado`, 'success'); }
        this.saveData(); this.renderProducts(document.getElementById('searchInput').value); this.updateCartBar();
    },

    setQty(cod, v) {
        if (!this.currentUser) { this.toast('Digite seu nome primeiro!', 'error'); return; }
        const q = parseInt(v) || 0;
        if (q === 0) delete this.cart[cod]; else this.cart[cod] = Math.max(0, q);
        this.saveData(); this.updateCartBar();
    },

    // ========== CART BAR ==========
    updateCartBar() {
        const items = Object.keys(this.cart).length;
        const { total, totalDisc } = this.calcTotals();
        const bar = document.getElementById('cartBar');
        if (bar) bar.classList.toggle('empty', items === 0);
        const ce = document.getElementById('cartCount'), te = document.getElementById('cartTotal'), td = document.getElementById('cartTotalDisc');
        if (ce) ce.innerHTML = `<strong>${items}</strong> ite${items === 1 ? 'm' : 'ns'}`;
        if (te) te.textContent = `R$ ${total.toFixed(2)}`;
        if (td) {
            if (totalDisc < total) { td.textContent = `→ R$ ${totalDisc.toFixed(2)}`; td.style.display = ''; }
            else { td.style.display = 'none'; }
        }
    },

    calcTotals(cart) {
        cart = cart || this.cart;
        let total = 0, totalDisc = 0;
        for (const [cod, qty] of Object.entries(cart)) {
            const p = PRODUTOS.find(x => x.codigo === cod);
            if (p) {
                total += p.preco * qty;
                totalDisc += this.getDiscountedPrice(p.preco, p.categoria) * qty;
            }
        }
        return { total, totalDisc };
    },

    // ========== MEU PEDIDO ==========
    renderMyCart() {
        const c = document.getElementById('myCartContent');
        const items = Object.entries(this.cart);
        if (!items.length) { c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛒</div><h3>Pedido vazio</h3><p>Adicione produtos na aba Produtos</p></div>`; return; }
        const { total, totalDisc } = this.calcTotals();
        const hasDisc = totalDisc < total;
        let h = '';
        if (this.currentUser) h += `<div class="user-badge">👤 <strong>${this.currentUser}</strong></div>`;

        items.forEach(([cod, qty], i) => {
            const p = PRODUTOS.find(x => x.codigo === cod);
            if (!p) return;
            const sub = p.preco * qty;
            const subD = this.getDiscountedPrice(p.preco, p.categoria) * qty;
            const disc = this.getDiscount(p.categoria);
            h += `<div class="cart-item" style="animation-delay:${i * .04}s"><div class="cart-item-info"><h4>${p.nome}</h4><small>${cod} · R$ ${p.preco.toFixed(2)} × ${qty}</small></div><div class="cart-item-right"><div class="cart-item-prices"><div class="cart-item-subtotal">R$ ${sub.toFixed(2)}</div>${disc > 0 ? `<div class="cart-item-disc">c/ ${disc}%: R$ ${subD.toFixed(2)}</div>` : ''}</div><button class="btn-remove" onclick="app.removeFromCart('${cod}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div>`;
        });

        h += `<div class="order-total-bar"><div><div class="order-total-line" style="margin:0"><span>Total Bruto</span><h2>R$ ${total.toFixed(2)}</h2></div>`;
        if (hasDisc) h += `<div class="order-total-line"><span>Total com Desconto</span><h2 style="color:#FFD;">R$ ${totalDisc.toFixed(2)}</h2></div><div class="order-total-line"><span>Economia</span><span>R$ ${(total - totalDisc).toFixed(2)}</span></div>`;
        h += `</div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-primary" onclick="app.finalizeOrder()">Finalizar Pedido</button></div>`;
        c.innerHTML = h;
    },

    removeFromCart(cod) {
        const p = PRODUTOS.find(x => x.codigo === cod);
        delete this.cart[cod];
        this.saveData(); this.renderMyCart(); this.renderProducts(document.getElementById('searchInput').value); this.updateCartBar();
        if (p) this.toast(`${p.nome} removido`, 'error');
    },

    finalizeOrder() {
        if (!this.currentUser) { this.toast('Digite seu nome!', 'error'); return; }
        if (!Object.keys(this.cart).length) { this.toast('Carrinho vazio!', 'error'); return; }
        const { total, totalDisc } = this.calcTotals();
        const hasDisc = totalDisc < total;
        let msg = `${this.currentUser}, confirma o pedido?\n\nBruto: R$ ${total.toFixed(2)}`;
        if (hasDisc) msg += `\nCom desconto: R$ ${totalDisc.toFixed(2)}`;
        if (!confirm(msg)) return;

        if (!this.allOrders[this.currentUser]) this.allOrders[this.currentUser] = {};
        for (const [cod, qty] of Object.entries(this.cart)) {
            this.allOrders[this.currentUser][cod] = (this.allOrders[this.currentUser][cod] || 0) + qty;
        }
        this.cart = {};
        this.saveData(); this.updateCartBar(); this.renderProducts();
        this.toast('Pedido finalizado!', 'success');
        this.switchTab('meu-pedido');
    },

    // ========== ADMIN ==========
    loginAdmin() {
        if (document.getElementById('adminPassword').value === this.adminPassword) {
            this.isAdminLoggedIn = true;
            document.getElementById('adminLoginSection').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            this.renderAdminPanel();
            this.toast('Acesso liberado', 'success');
        } else { this.toast('Senha incorreta!', 'error'); }
    },

    renderAdminPanel() {
        const c = document.getElementById('adminContent');
        const con = this.getConsolidated();
        const users = Object.keys(this.allOrders);
        let tBruto = 0, tDisc = 0, tItens = 0;
        con.forEach(i => { tBruto += i.quantidade * i.preco; tDisc += i.quantidade * i.precoDisc; tItens += i.quantidade; });

        let h = `<div class="stats-bar">
            <div class="stat-card"><div class="stat-number">${users.length}</div><div class="stat-label">Compradores</div></div>
            <div class="stat-card"><div class="stat-number">${con.length}</div><div class="stat-label">Produtos</div></div>
            <div class="stat-card"><div class="stat-number">${tItens}</div><div class="stat-label">Unidades</div></div>
            <div class="stat-card"><div class="stat-number">R$ ${tBruto.toFixed(0)}</div><div class="stat-label">Bruto</div></div>
            <div class="stat-card"><div class="stat-number">R$ ${tDisc.toFixed(0)}</div><div class="stat-label">Com Desc.</div></div>
        </div>`;

        // Painel de desconto
        h += `<div class="discount-panel"><h3>💰 Configurar Desconto</h3>
            <div class="discount-row"><label>Aplicar em:</label><select id="discCatSelect"><option value="todos">Todos os produtos</option>`;
        const seenCats = new Set();
        PRODUTOS.forEach(p => { if (!seenCats.has(p.categoria)) { seenCats.add(p.categoria); h += `<option value="${p.categoria}">${p.categoriaNome}</option>`; } });
        h += `</select></div>
            <div class="discount-row"><label>Desconto %:</label><input type="number" id="discPctInput" value="0" min="0" max="100" step="1" style="width:80px"><button class="btn btn-primary btn-sm" onclick="app.applyDiscount()">Aplicar</button><button class="btn btn-secondary btn-sm" onclick="app.clearDiscounts()">Limpar Todos</button></div>`;
        // Show active discounts
        const activeDiscs = Object.entries(this.discounts).filter(([,v]) => v > 0);
        if (activeDiscs.length) {
            h += `<div style="margin-top:8px;font-size:.78rem;color:var(--text2)">Descontos ativos: `;
            h += activeDiscs.map(([k, v]) => {
                const name = k === 'todos' ? 'Todos' : (PRODUTOS.find(p => p.categoria === k)?.categoriaNome || k);
                return `<strong>${name}: ${v}%</strong>`;
            }).join(', ');
            h += `</div>`;
        }
        h += `</div>`;

        h += `<div class="admin-toolbar">
            <button class="btn btn-success" onclick="app.exportCSV()">📥 Exportar CSV</button>
            <button class="btn btn-danger" onclick="app.clearAllOrders()">🗑️ Limpar Pedidos</button>
            <button class="btn btn-secondary" onclick="app.renderAdminPanel()">🔄 Atualizar</button>
        </div>`;

        // RELATÓRIO CONSOLIDADO COM QUANTIDADES
        h += `<div class="report-section"><div class="report-card"><div class="report-header">📊 Consolidado — total por produto com quantidades</div>`;
        if (!con.length) { h += `<div style="padding:16px" class="alert alert-info">Nenhum pedido.</div>`; }
        else {
            h += `<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto Unit.</th><th>Desc. Unit.</th><th>Total Bruto</th><th>Total Desc.</th></tr></thead><tbody>`;
            con.forEach(i => {
                h += `<tr><td><strong>${i.codigo}</strong></td><td>${i.nome}</td><td><strong>${i.quantidade}</strong></td><td>R$ ${i.preco.toFixed(2)}</td><td>R$ ${i.precoDisc.toFixed(2)}</td><td>R$ ${(i.quantidade * i.preco).toFixed(2)}</td><td>R$ ${(i.quantidade * i.precoDisc).toFixed(2)}</td></tr>`;
            });
            h += `<tr class="total-row"><td colspan="2">TOTAL</td><td><strong>${tItens}</strong></td><td></td><td></td><td><strong>R$ ${tBruto.toFixed(2)}</strong></td><td><strong>R$ ${tDisc.toFixed(2)}</strong></td></tr>`;
            h += `</tbody></table>`;
        }
        h += `</div></div>`;

        // RELATÓRIO INDIVIDUAL
        h += `<div class="report-section"><div class="report-card"><div class="report-header">👥 Individual — pedidos por comprador</div>`;
        if (!users.length) { h += `<div style="padding:16px" class="alert alert-info">Nenhum pedido.</div>`; }
        else {
            users.forEach(user => {
                const orders = this.allOrders[user];
                let uBruto = 0, uDisc = 0, uItens = 0;
                h += `<div class="user-section-header">📋 ${user}</div>`;
                h += `<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Bruto</th><th>C/ Desc.</th></tr></thead><tbody>`;
                for (const [cod, qty] of Object.entries(orders)) {
                    const p = PRODUTOS.find(x => x.codigo === cod);
                    if (!p) continue;
                    const sub = p.preco * qty;
                    const subD = this.getDiscountedPrice(p.preco, p.categoria) * qty;
                    uBruto += sub; uDisc += subD; uItens += qty;
                    h += `<tr><td>${cod}</td><td>${p.nome}</td><td>${qty}</td><td>R$ ${sub.toFixed(2)}</td><td>R$ ${subD.toFixed(2)}</td></tr>`;
                }
                h += `</tbody></table>`;
                h += `<div class="user-total-row">${uItens} itens · Bruto: <strong>R$ ${uBruto.toFixed(2)}</strong> · Com Desc: <strong style="color:var(--danger)">R$ ${uDisc.toFixed(2)}</strong></div>`;
            });
        }
        h += `</div></div>`;

        c.innerHTML = h;
    },

    applyDiscount() {
        const cat = document.getElementById('discCatSelect').value;
        const pct = parseFloat(document.getElementById('discPctInput').value) || 0;
        if (pct < 0 || pct > 100) { this.toast('Percentual inválido (0-100)', 'error'); return; }
        this.discounts[cat] = pct;
        this.saveData();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartBar();
        this.renderAdminPanel();
        const name = cat === 'todos' ? 'todos os produtos' : (PRODUTOS.find(p => p.categoria === cat)?.categoriaNome || cat);
        this.toast(`Desconto de ${pct}% aplicado em ${name}`, 'success');
    },

    clearDiscounts() {
        this.discounts = {};
        this.saveData();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartBar();
        this.renderAdminPanel();
        this.toast('Descontos removidos', 'success');
    },

    getConsolidated() {
        const con = {};
        for (const user in this.allOrders) {
            for (const [cod, qty] of Object.entries(this.allOrders[user])) {
                con[cod] = (con[cod] || 0) + qty;
            }
        }
        return Object.entries(con).map(([cod, qtd]) => {
            const p = PRODUTOS.find(x => x.codigo === cod);
            return { codigo: cod, nome: p ? p.nome : '?', quantidade: qtd, preco: p ? p.preco : 0, precoDisc: p ? this.getDiscountedPrice(p.preco, p.categoria) : 0, categoria: p ? p.categoria : '' };
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    },

    exportCSV() {
        const con = this.getConsolidated();
        let csv = '\uFEFF';
        csv += 'RELATÓRIO COMPRAS COLETIVAS VIDA FORTE\n';
        csv += `Exportado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
        csv += 'CONSOLIDADO\n';
        csv += 'Código;Produto;Qtd;Valor Bruto;Valor Desc.;Total Bruto;Total Desc.\n';
        let tb = 0, td = 0;
        con.forEach(i => { const vb = i.quantidade * i.preco; const vd = i.quantidade * i.precoDisc; tb += vb; td += vd; csv += `${i.codigo};"${i.nome}";${i.quantidade};${i.preco.toFixed(2).replace('.',',')};${i.precoDisc.toFixed(2).replace('.',',')};${vb.toFixed(2).replace('.',',')};${vd.toFixed(2).replace('.',',')}\n`; });
        csv += `\n;;;;"TOTAL";${tb.toFixed(2).replace('.',',')};${td.toFixed(2).replace('.',',')}\n\n`;
        csv += 'INDIVIDUAL\n';
        for (const user in this.allOrders) {
            csv += `\nComprador: ${user}\n`;
            csv += 'Código;Produto;Qtd;Bruto;Com Desc.\n';
            let ub = 0, ud = 0;
            for (const [cod, qty] of Object.entries(this.allOrders[user])) {
                const p = PRODUTOS.find(x => x.codigo === cod);
                if (!p) continue;
                const sb = p.preco * qty, sd = this.getDiscountedPrice(p.preco, p.categoria) * qty;
                ub += sb; ud += sd;
                csv += `${cod};"${p.nome}";${qty};${sb.toFixed(2).replace('.',',')};${sd.toFixed(2).replace('.',',')}\n`;
            }
            csv += `\n;;;"Total ${user} Bruto:";${ub.toFixed(2).replace('.',',')}\n`;
            csv += `;;;"Total ${user} Desc.:";${ud.toFixed(2).replace('.',',')}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `compras_coletivas_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        this.toast('CSV exportado!', 'success');
    },

    clearAllOrders() {
        if (confirm('Apagar TODOS os pedidos?')) { if (confirm('Confirmação final?')) { this.allOrders = {}; this.saveData(); this.renderAdminPanel(); this.toast('Pedidos apagados', 'error'); } }
    },

    toast(msg, type = 'success') {
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
    },

    saveData() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        localStorage.setItem('allOrders', JSON.stringify(this.allOrders));
        localStorage.setItem('discounts', JSON.stringify(this.discounts));
    },

    loadData() {
        try {
            const c = localStorage.getItem('cart'), o = localStorage.getItem('allOrders'), d = localStorage.getItem('discounts');
            if (c) this.cart = JSON.parse(c);
            if (o) this.allOrders = JSON.parse(o);
            if (d) this.discounts = JSON.parse(d);
        } catch (e) { this.cart = {}; this.allOrders = {}; this.discounts = {}; }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
