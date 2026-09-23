declare module 'bun:test' {
  interface Matchers {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toMatchObject(expected: unknown): void
    toHaveLength(expected: number): void
    toContain(expected: unknown): void
    toBeNull(): void
  }
  interface Expectation extends Matchers {
    not: Matchers
  }
  export const describe: (name: string, callback: () => void) => void
  export const test: (name: string, callback: () => void | Promise<void>) => void
  export const expect: (value: unknown) => Expectation
}
