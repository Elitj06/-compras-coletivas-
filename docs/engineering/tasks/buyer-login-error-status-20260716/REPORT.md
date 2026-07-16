# Relatório

## Implementação

O dispatcher POST passou a aguardar as rotas assíncronas dentro do `try`. Assim, erros esperados de autenticação chegam ao conversor HTTP e preservam seus status `400`, `401` e `429`.

## Evidência local

- Teste de regressão do dispatcher cobre entrada inválida (`400`) e credencial inválida (`401`).
- `node --test tests/buyer-auth-routes.test.js`: 2 aprovados.
- `npm test`: 15 aprovados; 1 suíte PostgreSQL de integração pulada por `TEST_DATABASE_URL` ausente.
- `node --check` nos arquivos alterados: aprovado.
- `git diff --check` no escopo da tarefa: aprovado. O check global acusa espaços finais somente em `SYNC-RESULT.md`, alteração pré-existente fora do escopo.

## Produção e rollback

- Deploy e smoke permanecem pendentes do push e da integração Git/Vercel.
- Rollback: reverter somente o commit desta tarefa para `eecfdda`.
