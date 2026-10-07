import { describe, expect, test } from 'bun:test'
import {
  auditReleasePolicy,
  parseWorkflowJobContexts,
  readExternalProtection,
  type ExternalProtectionSnapshot,
  type ReleasePolicyManifest,
} from './audit-release-policy'

const manifest: ReleasePolicyManifest = {
  repository: { slug: 'owner/repo', defaultBranch: 'main', protectedBranchTargets: ['main'] },
  protectionAudit: { strictUpToDateByPolicy: true, allowedBypassActors: [] },
  requiredChecks: [
    { jobId: 'check', context: 'check', appSlugExpected: 'github-actions', requiredByPolicy: true },
    { jobId: 'advanced', context: 'advanced (PostgreSQL + Valkey)', appSlugExpected: 'github-actions', requiredByPolicy: true },
  ],
}

const jobs = [
  { jobId: 'check', context: 'check' },
  { jobId: 'advanced', context: 'advanced (PostgreSQL + Valkey)' },
]

const protectedBranch = (requiredChecks = [
  { context: 'check', appSlug: 'github-actions' },
  { context: 'advanced (PostgreSQL + Valkey)', appSlug: 'github-actions' },
]): ExternalProtectionSnapshot => ({
  status: 'AVAILABLE',
  branches: [{ branch: 'main', protected: true, strict: true, requiredChecks, bypassActors: [] }],
})

describe('auditoria de política de release', () => {
  test('extrai job IDs e contextos nomeados do workflow sem confundir steps', () => {
    const parsed = parseWorkflowJobContexts(`name: ci\non: push\njobs:\n  check:\n    name: check\n    steps:\n      - name: step local\n        run: true\n  advanced:\n    name: advanced (PostgreSQL + Valkey)\n    steps: []\n`)
    expect(parsed).toEqual([
      { jobId: 'check', context: 'check' },
      { jobId: 'advanced', context: 'advanced (PostgreSQL + Valkey)' },
    ])
  })

  test('passa quando workflow, contexto, app e proteção efetiva coincidem', () => {
    expect(auditReleasePolicy(manifest, jobs, protectedBranch()).status).toBe('PASS')
  })

  test('falha quando um check obrigatório está ausente na proteção', () => {
    const snapshot = protectedBranch([{ context: 'check', appSlug: 'github-actions' }])
    const result = auditReleasePolicy(manifest, jobs, snapshot)
    expect(result.status).toBe('FAIL')
    expect(result.findings.map(finding => finding.code)).toContain('REQUIRED_CHECK_MISSING')
  })

  test('falha quando o job é renomeado', () => {
    const result = auditReleasePolicy(manifest, [{ jobId: 'check', context: 'check-v2' }, jobs[1]!], protectedBranch())
    expect(result.status).toBe('FAIL')
    expect(result.findings.map(finding => finding.code)).toContain('CHECK_CONTEXT_RENAMED')
  })

  test('falha quando o app emissor diverge do manifesto', () => {
    const result = auditReleasePolicy(manifest, jobs, protectedBranch([
      { context: 'check', appSlug: 'other-app' },
      { context: 'advanced (PostgreSQL + Valkey)', appSlug: 'github-actions' },
    ]))
    expect(result.status).toBe('FAIL')
    expect(result.findings.map(finding => finding.code)).toContain('APP_EMITTER_MISMATCH')
  })

  test('marca proteção como não comprovada quando falta permissão/token', async () => {
    const snapshot = await readExternalProtection(manifest, undefined)
    const result = auditReleasePolicy(manifest, jobs, snapshot)
    expect(result.status).toBe('NOT_PROVEN')
    expect(result.findings.map(finding => finding.code)).toContain('PROTECTION_NOT_PROVEN')
  })
})
