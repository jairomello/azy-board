declare module 'bun:test' {
  type JestDomMatchers = import('@testing-library/jest-dom/matchers').TestingLibraryMatchers<unknown, void>

  interface Matchers<R = void> extends JestDomMatchers {
    toBe(expected: unknown): R
    toEqual(expected: unknown): R
    toMatchObject(expected: unknown): R
    toHaveLength(expected: number): R
    toContain(expected: unknown): R
    toBeNull(): R
    toBeUndefined(): R
    toBeTruthy(): R
    toBeFalsy(): R
    toBeLessThan(expected: number | bigint): R
    toBeLessThanOrEqual(expected: number | bigint): R
    toBeGreaterThan(expected: number | bigint): R
    toBeGreaterThanOrEqual(expected: number | bigint): R
    toBeInstanceOf(expected: unknown): R
    toThrow(expected?: unknown): R
  }
  interface Expectation extends Matchers {
    not: Matchers
    resolves: Matchers
    rejects: Matchers
  }
  interface Expect {
    (value: unknown): Expectation
    extend(matchers: Record<string, (...args: never[]) => unknown>): void
  }
  export const describe: (name: string, callback: () => void) => void
  export const test: (name: string, callback: () => void | Promise<void>) => void
  export const expect: Expect
  export const afterEach: (callback: () => void | Promise<void>) => void
  export const beforeEach: (callback: () => void | Promise<void>) => void
  export const beforeAll: (callback: () => void | Promise<void>) => void
  export const afterAll: (callback: () => void | Promise<void>) => void
}
