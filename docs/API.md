# API — Compras Coletivas

Todas as rotas estão sob `/api/db` (Edge Runtime) ou `/api/upload-planilha` (Node.js Runtime).

**Base URL:** `/api/db`

**Headers comuns:**
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

---

## Índice

### GET
- [Ciclos de Compra](#get-ciclos-compra)
- [Health Check](#get-health)
- [Tabelas](#get-tables)
- [Pedidos (todos)](#get-pedidos)
- [Pedidos por Usuário](#get-pedidospor-usuario)
- [Pedidos Consolidado](#get-pedidosconsolidado)
- [Estatísticas](#get-stats)
- [Descontos](#get-descontos)
- [Faixas de Desconto](#get-faixas-desconto)
- [Categorias](#get-categorias)
- [Compradores](#get-compradores)
- [Lista de Compradores](#get-compradoreslista)
- [Histórico de Pedidos](#get-pedidoshistorico)
- [Exportar CSV](#get-exportar-csv)

### POST
- [Criar Pedido](#post-pedidos)
- [Aplicar Desconto](#post-descontos)
- [Registrar Comprador](#post-compradorregistro)
- [Login Comprador](#post-compradorlogin)
- [Login Admin](#post-adminlogin)

### PUT
- [Alterar Status do Pedido](#put-pedidoidstatus)
- [Alterar Status por Usuário](#put-pedidosusuarionamestatus)
- [Alterar Quantidade de Item](#put-itensidqty)
- [Mesclar Pedidos do Usuário](#put-pedidosusuarionamemerge)
- [Adicionar Item ao Pedido](#put-pedidoiditens)

### DELETE
- [Apagar Todos os Pedidos](#delete-pedidos)
- [Apagar Pedido por ID](#delete-pedidosid)
- [Apagar Pedidos por Usuário](#delete-pedidosusuarioname)
- [Remover Item](#delete-itensid)
- [Remover Produto Global](#delete-produtoscodigo)
- [Desativar Descontos](#delete-descontos)

### Upload
- [Upload de Planilha](#post-apiupload-planilha)

---

## GET

### GET /ciclos-compra

Lista os ciclos de compra para o administrador. O registro com `ativo: true` define o escopo padrão do painel, consolidados, pagamentos e exportações. Pedidos antigos não são removidos: permanecem associados ao seu ciclo.

**Autorização:** sessão de administrador.

### GET /health

Verifica se a API está online.

**Response `200`:**
```json
{
  "success": true,
  "message": "Compras Coletivas API online",
  "tabelas": "8",
  "timestamp": "2026-04-29T13:00:00.000Z"
}
```

---

### GET /tables

Lista todas as tabelas do schema `compras_coletivas`.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "table_name": "categorias" },
    { "table_name": "compradores" },
    { "table_name": "configuracoes" },
    { "table_name": "descontos" },
    { "table_name": "faixas_desconto" },
    { "table_name": "itens_pedido" },
    { "table_name": "pedidos" },
    { "table_name": "produtos" }
  ]
}
```

---

### GET /pedidos

Lista todos os itens de pedidos (exceto cancelados), com dados do pedido.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "pedido_id": 5,
      "codigo": "AGF120",
      "nome_produto": "Arginofor 120 cáps",
      "quantidade": 2,
      "preco_unitario": 89.90,
      "preco_com_desconto": 53.94,
      "subtotal_bruto": 179.80,
      "subtotal_final": 107.88,
      "categoria": "aminoacidos",
      "usuario": "João Silva",
      "status": "pendente",
      "pedido_data": "2026-04-28T10:00:00Z"
    }
  ]
}
```

---

### GET /pedidos/por-usuario

Lista pedidos agregados por comprador com itens detalhados.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "usuario": "João Silva",
      "telefone": "21998887766",
      "email": "joao@email.com",
      "pedido_ids": [5, 8],
      "statuses": ["pendente"],
      "itens": [
        {
          "item_id": 12,
          "pedido_id": 5,
          "codigo": "AGF120",
          "nome": "Arginofor 120 cáps",
          "quantidade": 2,
          "preco_bruto": 89.90,
          "preco_desconto": 53.94,
          "categoria": "aminoacidos"
        }
      ],
      "total_itens": 5,
      "total_bruto": 450.00,
      "total_desconto": 270.00
    }
  ]
}
```

---

### GET /pedidos/consolidado

Relatório consolidado de produtos (view `vw_relatorio_produtos`). Soma quantidades de todos os pedidos por produto.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "codigo": "AGF120",
      "nome": "Arginofor 120 cáps",
      "categoria": "aminoacidos",
      "preco_unitario": 89.90,
      "desconto_percentual": 40.00,
      "preco_com_desconto": 53.94,
      "quantidade_total": 8,
      "total_bruto": 719.20,
      "total_final": 431.52
    }
  ]
}
```

---

### GET /stats

Estatísticas gerais do dashboard (view `vw_dashboard_stats`).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "total_compradores": 15,
    "produtos_distintos": 42,
    "unidades_totais": 120,
    "valor_bruto_geral": 12500.00,
    "economia_geral": 5000.00,
    "valor_final_geral": 7500.00
  }
}
```

---

### GET /descontos

Lista descontos ativos.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "categoria": "todos",
      "percentual": 40.00,
      "ativo": true
    }
  ]
}
```

---

### GET /faixas-desconto

Lista faixas de desconto progressivo ativas.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "nome": "Até R$ 3.000", "valor_minimo": 0, "valor_maximo": 3000, "percentual": 0 },
    { "nome": "R$ 3.000 - R$ 5.000", "valor_minimo": 3000, "valor_maximo": 5000, "percentual": 42 },
    { "nome": "R$ 5.000 - R$ 8.000", "valor_minimo": 5000, "valor_maximo": 8000, "percentual": 43 },
    { "nome": "Acima de R$ 8.000", "valor_minimo": 8000, "valor_maximo": null, "percentual": 44 }
  ]
}
```

---

### GET /categorias

Lista todas as categorias de produtos.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "slug": "aminoacidos", "nome": "Aminoácidos" }
  ]
}
```

---

### GET /compradores

Relatório de compradores com totais (view `vw_relatorio_compradores`).

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "comprador": "João Silva",
      "total_pedidos": 2,
      "valor_bruto_total": 450.00,
      "economia_total": 180.00,
      "valor_final_total": 270.00
    }
  ]
}
```

---

### GET /compradores/lista

Lista todos os compradores com contagem de pedidos. Usado pelo admin para selecionar um comprador.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "nome": "João Silva",
      "telefone": "21998887766",
      "email": "joao@email.com",
      "has_pin": true,
      "total_pedidos": 2
    }
  ]
}
```

---

### GET /pedidos/historico

Histórico de pedidos de um comprador. O comprador usa seu Bearer token, sem
parâmetros. O administrador pode consultar informando nome e telefone.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `usuario` | string | Só para admin | Nome do comprador |
| `telefone` | string | Só para admin | Telefone cadastrado |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "created_at": "2026-04-28T10:00:00Z",
      "status": "pendente",
      "total_bruto": 450.00,
      "total_final": 270.00,
      "total_desconto": 180.00,
      "itens": [
        {
          "item_id": 12,
          "codigo": "AGF120",
          "nome": "Arginofor 120 cáps",
          "quantidade": 2,
          "preco_bruto": 89.90,
          "preco_desconto": 53.94,
          "subtotal_bruto": 179.80,
          "subtotal_final": 107.88
        }
      ]
    }
  ]
}
```

**Error `401`:**
```json
{ "success": false, "error": "Não autorizado" }
```

---

### GET /exportar-csv

Exporta todos os pedidos em formato CSV (separador `;`, encoding UTF-8 BOM).

**Response `200`:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename=relatorio_compras_coletivas.csv`

Colunas: `Comprador;Código;Produto;Qtd;Preço Unit.;Desconto %;Preço c/ Desc.;Total Bruto;Total Final;Data`

---

## POST

### POST /pedidos

Cria um novo pedido com itens.

Telefone e e-mail do corpo são usados apenas para validar a sessão. Esta rota
não altera mais a identidade persistida do comprador.

**Body:**
```json
{
  "usuario": "João Silva",
  "telefone": "21998887766",
  "email": "joao@email.com",
  "itens": [
    {
      "codigo": "AGF120",
      "nome": "Arginofor 120 cáps",
      "quantidade": 2,
      "preco_bruto": 89.90,
      "preco_desconto": 53.94,
      "desconto": 40,
      "categoria": "aminoacidos"
    }
  ]
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Pedido de João Silva registrado com 1 itens",
  "pedido_id": 15
}
```

**Proteção anti-duplicação:** Se já existe um pedido pendente do mesmo usuário criado nos últimos 60 segundos, retorna:

**Response `409`:**
```json
{
  "success": false,
  "duplicate": true,
  "error": "Pedido recente já existe. Aguarde ou edite o pedido existente."
}
```

**Error `400`:**
```json
{ "success": false, "error": "Dados incompletos" }
```

---

### POST /descontos

Aplica desconto global ou por categoria. Chama a função `aplicar_desconto()` no banco.

**Body:**
```json
{
  "categoria": "todos",
  "percentual": 40
}
```

- Quando `categoria = "todos"`, recalcula preços e totais de TODOS os pedidos.
- Suporta qualquer nome de categoria.

**Response `200`:**
```json
{ "success": true, "message": "Desconto de 40% aplicado em todos" }
```

**Error `400`:**
```json
{ "success": false, "error": "Dados incompletos" }
```

---

### POST /comprador/registro

Cria um cadastro novo com PIN. A rota é `create-only`: nunca altera identidade
ou PIN de comprador existente.

**Body:**
```json
{
  "nome": "João Silva",
  "telefone": "21998887766",
  "email": "joao@email.com",
  "pin": "1234"
}
```

**Response `201`:**
```json
{ "success": true, "message": "Cadastro criado com PIN", "token": "..." }
```

**Response `409` (telefone ou e-mail equivalente já existe):**
```json
{
  "success": false,
  "error": "Cadastro já existe. Entre ou recupere seu PIN.",
  "code": "IDENTITY_ALREADY_REGISTERED"
}
```

**Response `400`:**
```json
{ "success": false, "error": "Nome, telefone e e-mail válidos são obrigatórios" }
```

**Notas:**
- PIN: 4 a 6 dígitos numéricos
- Hash PBKDF2-SHA256 com 210 mil iterações e salt aleatório
- Cadastro concorrente é serializado por telefone e e-mail normalizados

---

### POST /comprador/login

Autentica comprador via PIN.

**Body recomendado (telefone ou e-mail):**
```json
{
  "identificador": "21998887766",
  "pin": "1234"
}
```

**Body legado (mantido para clientes em cache):**
```json
{
  "nome": "João Silva",
  "telefone": "21998887766",
  "pin": "1234"
}
```

**Response `200`:**
```json
{
  "success": true,
  "token": "...",
  "comprador": {
    "id": 12,
    "nome": "João Silva",
    "telefone": "21998887766",
    "email": "joao@email.com"
  },
  "data": {
    "id": 12,
    "nome": "João Silva",
    "telefone": "21998887766",
    "email": "joao@email.com",
    "token": "..."
  }
}
```

**Response `401`:**
```json
{ "success": false, "error": "Credenciais inválidas", "code": "INVALID_CREDENTIALS" }
```

**Compatibilidade de hash:** o login verifica tanto SHA-256 legado com salt
`nome:telefone` quanto envelopes `pbkdf2:sha256:<iterações>:<salt>:<hash>`.
Com `PIN_HASH_MIGRATION_ENABLED=true`, um login legado válido migra o hash para
PBKDF2. Inexistência, duplicidade, conta sem PIN e PIN incorreto usam a mesma
resposta pública.

---

### POST /api/pin-recovery-request

Solicita código de seis dígitos por e-mail. Sempre retorna `202` com a mesma
mensagem e um `challenge_id` opaco, inclusive para identificador inexistente,
ambíguo, limitado ou com falha de entrega.

```json
{ "identificador": "joao@email.com" }
```

```json
{
  "success": true,
  "message": "Se os dados estiverem aptos, você receberá as instruções em instantes.",
  "challenge_id": "64-caracteres-hexadecimais"
}
```

O código expira em 10 minutos, aceita cinco tentativas e funciona uma vez.

---

### POST /comprador/pin-recovery/complete

```json
{ "challenge_id": "...", "code": "123456", "new_pin": "5678" }
```

Sucesso revoga todas as sessões e exige novo login. Código inválido, expirado,
usado ou bloqueado retorna `400 INVALID_OR_EXPIRED_RECOVERY`.

---

### POST /comprador/logout

Exige Bearer de comprador, revoga somente a sessão apresentada e retorna `204`.

---

### POST /admin/compradores/:id/pin-recovery

Exige Bearer administrativo e validação humana registrada.

```json
{
  "verification_method": "WhatsApp",
  "verification_note": "Confirmou telefone e último pedido"
}
```

Retorna uma única vez `challenge_id`, código temporário de seis dígitos e
expiração. O administrador nunca define nem visualiza o novo PIN.

---

### POST /admin/login

Autentica administrador.

**Body:**
```json
{ "senha": "sua-senha-administrativa" }
```

**Response `200`:**
```json
{ "success": true, "message": "Login autorizado" }
```

**Response `401`:**
```json
{ "success": false, "error": "Senha incorreta" }
```

**Response `500` (senha não configurada):**
```json
{ "success": false, "error": "Senha de admin não configurada no banco" }
```

---

## PUT

### PUT /comprador/pin

Exige Bearer de comprador.

```json
{ "current_pin": "1234", "new_pin": "5678" }
```

Sucesso revoga todas as sessões anteriores, cria uma sessão substituta e
retorna o novo `token`. O PIN atual incorreto retorna `401` sem encerrar a sessão.

---

### PUT /pedidos/:id/status

Altera o status de um pedido.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | integer | ID do pedido |

**Body:**
```json
{ "status": "confirmado" }
```

**Status válidos:** `pendente`, `confirmado`, `cancelado`, `entregue`, `aberto_edicao`

- `aberto_edicao` — libera o pedido para o comprador editar
- `confirmado` — reverte de "em edição" para pendente

**Response `200`:**
```json
{ "success": true, "message": "Pedido 15 → confirmado" }
```

**Response `400`:**
```json
{ "success": false, "error": "Status inválido. Opções: pendente, confirmado, cancelado, entregue, aberto_edicao" }
```

**Response `404`:**
```json
{ "success": false, "error": "Pedido não encontrado" }
```

---

### PUT /pedidos/usuario/:name/status

Altera o status de TODOS os pedidos de um comprador.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do comprador (URL-encoded) |

**Body:**
```json
{ "status": "confirmado" }
```

**Response `200`:**
```json
{ "success": true, "message": "2 pedido(s) de João Silva → confirmado" }
```

---

### PUT /itens/:id/qty

Altera a quantidade de um item específico. Recalcula automaticamente os totais do pedido.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | integer | ID do item (itens_pedido.id) |

**Body:**
```json
{ "quantidade": 3 }
```

**Response `200`:**
```json
{ "success": true, "message": "Quantidade atualizada para 3" }
```

**Response `400`:**
```json
{ "success": false, "error": "Quantidade deve ser >= 1" }
```

**Response `404`:**
```json
{ "success": false, "error": "Item não encontrado" }
```

---

### PUT /pedidos/usuario/:name/merge

Mescla todos os pedidos de um comprador em um único pedido. Mantém o mais recente; itens iguais têm quantidades somadas.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do comprador (URL-encoded) |

**Body:** `{}` (vazio)

**Response `200`:**
```json
{
  "success": true,
  "message": "2 pedido(s) duplicado(s) removido(s). Pedido 15 mantido."
}
```

Se só tem 1 pedido:
```json
{ "success": true, "message": "Apenas 1 pedido encontrado, nada a mesclar." }
```

---

### PUT /pedidos/:id/itens

Adiciona um item a um pedido existente. Se o produto já existe no pedido, incrementa a quantidade.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | integer | ID do pedido |

**Body:**
```json
{
  "codigo": "AGF120",
  "nome": "Arginofor 120 cáps",
  "quantidade": 1,
  "preco_bruto": 89.90,
  "preco_desconto": 53.94,
  "categoria": "aminoacidos"
}
```

**Response `200`:**
```json
{ "success": true, "message": "Item Arginofor 120 cáps adicionado ao pedido 15" }
```

**Response `400`:**
```json
{ "success": false, "error": "Dados do item incompletos" }
```

---

## DELETE

### DELETE /pedidos

Apaga TODOS os pedidos e itens. ⚠️ Irreversível.

**Response `200`:**
```json
{ "success": true, "message": "Todos os pedidos foram apagados" }
```

---

### DELETE /pedidos/:id

Apaga um pedido específico e seus itens.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | integer | ID do pedido |

**Response `200`:**
```json
{ "success": true, "message": "Pedido 15 cancelado" }
```

**Response `404`:**
```json
{ "success": false, "error": "Pedido não encontrado" }
```

---

### DELETE /pedidos/usuario/:name

Apaga todos os pedidos de um comprador.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do comprador (URL-encoded) |

**Response `200`:**
```json
{ "success": true, "message": "2 pedido(s) de João Silva apagados" }
```

---

### DELETE /itens/:id

Remove um item específico. Se o pedido fica sem itens, ele é removido automaticamente.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | integer | ID do item (itens_pedido.id) |

**Response `200`:**
```json
{ "success": true, "message": "Item 12 removido" }
```

**Response `404`:**
```json
{ "success": false, "error": "Item não encontrado" }
```

---

### DELETE /produtos/:codigo

Remove todas as ocorrências de um produto (por código) de TODOS os pedidos. Pedidos que ficam vazios são removidos. Útil quando o fornecedor está em falta.

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `codigo` | string | Código do produto (URL-encoded) |

**Response `200`:**
```json
{ "success": true, "message": "3 ocorrência(s) do produto AGF120 removidas" }
```

---

### DELETE /descontos

Desativa todos os descontos (set `ativo = FALSE`).

**Response `200`:**
```json
{ "success": true, "message": "Descontos desativados" }
```

---

## Upload

### POST /api/upload-planilha

Faz upload de planilha Excel com catálogo de produtos. **Node.js Runtime** (não Edge).

**Autenticação:** Query param `key` ou header `X-Admin-Key` com a senha admin.

**Content-Type:** `multipart/form-data` (campo `planilha` ou `file`) ou `application/json` com campo `data` (base64).

**Formatos aceitos:**
- JSON (base64 encoded): array de `{ codigo, nome, preco, categoria, embalagem }`
- CSV: linhas com `codigo;nome;preco;categoria;embalagem`

**Response `200`:**
```json
{
  "success": true,
  "message": "Importação concluída!",
  "resumo": {
    "total": 150,
    "atualizados": 120,
    "inseridos": 30,
    "ignorados": 0
  }
}
```

**Response `401`:**
```json
{ "success": false, "error": "Não autorizado" }
```

---

## Códigos de Erro

| Status | Significado |
|---|---|
| `400` | Dados incompletos ou inválidos |
| `401` | Não autorizado (senha/PIN incorreto) |
| `404` | Recurso não encontrado |
| `409` | Conflito (duplicata, PIN já existe) |
| `500` | Erro interno do servidor |

Todos os erros seguem o formato:
```json
{ "success": false, "error": "Mensagem descritiva" }
```

Campos adicionais podem estar presentes (ex: `duplicate`, `not_found`, `requires_current_pin`).
