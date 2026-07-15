# Relatorio — release 1 de compatibilidade de PIN

## Status

`implemented` e `tested` localmente. A migracao aditiva foi aplicada e
verificada em producao em 2026-07-15. Push, deploy e smoke da release de
compatibilidade ainda sao os proximos gates desta fase.

## Entrega

- Adicionada migracao `sql/05_pin_recovery.sql`, aditiva e idempotente, com
  tabelas de desafios, rate limit persistente e auditoria sanitizada.
- Fechado o acesso das tabelas e sequencias para `PUBLIC`, `anon`,
  `authenticated` e `service_role`; somente o papel da conexao que executa a
  migracao recebe DML explicito.
- Atualizados os dois schemas frescos com a mesma estrutura de recuperacao.
- Adicionado modulo WebCrypto para SHA-256 legado, PBKDF2-SHA256 com 210 mil
  iteracoes, verificador dual, HMAC-SHA256, aleatoriedade CSPRNG e validacao de
  PIN. O arquivo tem 175 linhas.
- Login passou a aceitar ambos os formatos sem regravar `pin_hash`.
- Registro e alteracao pelo fluxo legado continuam produzindo SHA-256 nesta
  release; a migracao permanece desativada por padrao e nao e chamada pela API.
- Nenhuma rota ou interface de recuperacao foi ativada.

## Evidencias locais

- `npm test`: 8 testes aprovados, 0 falhas.
- `node --check api/db.js`: aprovado.
- `node --check api/lib/pin-crypto.js`: aprovado.
- `node --check tests/pin-crypto.test.js`: aprovado.
- `git diff --check` nos arquivos da tarefa: aprovado.
- PostgreSQL 16 descartavel: schema Supabase fresco aplicado; migracao aplicada
  duas vezes consecutivas com `ON_ERROR_STOP=1`; tres tabelas confirmadas.
- PostgreSQL 16 descartavel: schema alternativo `sql/01_schema.sql` aplicado e
  as tres tabelas confirmadas.
- Banco de producao: tres tabelas `pin_recovery_*` confirmadas, zero grants para
  `PUBLIC`, `anon`, `authenticated` e `service_role`, e grants explicitos para
  o papel backend.

## Limites e riscos residuais

- A release funcional ainda depende dos segredos/remetente aprovados, das
  rotas, servicos, transacoes concorrentes, UI e testes de integracao completos.
- PBKDF2 aumenta deliberadamente o custo do login de fixtures novas; o parser
  limita envelopes aceitos a no maximo 1 milhao de iteracoes para evitar custo
  arbitrario vindo do banco.
- A API principal continua monolitica e acima do limite arquitetural do projeto;
  esta fase fez somente a alteracao minima autorizada no hotspot.

## Rollback

Antes de qualquer ativacao, o retorno continua sendo o baseline
`02b052449375ef6a5ee5bb53cd2ac1c6c25da684`. A migracao e estritamente aditiva;
se aplicada, pode permanecer inerte porque nenhuma rota a utiliza. Depois que
hashes PBKDF2 forem gravados em release futura, o rollback valido devera apontar
para esta camada de compatibilidade, nunca para o baseline legado.
