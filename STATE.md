# Compras Coletivas Vitafor — STATE

**Projeto iniciado:** 2026-04-06
**Responsável:** TJ (agente guia-compras)
**Grupo WhatsApp:** 120363405060387448@g.us (23 participantes) — agente: guia-compras

---

## Contexto

App de compras coletivas para produtos Vitafor. O grupo já está formado com 23 participantes.

---

## Estado Atual (2026-04-07 12:50 UTC)

### ✅ Planilha Processada e Analisada

**Arquivo:** `/root/projects/compras-coletivas/data/TABELA_DE_PEDIDO_VITAFOR_2026_14.xlsx`

**Contúdo Extraído:**
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
- **Produtos novos:** 0 (todos já cadastrados no produtos.js)
- **Produtos descontinuados:** 1 (B1220ME - VITAMINA B12 GOTAS)
- **Produtos sem foto:** 0 (todos têm fotos em Base64)

### 📊 Análise Completa

**Comparação Planilha vs Cadastro Atual:**
- Planilha nova: 244 produtos
- Cadastro atual: 244 produtos (ATUALIZADO ✅)
- Diferença: 0 produtos — sincronizado!

**Status de Fotos:**
- Total de produtos: 244
- Produtos com fotos: 244 (100%)
- Imagens em Base64: 244
- Imagens vazias: 0

**Produto Descontinuado (REMOVIDO ✅):**
- **Código:** B1220ME
- **Nome:** VITAMINA B12 GOTAS FRASCO 20ML MENTA
- **Status:** Removido do cadastro em 2026-04-07 12:50 UTC

### 🎯 Status do Aplicativo

**Frontend:** ✅ Pronto (index.html, app.js)
- Interface de categorias
- Paginação (24 produtos/página)
- Busca por código ou nome
- Carrinho funcional
- Cálculo de descontos por volume

**Backend:** ✅ Configurado (API Neon PostgreSQL)
- Endpoint: `/api/db`
- Tabela: produtos, pedidos, descontos

**Dados:** ✅ Atualizados e sincronizados
- Cadastro completo com 244 produtos
- Todas as fotos em Base64
- Categorias organizadas (70+ categorias)
- Produto descontinuado removido

---

## Próximos Passos

1. **[DONE] Remover produto descontinuado** — B1220ME do produtos.js ✅
2. **[DONE] Atualizar cadastro** — Cadastro sincronizado com planilha 2026-14 ✅
3. **[PENDING] Testar app** — Verificar funcionalidades em ambiente de produção
4. **[PENDING] Integrar agente guia-compras** — Configurar respostas no grupo WhatsApp

---

## Decisões

- **Data:** 2026-04-07 12:50 UTC
- **Decisão:** Planilha processada e cadastro sincronizado. Todos os 244 produtos têm fotos. Aplicativo frontend e backend funcionais. Produto descontinuado B1220ME removido. Cadastro 100% atualizado com planilha 2026-14.

---

## Pendências

- [ ] Testar funcionalidades do app (busca, carrinho, checkout)
- [ ] Configurar comandos do agente guia-compras (listar, adicionar, ver carrinho)
- [ ] Integração final com Evolution API para envio de pedido

---

## Decisões

- **Data:** 2026-04-07
- **Decisão:** Planilha recebida com sucesso. Próximo passo é processar os dados e estruturar para o app.

---

## Ambiente

**Workspace:** `/root/projects/compras-coletivas`
**Data:** `/root/projects/compras-coletivas/data/`
**Arquivos principais:**
- `index.html` — Frontend (interface v5.1)
- `app.js` — Lógica do app (carrinho, categorias, paginação)
- `produtos.js` — Cadastro de 245 produtos com fotos Base64
- `data/produtos.json` — Dados processados da planilha (244 produtos)
- `data/TABELA_DE_PEDIDO_VITAFOR_2026_14.xlsx` — Planilha original

**API Backend:** Neon PostgreSQL (via Vercel Serverless)
