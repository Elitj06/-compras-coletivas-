# Telemetria — security hardening

- Task / projeto: `2026-07-security-hardening` / Compras Coletivas.
- Início: 2026-07-16 UTC. Risco/lane: alto/release. Deep Architecture: sim.
- Baseline: `c57dbe50248227dc0db0fd104e1d6504ce44fda3`; rollback: reimplantar esse commit, mantendo a migração aditiva e exigindo novo login.
- Fases concluídas: plano e revisão arquitetural; implementação; ciclos de reparo 1 e 2; revisão independente final condicionalmente aprovada; backup e migração de produção; push e deploy.
- Gates locais: testes 21/21, sintaxe, diff escopado (fora dos arquivos alheios), audit 0 alta/crítica, build Vercel e simulação transacional idempotente da migração no PostgreSQL conectado aprovados. A simulação aplicou a migração duas vezes e fez rollback; as contagens de pedidos, compradores, itens e pagamentos permaneceram preservadas.
- Falhas/retries de provedor: 0. Reparos: 2 de no máximo 2.
- Verificação pendente: correção e revisão do IP confiável no runtime Vercel, seguida de uma nova release.
- Deploy/live smoke: o deploy `dpl_H4W1bTB2ApjqEUcED3RVCzeRSXUZ` ficou `READY`, mas o smoke de login administrativo recebeu `503 AUTH_RATE_LIMIT_UNAVAILABLE`. Foi promovido de volta o deployment `dpl_9fYpfLYhS39xQY6T416bt9EjNGFz`; health `200` e login admin inválido `401` confirmados. Rollback: acionado, com sucesso.
