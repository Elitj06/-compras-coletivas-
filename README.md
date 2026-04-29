# Compras Coletivas — Vida Forte Nutrientes

Plataforma de compras coletivas para a igreja Vida Forte. Membros fazem pedidos de produtos Vitafor/VitaPower, o administrador consolida e compra em grupo com desconto.

**URL de produção:** [compras-coletivas-phi.vercel.app](https://compras-coletivas-phi.vercel.app)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JS estático (vanilla), Google Fonts (Inter + Sora) |
| API | Edge Runtime (Vercel) — `/api/db.js` com `@vercel/postgres` |
| Upload | Node.js Runtime — `/api/upload-planilha.js` com `@neondatabase/serverless` |
| Banco | PostgreSQL (Supabase), schema isolado `compras_coletivas` |
| Hosting | Vercel (deploy automático via Git) |
| Catálogo | Gerado a partir de planilha Vitafor (`produtos.js`, `variantes.js`, `groups.js`) |

---

## Estrutura do Projeto

```
compras-coletivas/
├── api/
│   ├── db.js                  # API principal (Edge Runtime) — todas as rotas REST
│   └── upload-planilha.js     # Upload de planilha Excel (Node.js Runtime)
├── public/
│   ├── index.html             # SPA — página única com 4 abas
│   ├── app.js                 # Lógica do frontend (carrinho, pedidos, admin)
│   ├── styles.css             # Estilos com tema claro/escuro
│   ├── produtos.js            # Catálogo de produtos (gerado automaticamente)
│   ├── variantes.js           # Grupos de variantes (sabor/tamanho)
│   └── groups.js              # Taxonomia de categorias para filtro
├── sql/
│   ├── 01_schema_supabase.sql # Schema completo (tabelas, views, funções)
│   ├── 01_schema.sql          # Schema alternativo (sem views)
│   ├── 02_faixas_desconto.sql # Faixas de desconto progressivo
│   └── 03_pin_comprador.sql   # PIN hash para autenticação de compradores
├── docs/
│   └── API.md                 # Documentação completa da API
├── .env.example               # Template de variáveis de ambiente
├── package-lock.json          # Dependências (lockfile)
└── README.md                  # Este arquivo
```

---

## Funcionalidades

### Comprador
- Catálogo de produtos com busca, filtro por categoria e ordenação
- Grupos com variantes (sabor, tamanho) — ex: Aminovita (Limão/Maracujá × 240g/30 sachês)
- Carrinho persistido no localStorage
- Cadastro com nome, telefone, e-mail e PIN (4-6 dígitos)
- Login via PIN para acessar histórico
- Finalização de pedido com desconto automático
- Visualização de pedido enviado (editar ou cancelar)
- Histórico de pedidos com detalhes

### Administrador
- Login por senha (armazenada no banco)
- Dashboard com estatísticas (compradores, unidades, valores)
- Desconto global aplicável a todos os pedidos
- Painel por comprador — ver/editar itens, alterar quantidades
- Liberar pedido para edição pelo comprador
- Mesclar pedidos duplicados de um comprador
- Adicionar item a pedido existente
- Remover produto de todos os pedidos (fornecedor em falta)
- Exportar pedido consolidado (Excel `.xlsx` ou CSV)
- Apagar pedidos (individual ou em massa)

---

## Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Conta no Vercel CLI (`npm i -g vercel`)
- Acesso ao Supabase (ou Neon) com o schema `compras_coletivas`

### Instalação

```bash
git clone https://github.com/Elitj06/-compras-coletivas-.git
cd -compras-coletivas-
npm install
```

### Configuração

Crie um `.env` na raiz (ou configure no Vercel dashboard):

```env
POSTGRES_URL=postgresql://postgres.vpmfuhvgnbqovclwaudz:[SENHA]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true&options=--search_path%3Dcompras_coletivas
```

> **Importante:** Use o **Connection Pooler** (Supavisor) — a conexão direta não funciona no Edge Runtime.

### Desenvolvimento

```bash
vercel dev
```

Acesse `http://localhost:3000`.

### Deploy

```bash
vercel --prod
```

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `POSTGRES_URL` | Sim | URL de conexão PostgreSQL com search_path=compras_coletivas |
| `DATABASE_URL` | Alternativa | Usada pelo upload-planilha.js (Neon) |

---

## Banco de Dados

O schema `compras_coletivas` é isolado dentro do Supabase do FitFlow. Tabelas principais:

- **categorias** — categorias de produtos
- **produtos** — catálogo (código, nome, preço, embalagem, imagem)
- **compradores** — compradores cadastrados (nome, telefone, email, pin_hash)
- **pedidos** — pedidos (usuario, status, totais)
- **itens_pedido** — itens de cada pedido
- **descontos** — descontos por categoria ou global
- **faixas_desconto** — faixas de desconto progressivo
- **configuracoes** — chave-valor (admin_senha, prazo, etc.)

Views: `vw_dashboard_stats`, `vw_relatorio_produtos`, `vw_relatorio_compradores`

Funções: `aplicar_desconto()`, `calcular_desconto_progressivo()`, `recalcular_pedido()`

---

## Segurança

- Senha admin armazenada em texto no banco (pendência: migrar para hash)
- Compradores autenticam via PIN (SHA-256 com salt)
- Proteção contra pedidos duplicados (60s de janela)
- CORS liberado (`Access-Control-Allow-Origin: *`)

### Pendências de segurança
- [ ] Mover senha admin para env var ou hash
- [ ] Implementar autenticação real (JWT)
- [ ] Rate limiting nos endpoints
- [ ] Validação de input mais rigorosa

---

## Agente guia-compras

O projeto tem um agente WhatsApp (`guia-compras`) que ajuda compradores a fazer pedidos pelo WhatsApp. Ver documentação do agente para detalhes.

---

## Licença

Projeto privado — uso exclusivo da Vida Forte.
