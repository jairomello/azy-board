import { describe, expect, test } from 'bun:test'
import { resolveAuthConfig, resolveAuthProvider } from './authConfig'
import { createOauthState, createPkce, oauthAuthorizeUrl, parseIdToken, verifyIdToken } from './oauth'
import type { ResolvedAuthConfig } from './authConfig'

describe('authConfig (T45)', () => {
  test('default é LOCAL', () => {
    expect(resolveAuthProvider({})).toBe('LOCAL')
    expect(resolveAuthConfig({}).provider).toBe('LOCAL')
  })

  test('provedor inválido falha de forma explícita', () => {
    expect(() => resolveAuthProvider({ AZYBOARD_AUTH_PROVIDER: 'TWITTER' })).toThrow(/AZYBOARD_AUTH_PROVIDER/)
  })

  test('MICROSOFT sem credenciais falha na inicialização', () => {
    expect(() => resolveAuthConfig({ AZYBOARD_AUTH_PROVIDER: 'MICROSOFT', AZYBOARD_AUTH_REDIRECT_URL: 'http://localhost/cb' })).toThrow(/CLIENT_ID/)
  })

  test('MICROSOFT completo resolve a configuração', () => {
    const config = resolveAuthConfig({
      AZYBOARD_AUTH_PROVIDER: 'MICROSOFT', AZYBOARD_AUTH_REDIRECT_URL: 'http://localhost:5173/api/auth/oauth/microsoft/callback',
      AZYBOARD_MICROSOFT_CLIENT_ID: 'ms-id', AZYBOARD_MICROSOFT_CLIENT_SECRET: 'ms-secret', AZYBOARD_MICROSOFT_TENANT_ID: 'ten',
    })
    expect(config).toMatchObject({ provider: 'MICROSOFT', clientId: 'ms-id', tenantId: 'ten' })
  })

  test('GOOGLE exige clientId e secret', () => {
    expect(() => resolveAuthConfig({ AZYBOARD_AUTH_PROVIDER: 'GOOGLE', AZYBOARD_AUTH_REDIRECT_URL: 'http://x' })).toThrow(/GOOGLE_CLIENT_ID/)
  })
})

const msConfig = {
  provider: 'MICROSOFT', clientId: 'aud-1', clientSecret: 'secret', tenantId: 'tenant-x', redirectUrl: 'http://localhost:5173/api/auth/oauth/microsoft/callback',
} as unknown as Extract<ResolvedAuthConfig, { provider: 'MICROSOFT' }>

describe('oauth helpers (T45)', () => {
  test('createOauthState e PKCE têm entropia e formato', () => {
    expect(createOauthState().length).toBeGreaterThan(20)
    const { verifier, challenge } = createPkce()
    expect(verifier.length).toBe(64)
    expect(challenge.length).toBeGreaterThan(20)
    expect(challenge).not.toBe(verifier)
  })

  test('authorizeUrl embute client, redirect, state e PKCE', () => {
    const url = oauthAuthorizeUrl(msConfig, 'st', 'challenge-value')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('client_id')).toBe('aud-1')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('state')).toBe('st')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-value')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url).toContain('login.microsoftonline.com/tenant-x/oauth2/v2.0/authorize')
  })

  test('parseIdToken decodifica claims sem verificar', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ email: 'a@b.com', email_verified: true })).toString('base64url')
    const { header: h, payload: p } = parseIdToken(`${header}.${payload}.sig`)
    expect(h.alg).toBe('RS256')
    expect(p.email).toBe('a@b.com')
  })

  test('verifyIdToken valida assinatura RS256 (JWKS mockada)', async () => {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify'],
    )
    const jwk = await crypto.subtle.exportKey('jwk', publicKey)
    const kid = 'mock-kid'
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://login.microsoftonline.com/tenant-x/v2.0', aud: 'aud-1', sub: 'sub-1',
      email: 'user@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600,
    })).toString('base64url')
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${payload}`)))
    const idToken = `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`

    const fetchImpl = (async (url: string | URL | Request) => {
      expect(String(url)).toContain('discovery/v2.0/keys')
      return new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', use: 'sig', n: jwk.n, e: jwk.e }] }), { status: 200 })
    }) as unknown as typeof fetch

    const claims = await verifyIdToken(msConfig, idToken, fetchImpl)
    expect(claims.email).toBe('user@example.com')
    expect(claims.sub).toBe('sub-1')
  })

  test('verifyIdToken rejeita assinatura adulterada', async () => {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify'],
    )
    const jwk = await crypto.subtle.exportKey('jwk', publicKey)
    const kid = 'mock-kid'
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'aud-1', email: 'a@b.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')
    const body = `${header}.${payload}`
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(body)))
    const idToken = `${header}.${payload}.${Buffer.from(signature).toString('base64url')}x`
    const fetchImpl = (async () => new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', use: 'sig', n: jwk.n, e: jwk.e }] }), { status: 200 })) as unknown as typeof fetch
    await expect(verifyIdToken(msConfig, idToken, fetchImpl)).rejects.toThrow(/assinatura|inválid|invalid/i)
  })
})