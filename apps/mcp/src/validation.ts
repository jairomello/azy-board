export function assertNonEmptyString(value: unknown, field: string, maxLength = 200): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} deve ser uma string não vazia`)
  }
  if (value.trim().length > maxLength) {
    throw new Error(`${field} excede o limite de ${maxLength} caracteres`)
  }
}

export function assertEnum(value: unknown, field: string, values: readonly string[]): void {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${field} inválido; valores aceitos: ${values.join(', ')}`)
  }
}

export function assertStringArray(value: unknown, field: string, maxLength = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maxLength || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${field} deve ser uma lista de até ${maxLength} strings não vazias`)
  }
}

export function assertNonNegativeNumber(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} deve ser um número não negativo`)
  }
}

export function assertIsoDate(value: unknown, field: string): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida`)
  }
}
