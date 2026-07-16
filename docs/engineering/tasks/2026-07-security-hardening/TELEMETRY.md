# Telemetria — security hardening

- Task / projeto: `2026-07-security-hardening` / Compras Coletivas.
- Início: 2026-07-16 UTC. Risco/lane: alto/release. Deep Architecture: sim.
- Baseline: `c57dbe50248227dc0db0fd104e1d6504ce44fda3`; rollback: reimplantar esse commit, mantendo a migração aditiva e exigindo novo login.
- Fases concluídas: plano e revisão arquitetural; implementação; verificação independente rejeitada; ciclos de reparo 1 e 2 concluídos. A revisão final está em curso.
- Gates locais: testes 21/21, sintaxe, diff escopado (fora dos arquivos alheios), audit 0 alta/crítica, build Vercel e simulação transacional idempotente da migração no PostgreSQL conectado aprovados. A simulação aplicou a migração duas vezes e fez rollback; as contagens de pedidos, compradores, itens e pagamentos permaneceram preservadas.
- Falhas/retries de provedor: 0. Reparos: 2 de no máximo 2.
- Verificação pendente: parecer final independente, preflight real de produção, backup, configuração explícita da chave de rate limit, deploy e smoke autenticado.
- Deploy/live smoke: não executados. Rollback: não acionado.
