# Compras Coletivas Vitafor — STATE

**Projeto iniciado:** 2026-04-06
**Responsável:** TJ (agente guia-compras)
**Grupo WhatsApp:** 120363405060387448@g.us (23 participantes) — agente: guia-compras

---

## 🔄 Atualização 2026-04-08 00:32 UTC

**Status:** ✅ CORREÇÕES CONCLUÍDAS

### O que foi feito (CORREÇÕES PENDENTES)

#### 1. ✅ Senha admin hardcoded removida (ISSUE ALTA)
- **Problema:** Fallback hardcoded `admin123` no `/api/db.js` na rota `admin/login`
- **Solução:** Removido o fallback. Agora retorna erro 500 se senha de admin não estiver configurada no banco
- **Impacto de segurança:** Elimina credencial padrão em produção
- **Arquivo modificado:** `api/db.js`

#### 2. ✅ Estrutura de arquivos limpa
- Removida pasta `APP COMPRAS COLETIVAS/` (cópias obsoletas de app.js, index.html, produtos.js)
- `index.html` atualizado (v5.1 com toggle de password) copiado para `public/`
- Estrutura final: `public/` → arquivos estáticos (Vercel), `api/` → serverless, `data/` → planilhas

#### 3. ✅ Deploy em produção
- Commit: `64c85b9` — "fix: remove admin password fallback and clean up file structure"
- Push para GitHub: ✅
- Deploy Vercel: automático via git integration
- URL: `https://compras-coletivas-git-main-eliandro-tjader.vercel.app`

### Issues resolvidas:
- [x] Senha admin hardcoded (Alta)
- [x] Arquivos duplicados (Baixa)

### Issues pendentes:
- [ ] GitHub Actions Neon — workflow obsoleto (não encontrado, pode já ter sido deletado)
- [ ] Excel no Edge Runtime — `upload-planilha.js` não processa .xlsx de fato (Média)
- [ ] Faixas progressivas — Frontend não aplica faixas do banco (Média)

---

## 🔄 Atualização 2026-04-07 21:37 UTC

**Status:** ✅ CONCLUÍDA

### O que foi feito

#### 1. Agrupamento de Categorias no Banco ✅
- Criadas 5 novas categorias agrupadas:
  - **COLÁGENOS** (id 208): unifica COLAGENTEK, PROTEIN, II, BEAUTY, HYALURONIC HAIR
  - **WHEY PROTEIN** (id 209): unifica WHEY FORT, WPC POUCH, ISOCRISP WHEY, ISOLATE, AIR COM WHEY
  - **VITAMINAS E MINERAIS** (id 210): unifica VITA D3, C3, FERRO/MAGNÉSIO/CÁLCIO PLUS, COQ-10
  - **AMINOÁCIDOS, CREATINA E GLUTAMINA** (id 211): unifica AMINOVITA, BCAAFORT, GLUTAMAX, CREATINE, CREAFORT, BETA ALANINA
  - **ÔMEGA 3** (id 212): unifica OMEGAFOR PLUS/FAMILY/VITAMINS, MEGA DHA, KRILL VIT
- 31 categorias antigas excluídas após migração dos produtos

#### 2. Fluxo de Cadastro Obrigatório ✅
- Adicionado `isRegistered: false` no objeto `app`
- Modal de cadastro aparece na primeira interação com o carrinho
- Validação: nome completo (deve ter sobrenome) + telefone
- Dados salvos no localStorage (`userRegistered`, `registeredName`, `registeredPhone`)
- Bloqueio de adição ao carrinho e finalização sem cadastro
- Aba "Meu Pedido" mostra card com dados do cadastro confirmado
- CSS do modal e card de registro adicionados ao index.html

#### 3. Produtos com Imagens Corrigidas ✅
- Removidas imagens incorretas dos produtos COQ10 (CQ30, CQ60, CQ120, COQ60)
  - Esses tinham badges de dosagem ("100mg/200mg por cápsula") em vez de fotos
  - Imagens limpas → produtos agora aparecem sem foto (placeholder)
- Produtos VPA600CCT e VPA280CCT (LANÇAMENTO) mantidos com imagem real (~4KB)
  - Têm foto real de produto, não o selo dourado

### Arquivos Modificados
- `/root/projects/compras-coletivas/public/app.js` — cadastro obrigatório + toggle de visualização de senha
- `/root/projects/compras-coletivas/index.html` — estilos do modal de registro + toggle de senha
- `/root/projects/compras-coletivas/public/produtos.js` — imagens COQ10 removidas
- Banco de dados Supabase — categorias agrupadas

---

## 🔄 Migração Neon → Supabase (2026-04-07)

**Status:** ✅ CONCLUÍDA

### O que foi feito
- Schema isolado `compras_coletivas` criado no Supabase (projeto fitflow-ia)
- 244 produtos + 103 categorias populados
- Coluna `imagem` corrigida: `VARCHAR(500)` → `TEXT`
- Tabela `faixas_desconto` criada (40/44/48%)
- API `db.js` e `upload-planilha.js`: search_path via connection string
- Env var `DATABASE_URL` atualizada no Vercel
- `.env.local` removido do git (estava exposto com senha)

### Credenciais
- **Supabase:** `postgresql://postgres.vpmfuhvgnbqovclwaudz:*Glockblss213@aws-0-us-west-2.pooler.supabase.com:5432/postgres`
- Schema: `compras_coletivas`

### Deploy
- URL: compras-coletivas-ct345rzrw-eliandro-tjader.vercel.app
- Status: READY

---

## Contexto

App de compras coletivas para produtos Vitafor. O grupo já está formado com 23 participantes.

---

## Estado Atual (2026-04-07 12:50 UTC)

### ✅ Planilha Processada e Analisada

**Arquivo:** `/root/projects/compras-coletivas/data/TABELA_DE_PEDIDO_VITAFOR_2026_14.xlsx`

**Conteúdo Extraído:**
- **Aba VITA:** 220 produtos (ex: AM240LI, AGF30, BF210LI)
- **Aba VITAPOWER:** 24 produtos (ex: VPI1005TR, VPP1005BB)
- **Total:** 244 produtos

**Estrutura da planilha:**
- Códigos de produto (ex: AM240LI, AGF30, BF210LI)
- Nomes dos produtos com sabor
- Preços brutos por unidade/caixa
- Tabela de descontos por volume:
  - R$1.000-R$2.999,99 = 40%
  - R$3.000-R$7.999,99 = 44%
  - Acima de R$8.000 = 48%
- Quantidade por caixa (embalagem fechada)
- NCM para cada produto

**Dados Processados:**
- **Arquivo JSON:** `/root/projects/compras-coletivas/data/produtos.json` (244 produtos)
- **Script Python:** `/root/projects/compras-coletivas/process_planilha.py`
- **Banco Supabase:** 244 produtos importados na tabela `produtos` (schema `compras_coletivas`)

### ✅ Banco de Dados Configurado

**Schema isolado:** `compras_coletivas` no Supabase (projeto fitflow-ia)

**Tabelas:**
- `categorias` — 103 categorias de produtos
- `produtos` — 244 produtos com códigos, nomes, preços, categorias
- `descontos` — 103 registros de descontos por categoria
- `faixas_desconto` — 3 faixas progressivas (40/44/48%)
- `compradores` — cadastro de compradores (nome, telefone, email)
- `pedidos` — pedidos consolidados
- `itens_pedido` — itens de cada pedido

**Views:**
- `vw_dashboard_stats` — estatísticas gerais (total pedidos, descontos, etc.)
- `vw_relatorio_produtos` — relatório de produtos vendidos
- `vw_relatorio_compradores` — relatório por comprador

### ✅ API Vercel Edge Functions

**Endpoints implementados:**
- `GET /api/db` — health check
- `GET /api/db/produtos` — listar produtos
- `GET /api/db/pedidos` — listar pedidos
- `GET /api/db/pedidos/consolidado` — relatório consolidado
- `GET /api/db/descontos` — listar descontos
- `GET /api/db/faixas-desconto` — listar faixas progressivas
- `GET /api/db/categorias` — listar categorias
- `GET /api/db/compradores` — listar compradores
- `POST /api/db/pedidos` — criar pedido
- `POST /api/db/descontos` — aplicar desconto
- `DELETE /api/db/pedidos` — apagar todos os pedidos
- `DELETE /api/db/descontos` — limpar descontos

### ✅ Frontend (v5.1)

**Arquivos:**
- `public/index.html` — interface principal
- `public/app.js` — lógica da aplicação (736 linhas)
- `public/produtos.js` — catálogo de produtos (gerado da planilha)

**Funcionalidades:**
- Busca de produtos por código ou nome
- Filtro por categorias (pills + grid selector)
- Carrinho de compras com cálculo automático
- Aplicação de descontos por categoria
- Aplicação de faixas progressivas de desconto
- Finalização de pedido
- Login admin (senha configurada no banco)
- Painel admin (relatórios, gerenciar pedidos, descontos)

---

## Pendências

### Backend
- [ ] Implementar rota `POST /api/db/upload-planilha` para processar .xlsx
- [ ] Testar integração com Evolution API para envio de pedido

### Frontend
- [ ] Implementar faixas progressivas de desconto no carrinho
- [ ] Adicionar modal de confirmação antes de finalizar pedido

### Infraestrutura
- [ ] Configurar domínio personalizado no Vercel
- [ ] Otimizar imagens (WebP)

---

## Decisões

### Faixas de Desconto
- **R$1.000-R$2.999,99** → 40%
- **R$3.000-R$7.999,99** → 44%
- **Acima de R$8.000** → 48%

### Categorias Agrupadas
Para melhorar UX, categorias semelhantes foram agrupadas:
- COLÁGENOS: COLAGENTEK, PROTEIN, II, BEAUTY, HYALURONIC HAIR
- WHEY PROTEIN: WHEY FORT, WPC POUCH, ISOCRISP WHEY, ISOLATE, AIR COM WHEY
- VITAMINAS E MINERAIS: VITA D3, C3, FERRO/MAGNÉSIO/CÁLCIO PLUS, COQ-10
- AMINOÁCIDOS, CREATINA E GLUTAMINA: AMINOVITA, BCAAFORT, GLUTAMAX, CREATINE, CREAFORT, BETA ALANINA
- ÔMEGA 3: OMEGAFOR PLUS/FAMILY/VITAMINS, MEGA DHA, KRILL VIT

---

## Próximos Passos

1. Testar aplicação completa no grupo WhatsApp
2. Configurar agente `guia-compras` (binding pendente)
3. Implementar upload de planilha no backend
4. Integrar com Evolution API para notificações
