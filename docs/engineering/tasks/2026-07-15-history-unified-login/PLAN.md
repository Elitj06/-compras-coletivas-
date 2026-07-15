# Plano — histórico e login unificado

## Classificação

- Risco: alto / release.
- Motivo: autenticação, associação persistente de pedidos históricos e produção.
- Retorno: commit `1dbd5ca`; alterações pré-existentes não pertencentes à tarefa: `SYNC-RESULT.md`, `SYNC-TASK.md`, `scripts/sync_july2026.py`.

## Desenho

1. Associar pedidos legados sem `comprador_id` apenas quando houver exatamente um comprador com o mesmo nome normalizado.
2. Expor o ciclo em cada registro de histórico e agrupá-lo visualmente no painel do comprador e no histórico administrativo.
3. Associar, por configuração explícita, a conta administrativa ao comprador do administrador. No login admin, emitir também uma sessão de comprador para essa conta; o navegador preserva os dois tokens sem pedir um segundo login.
4. Manter sessões e permissões separadas no servidor: o token administrativo continua necessário para operações administrativas e o token de comprador continua limitado à conta vinculada.

## Aceite

- Pedido legado associado aparece no histórico do comprador, identificado pelo ciclo.
- Histórico mostra ciclos encerrados e o atual, sem incluir pedidos de outros compradores.
- Login administrativo abre Admin e habilita Meu Pedido/Histórico do administrador sem PIN adicional.
- Login de comprador não ganha poderes de admin.
- Migração é aditiva e idempotente; não exclui pedidos, itens, pagamentos ou compradores.
