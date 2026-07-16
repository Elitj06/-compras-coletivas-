# Telemetria

- Tarefa: `buyer-login-error-status-20260716` / Compras Coletivas.
- Início: 2026-07-16 UTC; risco: alto / release; Deep Architecture: não.
- Cadeia: planejamento e auditoria independentes → implementador GPT/Codex → verificador independente pendente → reviewer de terceira família pendente.
- Retorno: `eecfdda`; retries/fallbacks: 0; ciclos de reparo: 0.
- Gates locais: teste focado 2/2, suíte 15/15 com 1 integração PostgreSQL pulada, sintaxe e diff check do escopo aprovados.
- Deploy/live-smoke: pendentes do push e da integração Git/Vercel.
- Achados: defeito corrigido — Promises de rota não aguardadas escapavam do conversor de `BuyerAuthError`; severidade alta (autenticação).
- Rollback invocado: não.
