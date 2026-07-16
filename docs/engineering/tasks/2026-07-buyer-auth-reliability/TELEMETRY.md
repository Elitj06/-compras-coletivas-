# Telemetria — confiabilidade do acesso do comprador

- Data: 2026-07-16.
- Projeto: `compras-coletivas`.
- Risco/lane: `critical / release` pela mutação autorizada de segredo em produção.
- Deep Architecture: não ativa; alteração localizada sem mudança de modelo ou fronteira arquitetural.
- Baseline e rollback de código: `6298c50`.
- Writer: único nos hotspots de autenticação, recuperação, UX, testes e documentação desta tarefa.
- Segredo: chave CSPRNG exclusiva configurada no ambiente protegido; somente presença e comprimento mínimo foram verificados.
- Ciclos de reparo: 2, limite atingido. Ciclo 1 reparou identidade sugerida no `409`,
  amplificação de auditoria e dependências. Ciclo 2 reparou corrida login/reset, SMTP
  síncrono e asset remoto.
- Gates locais: 26/26 sem banco; 40/40 com PostgreSQL 16 descartável.
- Cobertura nova: resolução canônica positiva, nomes divergentes, múltiplos históricos, login pós-recuperação, conflito `409`, loading e falha de rede.
- Dependências: Nodemailer `9.0.3`, `ws` `8.21.0`, `@vercel/functions` `3.7.5`, sem
  pacote Node `xlsx`; SheetJS browser `0.20.3` oficial e self-hosted.
- Resposta pública de recuperação: SMTP fora do caminho crítico e piso uniforme de 450 ms.
- Auditoria: `npm audit --audit-level=low` com zero vulnerabilidades.
- Sintaxe, diff-check escopado e `vercel build --prod`: aprovados.
- Dados: nenhuma mesclagem, exclusão ou mutação de cadastro/pedido executada.
- Verifier independente: primeiro veredito `REJECT`; reparos aplicados; segundo veredito `APPROVE`.
- Reviewer final: primeiro veredito `REJECT`; três findings reparados no ciclo 2;
  segundo veredito `APPROVE` para rollout controlado.
- GitHub: commit funcional `c340b2e` publicado em `main`.
- Produção: deployment `dpl_CN8XK1AUbCTthbBVntme3fVMXHuA` em estado `READY`,
  atendendo o alias canônico.
- Smoke no ar: health `200`; login inválido `401`; conflito de cadastro existente
  `409`; recuperação `202`/`no-store`; sessão e histórico autenticados `200`.
- Entrega controlada: mensagem localizada na caixa de homologação, código consumido
  uma vez, replay `400`, PIN anterior `401` e PIN novo `200`.
- Identidade reportada: resolvedor de produção seleciona o cadastro original com
  pedido de Abril e preserva o duplicado sem histórico; nenhum dado foi mesclado.
- Higiene do smoke: compradores e auditorias sintéticos remanescentes = zero.
- Backup pré-release: dump lógico validado, 414.980 bytes e 172 entradas.
- Rollback: desativar recuperação e promover `6298c50`; nenhum rollback de dados previsto.
