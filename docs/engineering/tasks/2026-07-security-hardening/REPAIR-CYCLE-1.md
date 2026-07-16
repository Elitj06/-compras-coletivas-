# Reparo após verificação independente

## Escopo corrigido

- A inclusão administrativa de item agora calcula os subtotais antes do `INSERT` e preserva o snapshot do item existente ao somar quantidade.
- Rotas públicas de autenticação passam a rejeitar `Origin` presente e não autorizado.
- A substituição concorrente de pedido responde `409 ORDER_REPLACEMENT_CONFLICT` após o lock, sem apagar pedido válido.
- O parser de IP confiável rejeita IPv6 incompleto e valores múltiplos.
- A migração ganhou preflights fail-closed para item órfão, categoria de produto, política de desconto e percentual.
- CORS deixou de depender de estado mutável do módulo; a política é aplicada por resposta e origens de desenvolvimento só vêm de `ALLOWED_DEV_ORIGINS` explícito.

## Evidência local

- `npm test`: 21 aprovados, 0 falhas.
- `node --check api/db.js`: aprovado.
- `npm audit --package-lock-only --omit=dev --audit-level=high`: 0 vulnerabilidades.
- `vercel build`: aprovado.
- PostgreSQL 16 descartável: schema atual + migração `08` aplicada duas vezes; compradores preservados, sessões antigas revogadas e um ciclo ativo confirmado.

## Limites

O adaptador `@vercel/postgres` usa WebSocket e não conecta ao PostgreSQL TCP descartável; por isso o handler Edge completo e as corridas de rota ainda exigem verificação no ambiente compatível antes da release.
