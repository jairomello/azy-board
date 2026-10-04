// Card B6 — fonte única de normalização dos parâmetros de governança do tenant.
// Campos vazios/inválidos voltam ao default; valores fora dos limites são grampeados.
import { DEFAULT_GOVERNANCE, GOVERNANCE_BOUNDS } from '@azy-board/assistant-contracts'

export function sanitizedGovernance(current: Record<string, unknown>): typeof DEFAULT_GOVERNANCE {
  const next = { ...DEFAULT_GOVERNANCE };
  for (const key of Object.keys(DEFAULT_GOVERNANCE) as Array<keyof typeof DEFAULT_GOVERNANCE>) {
    const value = Number(current[key]);
    const [min, max] = GOVERNANCE_BOUNDS[key];
    next[key] = Number.isFinite(value) && value > 0
      ? Math.min(max, Math.max(min, Math.round(value)))
      : DEFAULT_GOVERNANCE[key];
  }
  return next;
}
