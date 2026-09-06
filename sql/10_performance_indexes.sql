-- Performance indexes for active-cycle reads and buyer history.
-- Safe to run repeatedly and does not modify application data.

CREATE INDEX IF NOT EXISTS idx_pedidos_active_cycle
  ON pedidos (ciclo_id)
  WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_pedidos_comprador_created_at
  ON pedidos (comprador_id, created_at DESC);
