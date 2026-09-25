import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { runSqliteAtomic } from './atomicTransaction'

describe('runSqliteAtomic', () => {
  test('commits operações síncronas', () => {
    const database = new Database(':memory:')
    database.exec('CREATE TABLE entries (value TEXT NOT NULL)')

    runSqliteAtomic(database, () => {
      database.query('INSERT INTO entries (value) VALUES (?)').run('saved')
    })

    expect(database.query('SELECT value FROM entries').all()).toEqual([{ value: 'saved' }])
    database.close()
  })

  test('reverte gravações se a operação lança erro', () => {
    const database = new Database(':memory:')
    database.exec('CREATE TABLE entries (value TEXT NOT NULL)')

    expect(() => runSqliteAtomic(database, () => {
      database.query('INSERT INTO entries (value) VALUES (?)').run('must roll back')
      throw new Error('falha simulada')
    })).toThrow('falha simulada')

    expect(database.query('SELECT value FROM entries').all()).toEqual([])
    database.close()
  })

  test('detecta callback thenable e reverte as gravações antes do commit', () => {
    const database = new Database(':memory:')
    database.exec('CREATE TABLE entries (value TEXT NOT NULL)')

    expect(() => runSqliteAtomic(database, () => {
      database.query('INSERT INTO entries (value) VALUES (?)').run('must roll back')
      return Promise.resolve()
    })).toThrow('Transações SQLite devem usar operações síncronas')

    expect(database.query('SELECT value FROM entries').all()).toEqual([])
    database.close()
  })
})
