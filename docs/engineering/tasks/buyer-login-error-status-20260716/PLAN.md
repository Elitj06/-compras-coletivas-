# Plano — status de erro do login do comprador

- Risco: alto / release (autenticação em produção).
- Retorno: `eecfdda`; limites sujos preservados: `SYNC-RESULT.md`, `SYNC-TASK.md`, `scripts/sync_july2026.py`.
- Escopo: aguardar os despachos assíncronos de autenticação para que `BuyerAuthError` seja convertido no status HTTP contratado.
- Rollback: reverter exclusivamente o commit desta tarefa e republicar o commit anterior.
