# Telemetria — pin-recovery-20260715

- Projeto: `compras-coletivas`.
- Janela: 15/07/2026, aproximadamente 00:05–09:50 BRT.
- Risco/lane: `high / release`; Deep Architecture ativa.
- Baseline original: `02b052449375ef6a5ee5bb53cd2ac1c6c25da684`.
- Rollback canônico publicado: `0fda4ec156e0792811762a8d7c0469f8ff0230ed`.
- Planner: GPT-5.6 Sol, esforço `max`.
- Writer único: família OpenAI, esforço alto, sem escritores concorrentes nos
  hotspots.
- Verifier de arquitetura e Release 1: GLM-5.2, esforço `max`; Release 1 aprovada
  e sete reparos obrigatórios de Release 2 incorporados.
- Verifier do diff final: GLM-5.2 independente, `APPROVE`, sem finding
  bloqueante; quatro observações `LOW` foram avaliadas e as duas de código
  compartilhado/memória do código admin foram reparadas.
- Reviewer de terceira família: duas tentativas Mimo falharam antes de gerar
  resposta por rejeição do provedor. Circuit breaker atingido; gate não satisfeito
  e release bloqueada antes de commit/deploy.
- Ciclos de reparo do writer: extração de helpers fora de `/api` após inspeção do
  bundle Vercel; casts SQL do rate limit/auditoria; serialização de identidade;
  desafio utilizável somente após entrega; cobertura de falha, reenvio, expiração
  e cinco tentativas.
- Gates atuais: 11 unitários e 9 integrações aprovados; sintaxe, diff check e
  build aprovados; duas funções Vercel no bundle; UI móvel renderizada.
- Migração: idempotência provada localmente e produção verificada com grants
  fechados para papéis expostos.
- Release 1: GitHub, deploy `READY` e smoke canônico aprovados.
- Release 2: commit `23c27d0`, GitHub e deploy Vercel `READY` no alias canônico.
- Fallbacks de provedor: uma tentativa anterior e a tentativa final do Reviewer
  Mimo falharam antes de produzir saída; nenhuma terceira tentativa foi feita.
- Reparo crítico: SMTP isolado em função Node; bundle Edge ficou livre de Nodemailer.
- Gates finais: PostgreSQL 16 descartável 20/20; envio Gmail aceito em produção;
  health `200` e endpoint Node roteado. Confirmação UX de comprador real pendente.
- Rollback invocado: não.
- Defeito escapado em produção: nenhum observado.
