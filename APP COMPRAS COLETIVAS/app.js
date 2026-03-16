// ============================================================
// App de Compras Coletivas — Vida Forte Nutrientes
// Versão 2.0 — Otimizada e Profissional
// ============================================================

const app = {
    currentUser: '',
    cart: {},
    allOrders: {},
    adminPassword: 'admin123',
    isAdminLoggedIn: false,

    // ========== INIT ==========
    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderProducts();
        this.updateCartSummary();

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = savedUser;
            this.setUserInputs(savedUser);
        }
    },

    // ========== NOME DO USUÁRIO (sincroniza desktop + mobile) ==========
    setUserInputs(name) {
        const desktop = document.getElementById('userName');
        const mobile = document.getElementById('userNameMobile');
        if (desktop) desktop.value = name;
        if (mobile) mobile.value = name;
    },

    handleUserNameChange(value) {
        this.currentUser = value.trim();
        localStorage.setItem('currentUser', this.currentUser);
        this.setUserInputs(this.currentUser);
        this.saveData();
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Busca de produtos com debounce
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.renderProducts(e.target.value), 150);
        });

        // Nome do usuário — desktop
        const desktopInput = document.getElementById('userName');
        if (desktopInput) {
            desktopInput.addEventListener('change', (e) => this.handleUserNameChange(e.target.value));
            desktopInput.addEventListener('blur', (e) => this.handleUserNameChange(e.target.value));
        }

        // Nome do usuário — mobile
        const mobileInput = document.getElementById('userNameMobile');
        if (mobileInput) {
            mobileInput.addEventListener('change', (e) => this.handleUserNameChange(e.target.value));
            mobileInput.addEventListener('blur', (e) => this.handleUserNameChange(e.target.value));
        }

        // Admin password enter key
        const adminPwd = document.getElementById('adminPassword');
        if (adminPwd) {
            adminPwd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.loginAdmin();
            });
        }
    },

    // ========== TABS ==========
    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) tabContent.classList.remove('hidden');

        if (tabName === 'meu-pedido') this.renderMyCart();
        else if (tabName === 'admin' && this.isAdminLoggedIn) this.renderAdminPanel();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ========== RENDERIZAR PRODUTOS ==========
    renderProducts(searchTerm = '') {
        const grid = document.getElementById('productsGrid');
        const countEl = document.getElementById('searchCount');

        const filtered = PRODUTOS.filter(p => {
            const search = searchTerm.toLowerCase();
            return p.nome.toLowerCase().includes(search) ||
                   p.codigo.toLowerCase().includes(search);
        });

        // Atualizar contador de busca
        if (countEl) {
            if (searchTerm) {
                countEl.textContent = `${filtered.length} produto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''} para "${searchTerm}"`;
            } else {
                countEl.textContent = `${PRODUTOS.length} produtos disponíveis`;
            }
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon">🔍</div>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Tente buscar com outro termo</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map((produto, i) => {
            const qty = this.cart[produto.codigo] || 0;
            const hasQty = qty > 0;
            return `
                <div class="product-card ${hasQty ? 'has-qty' : ''}" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
                    <div class="product-card-header">
                        <span class="product-code">${produto.codigo}</span>
                        <span class="product-embalagem">Emb: ${produto.embalagem} un.</span>
                    </div>
                    <div class="product-name">${produto.nome}</div>
                    <div class="product-price">R$ ${produto.preco.toFixed(2)}</div>
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="app.updateQuantity('${produto.codigo}', -1)" aria-label="Diminuir">−</button>
                        <input type="number" class="qty-input" value="${qty}" min="0"
                               onchange="app.setQuantity('${produto.codigo}', this.value)"
                               aria-label="Quantidade">
                        <button class="qty-btn" onclick="app.updateQuantity('${produto.codigo}', 1)" aria-label="Aumentar">+</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ========== QUANTIDADES ==========
    updateQuantity(codigo, change) {
        if (!this.currentUser) {
            this.showToast('Digite seu nome antes de adicionar produtos!', 'error');
            const input = document.getElementById('userName') || document.getElementById('userNameMobile');
            if (input) input.focus();
            return;
        }

        const current = this.cart[codigo] || 0;
        const newQty = Math.max(0, current + change);

        if (newQty === 0) {
            delete this.cart[codigo];
        } else {
            this.cart[codigo] = newQty;
        }

        // Feedback visual
        if (change > 0 && newQty === 1) {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            if (produto) this.showToast(`${produto.nome} adicionado`, 'success');
        }

        this.saveData();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartSummary();
    },

    setQuantity(codigo, value) {
        if (!this.currentUser) {
            this.showToast('Digite seu nome antes de adicionar produtos!', 'error');
            return;
        }

        const qty = parseInt(value) || 0;
        if (qty === 0) {
            delete this.cart[codigo];
        } else {
            this.cart[codigo] = Math.max(0, qty);
        }

        this.saveData();
        this.updateCartSummary();
    },

    // ========== CART SUMMARY (barra fixa inferior) ==========
    updateCartSummary() {
        const items = Object.keys(this.cart).length;
        const total = this.calculateTotal();
        const summary = document.getElementById('cartSummary');
        const countEl = document.getElementById('cartItemsCount');
        const totalEl = document.getElementById('cartTotal');

        if (summary) {
            summary.classList.toggle('empty', items === 0);
        }

        if (countEl) {
            countEl.innerHTML = `<strong>${items}</strong> ${items === 1 ? 'item' : 'itens'}`;
        }

        if (totalEl) {
            totalEl.textContent = `R$ ${total.toFixed(2)}`;
        }
    },

    calculateTotal() {
        let total = 0;
        for (const [codigo, qty] of Object.entries(this.cart)) {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            if (produto) total += produto.preco * qty;
        }
        return total;
    },

    // ========== MEU PEDIDO ==========
    renderMyCart() {
        const container = document.getElementById('myCartContent');
        const items = Object.entries(this.cart);

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛒</div>
                    <h3>Seu pedido está vazio</h3>
                    <p>Adicione produtos na aba Produtos para começar</p>
                </div>
            `;
            return;
        }

        const total = this.calculateTotal();
        let html = '';

        if (this.currentUser) {
            html += `<div class="user-badge">👤 <strong>${this.currentUser}</strong></div>`;
        }

        items.forEach(([codigo, qty], i) => {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            if (!produto) return;
            const subtotal = produto.preco * qty;
            html += `
                <div class="cart-item" style="animation-delay:${i * 0.05}s">
                    <div class="cart-item-info">
                        <h4>${produto.nome}</h4>
                        <small>${codigo} · R$ ${produto.preco.toFixed(2)} × ${qty}</small>
                    </div>
                    <div class="cart-item-right">
                        <span class="cart-item-subtotal">R$ ${subtotal.toFixed(2)}</span>
                        <button class="btn-remove" onclick="app.removeFromCart('${codigo}')" aria-label="Remover">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="order-total-bar">
                <span>Total do Pedido</span>
                <h2>R$ ${total.toFixed(2)}</h2>
            </div>
            <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn btn-primary" onclick="app.finalizeOrder()">Finalizar Pedido</button>
            </div>
        `;

        container.innerHTML = html;
    },

    removeFromCart(codigo) {
        const produto = PRODUTOS.find(p => p.codigo === codigo);
        delete this.cart[codigo];
        this.saveData();
        this.renderMyCart();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartSummary();
        if (produto) this.showToast(`${produto.nome} removido`, 'error');
    },

    // ========== FINALIZAR PEDIDO ==========
    finalizeOrder() {
        if (!this.currentUser) {
            this.showToast('Digite seu nome antes de finalizar!', 'error');
            const input = document.getElementById('userName') || document.getElementById('userNameMobile');
            if (input) input.focus();
            return;
        }

        if (Object.keys(this.cart).length === 0) {
            this.showToast('Seu carrinho está vazio!', 'error');
            return;
        }

        const total = this.calculateTotal();
        const confirmar = confirm(
            `${this.currentUser}, confirma o pedido de R$ ${total.toFixed(2)}?\n\n` +
            `Total de ${Object.keys(this.cart).length} produto(s) selecionado(s).`
        );

        if (confirmar) {
            if (!this.allOrders[this.currentUser]) {
                this.allOrders[this.currentUser] = {};
            }

            for (const [codigo, qty] of Object.entries(this.cart)) {
                if (this.allOrders[this.currentUser][codigo]) {
                    this.allOrders[this.currentUser][codigo] += qty;
                } else {
                    this.allOrders[this.currentUser][codigo] = qty;
                }
            }

            this.cart = {};
            this.saveData();
            this.updateCartSummary();
            this.renderProducts();
            this.showToast('Pedido finalizado com sucesso!', 'success');
            this.switchTab('meu-pedido');
        }
    },

    // ========== ADMIN ==========
    loginAdmin() {
        const password = document.getElementById('adminPassword').value;

        if (password === this.adminPassword) {
            this.isAdminLoggedIn = true;
            document.getElementById('adminLoginSection').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            this.renderAdminPanel();
            this.showToast('Acesso administrativo liberado', 'success');
        } else {
            this.showToast('Senha incorreta!', 'error');
        }
    },

    renderAdminPanel() {
        const container = document.getElementById('adminContent');
        const consolidated = this.getConsolidatedReport();
        const users = Object.keys(this.allOrders);

        // Stats
        let totalGeral = 0;
        let totalItens = 0;
        consolidated.forEach(item => {
            totalGeral += item.quantidade * item.preco;
            totalItens += item.quantidade;
        });

        let html = `
            <div class="stats-bar">
                <div class="stat-card">
                    <div class="stat-number">${users.length}</div>
                    <div class="stat-label">Participantes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${consolidated.length}</div>
                    <div class="stat-label">Produtos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalItens}</div>
                    <div class="stat-label">Itens Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">R$ ${totalGeral.toFixed(0)}</div>
                    <div class="stat-label">Valor Total</div>
                </div>
            </div>

            <div class="admin-toolbar">
                <button class="btn btn-success" onclick="app.exportData()">📥 Exportar CSV</button>
                <button class="btn btn-danger" onclick="app.clearAllOrders()">🗑️ Limpar Pedidos</button>
                <button class="btn btn-secondary" onclick="app.renderAdminPanel()">🔄 Atualizar</button>
            </div>
        `;

        // Relatório Consolidado
        html += '<div class="report-section"><div class="report-card">';
        html += '<div class="report-header">📊 Relatório consolidado — total por produto</div>';

        if (consolidated.length === 0) {
            html += '<div style="padding:20px;" class="alert alert-info">Nenhum pedido registrado ainda.</div>';
        } else {
            html += '<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd. Total</th><th>Valor Unit.</th><th>Valor Total</th></tr></thead><tbody>';

            consolidated.forEach(item => {
                const valorTotal = item.quantidade * item.preco;
                html += `<tr>
                    <td><strong>${item.codigo}</strong></td>
                    <td>${item.nome}</td>
                    <td><strong>${item.quantidade}</strong></td>
                    <td>R$ ${item.preco.toFixed(2)}</td>
                    <td><strong>R$ ${valorTotal.toFixed(2)}</strong></td>
                </tr>`;
            });

            html += `<tr class="total-row">
                <td colspan="4" style="text-align:right;">TOTAL GERAL</td>
                <td>R$ ${totalGeral.toFixed(2)}</td>
            </tr>`;
            html += '</tbody></table>';
        }
        html += '</div></div>';

        // Relatório Individual
        html += '<div class="report-section"><div class="report-card">';
        html += '<div class="report-header">👥 Relatório individual — pedidos por pessoa</div>';

        if (users.length === 0) {
            html += '<div style="padding:20px;" class="alert alert-info">Nenhum pedido registrado ainda.</div>';
        } else {
            users.forEach(user => {
                const userOrders = this.allOrders[user];
                let userTotal = 0;

                html += `<div class="user-section-header">📋 ${user}</div>`;
                html += '<table><thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>';

                for (const [codigo, qty] of Object.entries(userOrders)) {
                    const produto = PRODUTOS.find(p => p.codigo === codigo);
                    if (produto) {
                        const subtotal = produto.preco * qty;
                        userTotal += subtotal;
                        html += `<tr>
                            <td>${codigo}</td>
                            <td>${produto.nome}</td>
                            <td>${qty}</td>
                            <td>R$ ${produto.preco.toFixed(2)}</td>
                            <td>R$ ${subtotal.toFixed(2)}</td>
                        </tr>`;
                    }
                }

                html += '</tbody></table>';
                html += `<div class="user-total-row">Total de ${user}: <strong>R$ ${userTotal.toFixed(2)}</strong></div>`;
            });
        }
        html += '</div></div>';

        container.innerHTML = html;
    },

    getConsolidatedReport() {
        const consolidated = {};
        for (const user in this.allOrders) {
            for (const [codigo, qty] of Object.entries(this.allOrders[user])) {
                consolidated[codigo] = (consolidated[codigo] || 0) + qty;
            }
        }

        return Object.entries(consolidated).map(([codigo, quantidade]) => {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            return {
                codigo,
                nome: produto ? produto.nome : 'Produto não encontrado',
                quantidade,
                preco: produto ? produto.preco : 0
            };
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    },

    // ========== EXPORTAR CSV ==========
    exportData() {
        const consolidated = this.getConsolidatedReport();

        let csv = '\uFEFF'; // BOM para encoding correto no Excel
        csv += 'RELATÓRIO CONSOLIDADO - COMPRAS COLETIVAS VIDA FORTE\n';
        csv += `Data de Exportação: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
        csv += 'Código;Produto;Quantidade Total;Valor Unitário;Valor Total\n';

        let totalGeral = 0;
        consolidated.forEach(item => {
            const valorTotal = item.quantidade * item.preco;
            totalGeral += valorTotal;
            csv += `${item.codigo};"${item.nome}";${item.quantidade};${item.preco.toFixed(2).replace('.', ',')};${valorTotal.toFixed(2).replace('.', ',')}\n`;
        });

        csv += `\n;;;"TOTAL GERAL:";${totalGeral.toFixed(2).replace('.', ',')}\n\n\n`;
        csv += 'RELATÓRIO INDIVIDUAL\n\n';

        for (const user in this.allOrders) {
            csv += `\nPedido de: ${user}\n`;
            csv += 'Código;Produto;Quantidade;Valor Unitário;Subtotal\n';

            let userTotal = 0;
            for (const [codigo, qty] of Object.entries(this.allOrders[user])) {
                const produto = PRODUTOS.find(p => p.codigo === codigo);
                if (produto) {
                    const subtotal = produto.preco * qty;
                    userTotal += subtotal;
                    csv += `${codigo};"${produto.nome}";${qty};${produto.preco.toFixed(2).replace('.', ',')};${subtotal.toFixed(2).replace('.', ',')}\n`;
                }
            }
            csv += `\n;;;"Total de ${user}:";${userTotal.toFixed(2).replace('.', ',')}\n`;
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `compras_coletivas_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('Relatório exportado com sucesso!', 'success');
    },

    clearAllOrders() {
        if (confirm('ATENÇÃO: Isso irá apagar todos os pedidos registrados. Tem certeza?')) {
            if (confirm('Confirmação final: Realmente deseja apagar TODOS os pedidos?')) {
                this.allOrders = {};
                this.saveData();
                this.renderAdminPanel();
                this.showToast('Todos os pedidos foram apagados.', 'error');
            }
        }
    },

    // ========== TOAST NOTIFICATIONS ==========
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3200);
    },

    // ========== PERSISTÊNCIA ==========
    saveData() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        localStorage.setItem('allOrders', JSON.stringify(this.allOrders));
    },

    loadData() {
        try {
            const savedCart = localStorage.getItem('cart');
            const savedOrders = localStorage.getItem('allOrders');
            if (savedCart) this.cart = JSON.parse(savedCart);
            if (savedOrders) this.allOrders = JSON.parse(savedOrders);
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            this.cart = {};
            this.allOrders = {};
        }
    }
};

// Inicializar
window.addEventListener('DOMContentLoaded', () => app.init());
