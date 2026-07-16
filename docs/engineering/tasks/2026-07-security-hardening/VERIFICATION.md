# Verificação independente — security hardening (revalidação)

**Data:** 2026-07-16  
**Veredito local:** **REJEITADO**. Os reparos resolveram C-01 a C-04 da
verificação anterior, mas permanecem bloqueadores determinísticos no código. Não
liberar, não fazer commit/deploy desta revisão.

## Escopo

- Repositório canônico: `/root/projects/compras-coletivas`.
- Baseline do plano: `c57dbe5`.
- Diff reavaliado excluindo `SYNC-RESULT.md`, `SYNC-TASK.md` e
  `scripts/sync_july2026.py`.
- Não houve edição de código, banco, commit, push ou deploy nesta verificação.

## Gates locais executados

| Gate | Resultado |
| --- | --- |
| `npm test` | **20 aprovados, 0 falhas, 1 suíte PostgreSQL pulada**. |
| `node --check` dos arquivos alterados | **Aprovado**. |
| `git diff --check` no escopo | **Aprovado**. |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilidades**. |
| `npm ls ws --all` e `npm ci --dry-run` | **Aprovados** (`ws@8.21.0 overridden`). |
| `vercel build` | **Aprovado** localmente. |
| PostgreSQL descartável, migração e concorrência | **Não executados: banco descartável indisponível.** |
| Produção (backup, deploy e smoke autenticado) | **Não executados.** |

## Reparos confirmados

- C-01: login administrativo agora grava os hashes CSRF antes de encerrar o cliente.
- C-02: `requireAdmin()` preserva `csrf_token_hash`, tornando a validação CSRF
  administrava possível.
- C-03: cadastro/login/troca de PIN removem token antes de serializar e a troca de
  PIN emite o novo par de cookies.
- C-04: `DELETE /pedidos/:id` valida `X-Session-Scope` e usa o escopo solicitado na
  autorização.
- Descontos agora usam o advisory lock compartilhado e não chamam a função legada de
  repricing; substituição passou a bloquear a linha antes de validar o catálogo.
- O rate limit agora abre uma transação para os dois buckets e calcula `Retry-After`
  a partir de `blocked_until`.

## Bloqueadores reais remanescentes

### B-01 — adicionar item administrativo quebra em runtime

Em `PUT /pedidos/:id/itens`, quando o produto ainda não existe no pedido, o `INSERT`
usa `subtBruto` e `subtFinal`, mas essas variáveis não são declaradas no ramo atual.
O resultado é `ReferenceError`, rollback e resposta 500 para uma mutação normal do
painel administrativo.

**Correção exigida:** calcular ambos a partir dos preços canônicos e da quantidade
antes do `INSERT`; cobrir inserção nova e incremento de item existente em teste de rota.

### B-02 — fronteira de origem pública não foi aplicada

`mutationCsrfError()` retorna imediatamente para cadastro, login, login admin e
conclusão pública de recuperação, sem validar `Origin` quando ele está presente. Isso
contraria o contrato explícito do plano para rotas públicas e mantém a possibilidade de
requisições cross-origin chegarem ao fluxo que emite cookies.

**Correção exigida:** criar e aplicar um guard de origem para todas as rotas públicas,
com teste de origem autorizada, ausente e não autorizada.

### B-03 — substituição concorrente não cumpre o contrato de erro

O `FOR UPDATE` foi adicionado, mas a segunda requisição concorrente que acorda após a
primeira remover o pedido encontra zero linhas e retorna 401 por meio de
`unauthorized('Pedido em edição inválido')`. O contrato de aceite exige
`409 ORDER_REPLACEMENT_CONFLICT` sem apagar pedido válido.

**Correção exigida:** distinguir pedido inexistente após esperar o lock da condição de
autorização e retornar o código 409 estável; provar com duas conexões PostgreSQL.

### B-04 — parser de IP ainda não é canônico

`isCanonicalIp()` aceita sequências IPv6 incompletas, como `1:2:3`, porque o regex
aceita de três a oito grupos sem exigir oito grupos nem uma compressão `::` válida.
Isso não satisfaz o contrato de aceitar apenas IPv4/IPv6 canônico na fonte confiável do
rate limit administrativo.

**Correção exigida:** usar parser IPv6 correto/normalizador ou algoritmo completo e
testar valores válidos, incompletos, múltiplos e forjados.

### B-05 — preflight da migração ainda está incompleto

`08_security_hardening.sql` não bloqueia produto ativo sem categoria resolvível, item
órfão, divergência categoria/slug de desconto nem percentual fora de `[0,100]`, todos
previstos no plano. A migração também não foi exercitada em PostgreSQL descartável.

**Correção exigida:** completar os preflights fail-closed e executar idempotência,
contagens e revogação de sessões em banco temporário antes de qualquer rollout.

### B-06 — headers CORS ainda usam estado global concorrente

`headers` continua mutável no escopo do módulo. Como o handler faz awaits antes de
montar respostas, uma requisição concorrente pode substituir os headers CORS de outra.
Isso viola o contrato de construir headers por requisição e pode misturar políticas de
origem. `ALLOWED_DEV_ORIGINS` continua apenas documentada, sem ser aplicada.

**Correção exigida:** eliminar o estado global, passar headers por resposta/contexto e
resolver origens de desenvolvimento exclusivamente pela configuração explícita.

## Gates obrigatórios após os reparos

Mesmo com B-01 a B-06 resolvidos, a aprovação ficará **condicionada** até executar:

1. testes de rota para cookies, resposta sem token, CSRF positivo/negativo, logout,
   escopo de DELETE, login admin e rate limit;
2. PostgreSQL descartável para migração/preflight, cálculo de pedido, desconto e
   substituição concorrentes;
3. backup, deploy Vercel `READY` e smoke autenticado buyer/admin no alias canônico.

O build, a sintaxe, a auditoria de dependências e os testes unitários atuais estão
verdes, mas não cobrem esses contratos de banco/rota.
