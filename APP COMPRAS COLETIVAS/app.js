// App de Compras Coletivas
const app = {
    currentUser: '',
    cart: {},
    allOrders: {},
    adminPassword: 'admin123', // ALTERE ESTA SENHA!
    isAdminLoggedIn: false,

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderProducts();
        this.updateCartSummary();
        
        // Carregar nome do usuário se já estiver salvo
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            document.getElementById('userName').value = savedUser;
            this.currentUser = savedUser;
        }
    },

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Busca de produtos
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.renderProducts(e.target.value);
        });

        // Nome do usuário
        document.getElementById('userName').addEventListener('change', (e) => {
            this.currentUser = e.target.value.trim();
            localStorage.setItem('currentUser', this.currentUser);
            this.saveData();
        });
    },

    switchTab(tabName) {
        // Atualizar tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Atualizar conteúdo
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        // Atualizar conteúdo específico
        if (tabName === 'meu-pedido') {
            this.renderMyCart();
        } else if (tabName === 'admin') {
            if (this.isAdminLoggedIn) {
                this.renderAdminPanel();
            }
        }
    },

    renderProducts(searchTerm = '') {
        const grid = document.getElementById('productsGrid');
        const filtered = PRODUTOS.filter(p => {
            const search = searchTerm.toLowerCase();
            return p.nome.toLowerCase().includes(search) || 
                   p.codigo.toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="alert alert-info">Nenhum produto encontrado.</div>';
            return;
        }

        grid.innerHTML = filtered.map(produto => {
            const qty = this.cart[produto.codigo] || 0;
            return `
                <div class="product-card">
                    <div class="product-code">${produto.codigo}</div>
                    <div class="product-name">${produto.nome}</div>
                    <div class="product-price">R$ ${produto.preco.toFixed(2)}</div>
                    <div class="product-embalagem">Embalagem: ${produto.embalagem} unidades</div>
                    <div class="quantity-control">
                        <button onclick="app.updateQuantity('${produto.codigo}', -1)">-</button>
                        <input type="number" 
                               value="${qty}" 
                               min="0" 
                               onchange="app.setQuantity('${produto.codigo}', this.value)"
                               style="width: 80px;">
                        <button onclick="app.updateQuantity('${produto.codigo}', 1)">+</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateQuantity(codigo, change) {
        if (!this.currentUser) {
            alert('Por favor, digite seu nome primeiro!');
            document.getElementById('userName').focus();
            return;
        }

        const current = this.cart[codigo] || 0;
        const newQty = Math.max(0, current + change);
        
        if (newQty === 0) {
            delete this.cart[codigo];
        } else {
            this.cart[codigo] = newQty;
        }

        this.saveData();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartSummary();
    },

    setQuantity(codigo, value) {
        if (!this.currentUser) {
            alert('Por favor, digite seu nome primeiro!');
            document.getElementById('userName').focus();
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

    updateCartSummary() {
        const items = Object.keys(this.cart).length;
        const total = this.calculateTotal();
        
        document.getElementById('cartItemsCount').textContent = `${items} ${items === 1 ? 'item' : 'itens'}`;
        document.getElementById('cartTotal').textContent = ` | Total: R$ ${total.toFixed(2)}`;
    },

    calculateTotal() {
        let total = 0;
        for (const [codigo, qty] of Object.entries(this.cart)) {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            if (produto) {
                total += produto.preco * qty;
            }
        }
        return total;
    },

    renderMyCart() {
        const container = document.getElementById('myCartContent');
        const items = Object.entries(this.cart);

        if (items.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Seu carrinho está vazio.</div>';
            return;
        }

        const total = this.calculateTotal();
        let html = '<h2>Meu Pedido</h2>';
        
        if (this.currentUser) {
            html += `<div class="alert alert-success"><strong>Usuário:</strong> ${this.currentUser}</div>`;
        }

        items.forEach(([codigo, qty]) => {
            const produto = PRODUTOS.find(p => p.codigo === codigo);
            if (produto) {
                const subtotal = produto.preco * qty;
                html += `
                    <div class="my-cart-item">
                        <div>
                            <strong>${produto.nome}</strong><br>
                            <small>${codigo} - R$ ${produto.preco.toFixed(2)} x ${qty}</small>
                        </div>
                        <div style="text-align: right;">
                            <strong>R$ ${subtotal.toFixed(2)}</strong><br>
                            <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" 
                                    onclick="app.removeFromCart('${codigo}')">Remover</button>
                        </div>
                    </div>
                `;
            }
        });

        html += `
            <div style="margin-top: 20px; padding: 20px; background: #667eea; color: white; border-radius: 10px; text-align: center;">
                <h2>Total do Pedido: R$ ${total.toFixed(2)}</h2>
            </div>
        `;

        container.innerHTML = html;
    },

    removeFromCart(codigo) {
        delete this.cart[codigo];
        this.saveData();
        this.renderMyCart();
        this.renderProducts(document.getElementById('searchInput').value);
        this.updateCartSummary();
    },

    finalizeOrder() {
        if (!this.currentUser) {
            alert('Por favor, digite seu nome primeiro!');
            document.getElementById('userName').focus();
            return;
        }

        if (Object.keys(this.cart).length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }

        const confirmar = confirm(`${this.currentUser}, deseja confirmar seu pedido de R$ ${this.calculateTotal().toFixed(2)}?`);
        
        if (confirmar) {
            // Salvar pedido
            if (!this.allOrders[this.currentUser]) {
                this.allOrders[this.currentUser] = {};
            }

            // Merge com pedido existente
            for (const [codigo, qty] of Object.entries(this.cart)) {
                if (this.allOrders[this.currentUser][codigo]) {
                    this.allOrders[this.currentUser][codigo] += qty;
                } else {
                    this.allOrders[this.currentUser][codigo] = qty;
                }
            }

            // Limpar carrinho
            this.cart = {};
            
            this.saveData();
            this.updateCartSummary();
            this.renderProducts();
            
            alert('Pedido finalizado com sucesso! ✓');
            this.switchTab('meu-pedido');
        }
    },

    loginAdmin() {
        const password = document.getElementById('adminPassword').value;
        
        if (password === this.adminPassword) {
            this.isAdminLoggedIn = true;
            document.getElementById('adminLoginSection').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            this.renderAdminPanel();
        } else {
            alert('Senha incorreta!');
        }
    },

    renderAdminPanel() {
        const container = document.getElementById('adminContent');
        
        let html = `
            <h2>Painel Administrativo</h2>
            <div style="margin-bottom: 20px;">
                <button class="btn btn-success" onclick="app.exportData()">📥 Exportar Dados</button>
                <button class="btn btn-danger" onclick="app.clearAllOrders()" style="margin-left: 10px;">🗑️ Limpar Todos os Pedidos</button>
            </div>
        `;

        // Relatório Consolidado
        html += '<div class="report-section">';
        html += '<div class="report-card">';
        html += '<div class="report-header">📊 Relatório Consolidado - Total por Produto</div>';
        
        const consolidated = this.getConsolidatedReport();
        
        if (consolidated.length === 0) {
            html += '<div class="alert alert-info">Nenhum pedido registrado ainda.</div>';
        } else {
            html += '<table><thead><tr><th>Código</th><th>Produto</th><th>Quantidade Total</th><th>Valor Unitário</th><th>Valor Total</th></tr></thead><tbody>';
            
            let totalGeral = 0;
            consolidated.forEach(item => {
                const valorTotal = item.quantidade * item.preco;
                totalGeral += valorTotal;
                html += `
                    <tr>
                        <td>${item.codigo}</td>
                        <td>${item.nome}</td>
                        <td><strong>${item.quantidade}</strong></td>
                        <td>R$ ${item.preco.toFixed(2)}</td>
                        <td><strong>R$ ${valorTotal.toFixed(2)}</strong></td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
            html += `<div style="margin-top: 20px; padding: 15px; background: #28a745; color: white; border-radius: 10px; text-align: center;">
                        <h3>Total Geral: R$ ${totalGeral.toFixed(2)}</h3>
                     </div>`;
        }
        
        html += '</div></div>';

        // Relatório Individual
        html += '<div class="report-section">';
        html += '<div class="report-card">';
        html += '<div class="report-header">👥 Relatório Individual - Pedidos por Pessoa</div>';
        
        const users = Object.keys(this.allOrders);
        
        if (users.length === 0) {
            html += '<div class="alert alert-info">Nenhum pedido registrado ainda.</div>';
        } else {
            users.forEach(user => {
                const userOrders = this.allOrders[user];
                let userTotal = 0;
                
                html += `<h3 style="margin-top: 20px; color: #667eea;">📋 ${user}</h3>`;
                html += '<table><thead><tr><th>Código</th><th>Produto</th><th>Quantidade</th><th>Valor Unit.</th><th>Subtotal</th></tr></thead><tbody>';
                
                for (const [codigo, qty] of Object.entries(userOrders)) {
                    const produto = PRODUTOS.find(p => p.codigo === codigo);
                    if (produto) {
                        const subtotal = produto.preco * qty;
                        userTotal += subtotal;
                        html += `
                            <tr>
                                <td>${codigo}</td>
                                <td>${produto.nome}</td>
                                <td>${qty}</td>
                                <td>R$ ${produto.preco.toFixed(2)}</td>
                                <td>R$ ${subtotal.toFixed(2)}</td>
                            </tr>
                        `;
                    }
                }
                
                html += `</tbody></table>`;
                html += `<div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px; text-align: right;">
                            <strong>Total de ${user}: R$ ${userTotal.toFixed(2)}</strong>
                         </div>`;
            });
        }
        
        html += '</div></div>';

        container.innerHTML = html;
    },

    getConsolidatedReport() {
        const consolidated = {};
        
        for (const user in this.allOrders) {
            for (const [codigo, qty] of Object.entries(this.allOrders[user])) {
                if (consolidated[codigo]) {
                    consolidated[codigo] += qty;
                } else {
                    consolidated[codigo] = qty;
                }
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

    exportData() {
        const consolidated = this.getConsolidatedReport();
        
        let csv = 'RELATÓRIO CONSOLIDADO\n\n';
        csv += 'Código,Produto,Quantidade Total,Valor Unitário,Valor Total\n';
        
        let totalGeral = 0;
        consolidated.forEach(item => {
            const valorTotal = item.quantidade * item.preco;
            totalGeral += valorTotal;
            csv += `${item.codigo},"${item.nome}",${item.quantidade},${item.preco.toFixed(2)},${valorTotal.toFixed(2)}\n`;
        });
        
        csv += `\n,,,Total Geral:,${totalGeral.toFixed(2)}\n\n\n`;
        
        csv += 'RELATÓRIO INDIVIDUAL\n\n';
        
        for (const user in this.allOrders) {
            csv += `\nPedido de: ${user}\n`;
            csv += 'Código,Produto,Quantidade,Valor Unitário,Subtotal\n';
            
            let userTotal = 0;
            for (const [codigo, qty] of Object.entries(this.allOrders[user])) {
                const produto = PRODUTOS.find(p => p.codigo === codigo);
                if (produto) {
                    const subtotal = produto.preco * qty;
                    userTotal += subtotal;
                    csv += `${codigo},"${produto.nome}",${qty},${produto.preco.toFixed(2)},${subtotal.toFixed(2)}\n`;
                }
            }
            csv += `\n,,,Total de ${user}:,${userTotal.toFixed(2)}\n\n`;
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `pedidos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    clearAllOrders() {
        if (confirm('ATENÇÃO: Isso irá apagar todos os pedidos registrados. Tem certeza?')) {
            if (confirm('Confirmação final: Realmente deseja apagar TODOS os pedidos?')) {
                this.allOrders = {};
                this.saveData();
                this.renderAdminPanel();
                alert('Todos os pedidos foram apagados.');
            }
        }
    },

    saveData() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        localStorage.setItem('allOrders', JSON.stringify(this.allOrders));
    },

    loadData() {
        const savedCart = localStorage.getItem('cart');
        const savedOrders = localStorage.getItem('allOrders');
        
        if (savedCart) {
            this.cart = JSON.parse(savedCart);
        }
        
        if (savedOrders) {
            this.allOrders = JSON.parse(savedOrders);
        }
    }
};

// Inicializar app quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
