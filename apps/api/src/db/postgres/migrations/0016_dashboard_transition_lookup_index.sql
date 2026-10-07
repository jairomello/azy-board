-- [TENANT] Última transição entra por item no escopo tenant/projeto.
-- [DB-SWAP] Índice dirigido pelo plano do snapshot/aging nos eventos de transição.
CREATE INDEX IF NOT EXISTS item_events_transition_lookup_idx
  ON item_events (tenant_id, project_id, item_id, event_type, occurred_at DESC, sequence DESC, id DESC);
