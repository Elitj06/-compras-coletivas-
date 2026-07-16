# Plano — hardening de pedidos, sessões e dependências

## Controle da tarefa

- **Task id:** `2026-07-security-hardening`
- **Risco / lane:** alto / release. Há integridade financeira de pedidos, autenticação, banco, dependências e produção.
- **Deep Architecture:** sim. A troca de token exposto no navegador por sessão em cookie altera autenticação, contratos HTTP e todos os clientes da API.
- **Repositório canônico:** `/root/projects/compras-coletivas` (branch atual). O aplicativo publicado é o diretório `public/` e as funções estão em `api/`.
- **Baseline de retorno:** `c57dbe50248227dc0db0fd104e1d6504ce44fda3` (`docs: record buyer login production validation`). Confirmado legível antes de mutação.
- **Limite de worktree:** não incorporar nem reverter `SYNC-RESULT.md`, `SYNC-TASK.md` ou `scripts/sync_july2026.py`; são alterações alheias já presentes.
- **Ordem obrigatória:** Planner → revisão adversarial do plano por família diferente → um Implementer → Verifier independente de outra família → Reviewer da terceira família → deploy e smoke em produção. No máximo dois ciclos de reparo; falha determinística repetida encerra a cadeia.

## Passo 1 — enquadramento

### Objetivo

Eliminar a autoridade do navegador sobre valores de pedidos, fechar a resposta `500` para JSON inválido, proteger login administrativo contra força bruta, substituir tokens persistidos em `localStorage` por sessões de cookie `HttpOnly`, aplicar CSRF adequado e remover as vulnerabilidades conhecidas das dependências sem alterar pedidos históricos.

### Jornadas críticas

1. Comprador cadastra/autentica, finaliza pedido e vê histórico sem transportar token de sessão no JavaScript.
2. Administrador autentica, opera painel e upload com cookie de administração; o vínculo administrador-comprador continua abrindo ambas as sessões sem expô-las ao script.
3. Pedido criado usa somente `codigo` e `quantidade` recebidos; produto, categoria, desconto, subtotais e totais vêm do banco na mesma transação.
4. Requisições JSON inválidas recebem resposta controlada `400`, não `500`.
5. Tentativas excessivas de senha administrativa recebem `429` sem revelar se a configuração existe ou a senha está errada.

### Não objetivos e limites de escopo

- Não recalcular, corrigir ou migrar valores de pedidos históricos; eles são registros do ciclo em que foram feitos.
- Não alterar regras comerciais de desconto/faixas sem decisão explícita. A fonte de verdade continuará sendo `descontos` ativa, preservando a semântica atual de desconto global/categoria.
- Não redesenhar toda a SPA nem refatorar o monólito por estética nesta release. Só extrair módulos necessários ao boundary de segurança e precificação.
- Não ativar upload XLSX improvisado. A rota atual declara XLSX mas não o processa; isso é um problema separado, a ser implementado apenas com parser mantido, limites e testes próprios.
- Não manter tokens antigos em `Authorization`, `x-admin-token` ou `x-buyer-token` como compatibilidade silenciosa. A release força novo login para remover a superfície exposta.

### Riscos e decisões

| Risco | Decisão |
|---|---|
| Cliente adultera preço/desconto/nome/categoria | Contrato de pedido aceita apenas identificadores de produto e quantidade; o servidor deriva todo o restante. |
| Cookie envia credencial automaticamente | Cookies `HttpOnly; Secure; SameSite=Strict; Path=/` mais proteção CSRF vinculada à sessão e validação de origem/fetch metadata em mutações. |
| Dois tipos de sessão simultâneos | Cookies e tokens CSRF independentes para buyer e admin; cada rota define explicitamente sua identidade aceita. |
| Deploy com HTML e function em versões temporariamente distintas | Deploy atômico Vercel, sem fallback de bearer; se cliente antigo receber 401, limpa estado e solicita login. |
| Desconto muda durante checkout | Transação serializa a política de preço com lock transacional; o pedido persiste um snapshot calculado coerente. |
| Atualização de pacote quebra SMTP/upload | Atualizar um pacote por vez, executar testes focados e `npm audit`; não usar `npm audit fix --force`. |

## Passo 2 — arquitetura executável

### A. Contratos HTTP, sessão e CSRF

Criar adaptadores pequenos sob `server/lib/` (cookies, origem/CSRF e sessão) e manter `api/db.js` como roteador HTTP. Não duplicar parsing de cookie, hashing ou geração de resposta entre `db.js` e `upload-planilha.js`.

**Cookies emitidos no login/cadastro/troca de PIN**

- Comprador: `__Host-cc-buyer`; administração: `__Host-cc-admin`.
- Ambos: valor aleatório já armazenado apenas como hash em `buyer_sessions`/`admin_sessions`; `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age` igual ao TTL de banco; sem `Domain`.
- CSRF correspondente: `__Host-cc-buyer-csrf` e `__Host-cc-admin-csrf`; aleatório, `Secure; SameSite=Strict; Path=/`, deliberadamente **sem** `HttpOnly` para o cliente copiar no header. O hash do token fica na respectiva linha de sessão, nunca no log.
- Respostas de sessão e login não incluem `token`, `buyer_token` nem qualquer segredo. Mantêm somente metadados públicos de comprador quando necessários.
- Logout apaga a sessão apresentada e envia `Set-Cookie` expirado para o cookie de sessão e CSRF do mesmo escopo. Troca autenticada de PIN revoga as sessões anteriores e emite uma única sessão nova de comprador; recuperação pública apenas revoga e expira cookies, exigindo novo login.

**Validação de mutação autenticada**

1. Resolver primeiro o cookie do escopo exigido; bearer e `x-*-token` deixam de autenticar.
2. Para POST/PUT/DELETE autenticados, exigir `Origin` permitido (ou, em desenvolvimento, origem local explícita), `Sec-Fetch-Site` `same-origin`/`none` quando disponível, cookie CSRF e header `X-CSRF-Token` iguais em comparação constante, e hash igual ao da sessão.
3. Falta/erro CSRF retorna `403 CSRF_VALIDATION_FAILED`; sessão ausente/expirada retorna `401` e limpa somente o cookie do escopo aplicável.
4. Login/cadastro/recuperação pública não exige CSRF, mas exige origem permitida quando há `Origin`; continua rate-limited. Não usar `Access-Control-Allow-Origin: *` nem credenciais CORS.
5. Acrescentar `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínima e CSP inicialmente em `Report-Only`. A aplicação tem handlers inline, portanto CSP de bloqueio só entra depois de remover inline handlers/nonces; não introduzir uma CSP que quebre o painel.

**Contrato de cliente após migração**

- `fetch` usa `credentials: 'same-origin'`; não envia `Authorization`.
- `app.api` identifica escopo da rota e envia `X-CSRF-Token` do cookie correspondente somente em mutações. Estado de login é restaurado por `GET /admin/session` e `GET /comprador/session`, não por armazenamento local.
- Remover `BUYER_TOKEN_KEY`, `ADMIN_TOKEN_KEY`, `readPersistedToken`, `writePersistedToken`, `clearPersistedToken` e todos os usos de token. Dados não sensíveis de carrinho/tema podem permanecer no `localStorage`.
- `POST /admin/login` mantém `200 { success, message, comprador? }`; comprador vinculado é metadata, não prova de sessão. `POST /comprador/login`, cadastro e troca de PIN mantêm seu status e corpo público, sem `token`.
- `api/upload-planilha.js` passa a usar cookie administrativo e o CSRF de admin; remover a documentação/qualquer comportamento de senha em query string.

### B. Pedido com preço exclusivo do servidor

#### Política normativa de catálogo, desconto e snapshot (C-01)

Esta é a única regra autorizada para a release; o Implementer não pode escolher outra variante.

1. `faixas_desconto` fica **fora** da precificação de pedidos nesta release. É informativa/legada e não participa de checkout, edição, desconto administrativo ou cálculo de snapshot. `descontos` é a única política de preço.
2. A chave canônica de categoria é `categorias.slug`. Regra global usa a chave reservada `__global__`, representada no registro legado por `descontos.categoria = 'todos'` e `categoria_id IS NULL`. Regra de categoria usa `categoria_id` da categoria cujo `slug` é a chave e mantém `categoria` com o mesmo slug apenas para compatibilidade de leitura.
3. Para um produto há no máximo uma política ativa aplicável: regra específica ativa vence `__global__`; se não existir regra específica, usa-se a global; se não houver global, percentual `0`. Qualquer duplicidade, slug desconhecido, `categoria_id`/slug divergentes ou código de produto ativo duplicado é erro controlado `409 PRICING_POLICY_AMBIGUOUS`/`409 CATALOG_ITEM_AMBIGUOUS`, nunca uma escolha arbitrária.
4. Preço, percentual, subtotal e totais inseridos são **snapshots imutáveis**. Alterar/desativar desconto não recalcula pedidos existentes. Alterar quantidade mantém o preço unitário snapshot do item e recalcula somente subtotais/totais; adicionar um item administrativo usa a política atual e documenta este snapshot novo.
5. `POST /descontos` e `DELETE /descontos` executam `BEGIN` → `SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))` → validar/gravar a política → `COMMIT`. Criação/substituição de pedido e adição administrativa tomam **o mesmo lock** antes de ler política. A antiga função `aplicar_desconto()` não será chamada nessa rota, pois ela altera snapshots históricos.
6. A migração só cria o índice único parcial de política depois de preflight sem conflito e mapeamento validado: `UNIQUE (COALESCE(categoria_id, 0)) WHERE ativo`. Não deduplicar, renomear nem desativar regra automaticamente em produção; qualquer conflito bloqueia rollout até saneamento aprovado.

**Novo contrato de `POST /api/db/pedidos`**

```json
{
  "itens": [{ "codigo": "AGF120", "quantidade": 2 }],
  "replace_pedido_id": 123
}
```

- `usuario`, `telefone`, `nome`, `categoria`, `preco_bruto`, `preco_desconto`, `desconto`, subtotais e totais enviados pelo browser são ignorados e não são aceitos como fonte de dados.
- A identidade vem de `buyerSession`; o pedido grava nome canônico da sessão e `comprador_id` da sessão.
- Validar antes da transação: body UTF-8 máximo **64 KiB**, no máximo **50** itens, código normalizado não vazio e único, e quantidade `Number.isSafeInteger` entre **1 e 99**. `parseInt` permissivo (`"2x"`) não é aceito. Violações retornam respectivamente `413 REQUEST_BODY_TOO_LARGE`, `400 ORDER_TOO_MANY_ITEMS`, `400 INVALID_ORDER_ITEM_CODE` e `400 INVALID_ORDER_ITEM_QUANTITY`.
- Buscar produtos ativos por código no banco e falhar a transação inteira com `400 INVALID_ORDER_ITEMS` para entrada inválida ou `409 CATALOG_ITEM_UNAVAILABLE` para produto inativo/ambíguo/ausente. Não aceitar preço zero como fallback.
- Carregar `produtos.preco`, nome, categoria canônica e descontos ativos (`categoria` específica com precedência sobre `todos`, conforme a semântica atual documentada). A consulta e a regra de precedência devem ser centralizadas em `server/data/order-data.js` e `server/services/order-pricing-service.js`.
- Executar `BEGIN` → lock da política de preço → ciclo ativo único → produto/desconto → inserir pedido/itens calculados com `NUMERIC` e arredondamento explícito a 2 casas → atualizar totais derivados → `COMMIT`. Qualquer erro faz rollback completo. Em `replace_pedido_id`, executar `SELECT ... FOR UPDATE`, validar dono/ciclo/status após o lock e rejeitar uma segunda substituição concorrente com `409 ORDER_REPLACEMENT_CONFLICT`; não apagar o pedido anterior antes de toda a validação de catálogo/política passar.
- O retorno de sucesso pode acrescentar `totais` calculados pelo servidor, mas mantém `pedido_id`, para que a UI atual tenha compatibilidade. A UI deve atualizar a fatura com esse retorno ou recarregar o histórico; ela não deve usar valores locais como confirmação financeira.
- Aplicar a mesma função de precificação/recalcular aos fluxos administrativos que adicionam item ou mudam quantidade. Rotas administrativas não recebem preço do browser; se o preço histórico do item deve ser preservado, isso precisa ser decisão explícita antes de codar. A recomendação desta release é preservar o snapshot já salvo para mudança de quantidade e usar preço atual somente para novo item, deixando clara a regra na API.

### C. JSON inválido, erros e rate limit administrativo

- Substituir chamadas diretas `await req.json()` de `api/db.js` por um único `parseJsonBody(req)`: validar `Content-Type` JSON quando houver corpo, limitar tamanho anunciado, capturar `SyntaxError` e retornar `400 { success:false, code:'INVALID_JSON', error:'JSON inválido' }`. Não expor parser/stack.
- Usar o helper em POST e PUT. `DELETE` sem corpo continua válido. Garantir `client.end()` em todos os caminhos de resposta/erro.
- Criar `admin-login-service`/extensão explícita de `auth-rate-limit-service` usando a tabela persistente e `RATE_LIMIT_HMAC_KEY`. Em produção Vercel, a única fonte de IP aceita é `x-vercel-forwarded-for` contendo **um único IPv4 ou IPv6 canônico**; `x-forwarded-for` e `x-real-ip` são ignorados. Cabeçalho ausente/múltiplo/inválido torna o login `503 AUTH_RATE_LIMIT_UNAVAILABLE`. Em teste, somente `x-test-client-ip` é aceito; em desenvolvimento local, `DEV_TRUSTED_CLIENT_IP` deve estar configurado e válido. Nunca há fallback para `unknown` ou para IP escolhido pelo cliente.
- A política fixa é: bucket `admin_login_ip`, **5** tentativas permitidas por IP a cada **900 s**; a sexta e posteriores bloqueiam por **1800 s**. Bucket de contenção `admin_login_global`, **60** tentativas permitidas em **60 s**; a 61ª e posteriores bloqueiam por **60 s**. Ambos são incrementados em uma única transação antes de PBKDF2; a decisão usa o maior `blocked_until`, responde `429 ADMIN_LOGIN_RATE_LIMITED` e calcula `Retry-After` a partir dessa mesma linha transacional. O contador não é limpo em sucesso.
- Chave HMAC ausente, com menos de 32 caracteres ou IP não confiável faz o login administrativo falhar fechado com `503 AUTH_RATE_LIMIT_UNAVAILABLE`; senha/configuração inválida que chega à verificação retorna a mesma resposta neutra `401`. Senha nunca entra em hash, auditoria ou mensagem.
- Todas as respostas de autenticação e sessão devem ser `Cache-Control: no-store`; erros JSON e demais respostas sensíveis também.

### D. Schema, migração e recuperação

Criar `sql/08_security_hardening.sql`, estritamente aditivo e idempotente:

1. adicionar `csrf_token_hash TEXT` às duas tabelas de sessão, com índice apenas se a consulta efetivamente o exigir;
2. preencher não é possível/seguro para sessões existentes sem expor tokens; **revogar** (`DELETE`) sessões existentes no momento de aplicar a migração, forçando reautenticação uma única vez;
3. preservar compradores, produtos, descontos, ciclos, pedidos, itens e pagamentos sem `UPDATE` de conteúdo;
4. conservar os `REVOKE`/`GRANT` explícitos já aplicados às tabelas de segurança e conferir proprietário/role de execução;
5. executar preflight e abortar antes de qualquer DDL/DELETE se houver: mais de um ciclo ativo; pedido sem `ciclo_id`; item sem pedido; produto ativo duplicado por `lower(btrim(codigo))`; produto ativo sem categoria resolvível; desconto ativo duplicado para a mesma chave; desconto específico sem categoria/slugs divergentes; ou valores de desconto fora de `[0,100]`. O preflight gera relatório sanitizado para aprovação, não saneia catálogo automaticamente.
6. depois do preflight, mapear regras específicas existentes para `categoria_id` somente quando o slug corresponder exatamente; criar índices de lookup de produto ativo/categoria e o índice parcial único de política ativa. Qualquer ambiguidade ainda observada em runtime retorna `409` controlado.
7. incluir consultas de pós-migração: contagens de entidades de negócio iguais, zero sessões legadas, colunas existentes, uma sessão criada pelo novo fluxo com hashes preenchidos, um único ciclo ativo e zero regra ativa ambígua.

Antes da produção: backup lógico validado ou snapshot do banco, contagem por tabela/ciclo e retorno de leitura. Em caso de rollback de aplicação após migrar, a recuperação segura é manter a migração (colunas são aditivas) e reimplantar o baseline; usuários continuam precisando autenticar novamente. Nunca restaurar pedidos para resolver problema de sessão.

### E. Dependências e upload

O `npm audit` atual registra três vulnerabilidades altas: `nodemailer`, `xlsx` e `ws` transitivo de `@vercel/postgres`.

- Atualizar `nodemailer` para a versão corrigida compatível mais recente (audit indica 9.0.3 como correção major) e testar envio por transporte fake + build Node/Vercel; não executar e-mail real sem autorização específica.
- Atualizar `@vercel/postgres` para uma versão que transite `ws >= 8.21.0`, regenerar somente o lockfile por `npm install`, e confirmar `npm ls ws` + `npm audit`.
- Remover `xlsx` vulnerável. Como não há correção disponível no canal atual, escolher biblioteca suportada (preferência: `exceljs`) **somente** se a rota receber implementação real de XLSX com limite de tamanho, MIME/assinatura, parse em memória limitado, validação de colunas e testes. Se esse trabalho não couber na release, remover a dependência agora e deixar a rota aceitar apenas JSON/CSV documentados; nunca alegar suporte XLSX.
- O upload atual precisa da mesma autenticação cookie/CSRF e deve ser tratado como hotspot separado; não misturar parser multipart caseiro com a mudança de sessão sem testes de upload.

#### Matriz mandatória de rotas, identidade e cookies (H-01)

Em toda mutação com sessão, Origin/fetch metadata e CSRF do escopo indicado são obrigatórios. `Público` exige Origin permitido quando presente e não emite CORS com credenciais.

| Rota | Identidade | CSRF | Resultado de sessão/cookie |
|---|---|---|---|
| `POST /comprador/registro`, `/comprador/login` | pública + rate limit comprador | não | emite buyer + buyer-CSRF |
| `POST /admin/login` | pública + rate limit admin | não | emite admin + admin-CSRF; se houver vínculo, também buyer + buyer-CSRF |
| `POST /comprador/pin-recovery/complete` e `POST /api/pin-recovery-request` | pública + respectivos limites | não | conclusão revoga banco, **não cria sessão**, expira cookies buyer e buyer-CSRF; novo login obrigatório |
| `POST /comprador/logout` | buyer, tolera sessão expirada | buyer | tenta revogar sessão e sempre expira buyer + buyer-CSRF |
| `PUT /comprador/pin` | buyer | buyer | revoga todas as sessões buyer, emite exatamente uma nova buyer + buyer-CSRF |
| `POST /admin/compradores/:id/pin-recovery` | admin | admin | não altera sessão; cria desafio auditado |
| `POST /pedidos`, `DELETE /pedidos/:id` como comprador | buyer | buyer | não altera cookie |
| `POST /descontos`, `DELETE /descontos`, `POST /pagamentos/inicializar`, `PUT /pagamentos/:id`, `PUT /pedidos/*`, `PUT /itens/:id/qty`, `DELETE /pedidos`, `DELETE /pedidos/usuario/:nome`, `DELETE /itens/:id`, `DELETE /produtos/:codigo` | admin | admin | não altera cookie |
| `DELETE /pedidos/:id` como admin | admin | admin | não altera cookie |
| `POST /api/upload-planilha` | admin | admin | não altera cookie |

`DELETE /pedidos/:id` exige `X-Session-Scope: buyer|admin`; sem ele, ou com escopo sem a sessão/CSRF correspondente, retorna `400 AUTH_SCOPE_REQUIRED`/`401`/`403`, evitando confusão quando ambos os cookies existem. Todas as GETs autenticadas exigem a identidade de sua rota, mas não CSRF; `GET /admin/session` e `GET /comprador/session` confirmam apenas seu escopo.

#### Transporte de cookies e CORS (H-04)

- Criar helper de resposta que constrói `Headers` por requisição e faz `Headers.append('Set-Cookie', value)` **uma vez por cookie**; nunca armazena cookies em objeto global. Teste unitário deve verificar as duas/quatro linhas distintas, seus atributos e expiração.
- `Access-Control-Allow-Headers` inclui `Content-Type, X-CSRF-Token, X-Session-Scope`; `Access-Control-Allow-Credentials: true` só é emitido quando a origem é autorizada. Produção aceita somente `https://compras-coletivas-phi.vercel.app`; previews Vercel não recebem cookie de produção nem CORS. Desenvolvimento exige `ALLOWED_DEV_ORIGINS` explícita, sem wildcard, e origem desconhecida falha fechada.
- A SPA é same-origin; usa `credentials: 'same-origin'`. `Secure` não é relaxado: testes HTTP locais testam serializador/guardas unitariamente, e smoke de cookie usa HTTPS local ou deployment preview isolado sem cookies de produção.
- Não enviar CSP Report-Only nesta release sem coletor configurado. Abrir tarefa posterior para remover handlers inline, implantar `report-to` sanitizado e só então promover CSP a enforcement.

### Arquivos, fronteiras e único escritor

| Bloco | Escritor | Arquivos principais |
|---|---|---|
| Sessão/CSRF + roteador | Implementer | `api/db.js`, `api/upload-planilha.js`, novos helpers `server/lib/*`, `server/data/*`, `server/services/*`, `public/app.js`, `public/auth-recovery.js` |
| Precificação de pedido | mesmo Implementer, após bloco sessão | `api/db.js`, novos `server/data/order-data.js`, `server/services/order-pricing-service.js`, testes de pedido |
| Migração | mesmo Implementer | `sql/08_security_hardening.sql`, `sql/01_schema_supabase.sql`, documentação |
| Dependências | mesmo Implementer, por último | `package.json`, `package-lock.json`, `api/upload-planilha.js`, testes de e-mail/upload |

`api/db.js`, `public/app.js`, schema e `package-lock.json` são hotspots: um único escritor; nenhuma edição paralela neles.

### Sequência de implementação e rollout

1. Registrar baseline, inventário de env vars e backup/contagens; criar testes de contrato que falham para preço adulterado, JSON inválido, CSRF e login admin limitado.
2. Implementar e testar precificação server-side isolada; então conectar o endpoint e adaptar o payload da SPA.
3. Implementar cookies/CSRF, substituir autenticação do `db` e upload, remover tokens persistidos e testar logout/rotação/duas sessões.
4. Aplicar rate limit admin e helpers de JSON/headers, atualizar `docs/API.md` e `.env.example`.
5. Atualizar dependências uma por vez; decidir explicitamente se upload XLSX entra ou fica fora. Não deixar o pacote vulnerável instalado se a rota não o usa.
6. Em staging/local com PostgreSQL descartável: aplicar migração, executar testes, build e smoke browser/curl.
7. Produção: confirmar snapshot/contagens, aplicar migração, push, aguardar deploy Vercel `READY`, limpar caches se aplicável, testar no alias canônico. A comunicação ao usuário deve avisar previamente que será exigido novo login.

### Rollback

- **Antes de deploy:** restaurar somente arquivos desta tarefa a partir de `c57dbe5`, preservando worktree alheio; não usar reset/checkout destrutivo.
- **Depois de deploy com smoke falho:** uma única correção dentro do ciclo permitido; se falhar, reverter por novo commit para o baseline e redeployar. Confirmar health, login e pedido no baseline.
- **Dados:** a migração não toca pedidos. Não apagar coluna CSRF nem sessões para reverter; elas são aditivas. Se houver erro de migration, interromper antes do deploy e restaurar snapshot somente conforme runbook validado.

### Observabilidade

- Registrar somente eventos sanitizados: `admin_login_success`, `admin_login_rejected`, `admin_login_rate_limited`, `csrf_rejected`, `order_price_recalculated`, `order_catalog_rejected`; hash de IP já existente, sem senha, token, cookie, telefone ou total bruto em logs de segurança.
- Expor `Retry-After` em 429 e correlação de request segura (ID aleatório) para diagnóstico.
- Não logar body de login, cookie, `Authorization`, `Set-Cookie` ou header CSRF.

## Gates para iniciar e finalizar

Antes de mutar: revisão adversarial deste plano sem achado crítico aberto, baseline legível, backup/contagens definidos, e ambiente de PostgreSQL descartável disponível. Antes de declarar conclusão: todos os itens de `ACCEPTANCE.md`, commit/push, deploy Vercel pronto, smoke público e autenticado no alias canônico e evidência preenchida em `REPORT.md`/`TELEMETRY.md`.
