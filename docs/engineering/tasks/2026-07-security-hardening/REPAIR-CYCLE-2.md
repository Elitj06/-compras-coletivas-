# Ciclo de reparo 2 — contratos de sessão e mutação

- Corrigida a seleção de escopo CSRF: `POST /pedidos` é comprador, enquanto as mutações administrativas de `/pedidos` usam o cookie e CSRF administrativo.
- Logout de comprador passa a aceitar corpo JSON vazio; foi criado logout administrativo real, que revoga a sessão no servidor e expira os dois cookies do escopo.
- `GET /admin/session` deixou de expor o hash de CSRF; retorna apenas confirmação de sessão ativa.
- O cliente agora transmite somente `codigo` e `quantidade` no checkout e na adição administrativa de itens. Preço, categoria e desconto continuam exclusivamente no servidor.
- A substituição de pedido rejeita identificador permissivo e a adição administrativa bloqueia o pedido-alvo dentro da transação.
- Evidência: `npm test` 21/21; `node --check api/db.js`; build Vercel local; `npm audit --omit=dev --audit-level=high` com zero vulnerabilidades; migração executada duas vezes em transação e revertida, com contagens de negócio preservadas. A reaplicação também preservou uma sessão de comprador e uma de administrador emitidas no novo formato (`1:1`).
- A revisão independente aprovou a correção da reaplicação de migração e confirmou `Cache-Control: no-store` nos endpoints de sessão.

## Limite de release

O deploy depende da criação/configuração explícita de `RATE_LIMIT_HMAC_KEY` no ambiente de produção. Sem essa chave, o login administrativo falha fechado por projeto, portanto a publicação não será iniciada antes dessa configuração.
