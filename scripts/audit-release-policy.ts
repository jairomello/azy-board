import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export type JobContext = { jobId: string; context: string }
export type RequiredCheck = {
  jobId: string
  context: string
  appSlugExpected: string
  requiredByPolicy: boolean
}
export type ReleasePolicyManifest = {
  repository: { slug: string; defaultBranch: string; protectedBranchTargets: string[] }
  protectionAudit: {
    strictUpToDateByPolicy: boolean
    allowedBypassActors: string[] | 'UNKNOWN'
  }
  requiredChecks: RequiredCheck[]
}
export type ProtectedCheck = { context: string; appSlug: string | null }
export type BranchProtectionSnapshot = {
  branch: string
  protected: boolean
  strict: boolean | null
  requiredChecks: ProtectedCheck[]
  bypassActors: string[]
}
export type ExternalProtectionSnapshot =
  | { status: 'AVAILABLE'; branches: BranchProtectionSnapshot[] }
  | { status: 'NOT_PROVEN'; reason: string; branches?: BranchProtectionSnapshot[] }

export type AuditFinding = {
  code: string
  severity: 'ERROR' | 'UNKNOWN'
  branch?: string
  context?: string
  detail: string
}

export function parseWorkflowJobContexts(source: string): JobContext[] {
  const jobs: JobContext[] = []
  let insideJobs = false
  let currentJobId: string | null = null
  let currentName: string | null = null

  const finish = () => {
    if (currentJobId) jobs.push({ jobId: currentJobId, context: currentName ?? currentJobId })
    currentJobId = null
    currentName = null
  }

  for (const line of source.split(/\r?\n/)) {
    if (!insideJobs) {
      if (line.trim() === 'jobs:') insideJobs = true
      continue
    }
    if (line && !line.startsWith(' ') && !line.startsWith('#')) break

    const jobHeader = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)
    if (jobHeader) {
      finish()
      currentJobId = jobHeader[1]!
      continue
    }
    const name = /^ {4}name:\s*(.*?)\s*$/.exec(line)
    if (name && currentJobId) currentName = unquote(name[1]!)
  }
  finish()
  return jobs
}

function unquote(value: string): string {
  return value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ? value.slice(1, -1)
    : value
}

export function auditReleasePolicy(
  manifest: ReleasePolicyManifest,
  workflowJobs: JobContext[],
  protection: ExternalProtectionSnapshot,
) {
  const findings: AuditFinding[] = []
  const add = (code: string, severity: AuditFinding['severity'], detail: string, branch?: string, context?: string) => {
    findings.push({ code, severity, detail, ...(branch ? { branch } : {}), ...(context ? { context } : {}) })
  }

  for (const expected of manifest.requiredChecks.filter(check => check.requiredByPolicy)) {
    const job = workflowJobs.find(candidate => candidate.jobId === expected.jobId)
    if (!job) {
      add('WORKFLOW_JOB_MISSING', 'ERROR', `Job ${expected.jobId} não existe no workflow.`, undefined, expected.context)
    } else if (job.context !== expected.context) {
      add('CHECK_CONTEXT_RENAMED', 'ERROR', `Contexto esperado ${expected.context}; workflow publica ${job.context}.`, undefined, expected.context)
    }
  }

  if (protection.status === 'NOT_PROVEN') {
    add('PROTECTION_NOT_PROVEN', 'UNKNOWN', protection.reason)
  } else {
    for (const branchName of manifest.repository.protectedBranchTargets) {
      const branch = protection.branches.find(candidate => candidate.branch === branchName)
      if (!branch) {
        add('BRANCH_NOT_AUDITED', 'UNKNOWN', 'A API não retornou uma fotografia efetiva para a branch.', branchName)
        continue
      }
      if (!branch.protected) {
        add('BRANCH_UNPROTECTED', 'ERROR', 'Nenhuma branch protection/ruleset ativo protege a branch alvo.', branchName)
        continue
      }
      for (const expected of manifest.requiredChecks.filter(check => check.requiredByPolicy)) {
        const actual = branch.requiredChecks.find(check => check.context === expected.context)
        if (!actual) {
          add('REQUIRED_CHECK_MISSING', 'ERROR', `Check obrigatório ${expected.context} não está exigido pela branch.`, branchName, expected.context)
        } else if (!actual.appSlug) {
          add('CHECK_APP_UNBOUND', 'UNKNOWN', `O contexto ${expected.context} não está vinculado a um app emissor comprovado.`, branchName, expected.context)
        } else if (actual.appSlug !== expected.appSlugExpected) {
          add('APP_EMITTER_MISMATCH', 'ERROR', `App esperado ${expected.appSlugExpected}; proteção vincula ${actual.appSlug}.`, branchName, expected.context)
        }
      }
      if (manifest.protectionAudit.strictUpToDateByPolicy && branch.strict === false) {
        add('STRICT_UP_TO_DATE_DISABLED', 'ERROR', 'A branch não exige checks atualizados em relação à base.', branchName)
      } else if (manifest.protectionAudit.strictUpToDateByPolicy && branch.strict === null) {
        add('STRICT_UP_TO_DATE_UNKNOWN', 'UNKNOWN', 'Não foi possível confirmar a política de atualização dos checks.', branchName)
      }
      if (manifest.protectionAudit.allowedBypassActors === 'UNKNOWN') {
        add('BYPASS_POLICY_UNKNOWN', 'UNKNOWN', `A lista atual de bypass (${branch.bypassActors.join(', ') || 'vazia'}) não pode ser comparada: a política ainda é desconhecida.`, branchName)
      } else {
        const actual = [...branch.bypassActors].sort()
        const expected = [...manifest.protectionAudit.allowedBypassActors].sort()
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          add('BYPASS_ACTORS_MISMATCH', 'ERROR', `Bypass atual [${actual.join(', ')}] diverge do manifesto [${expected.join(', ')}].`, branchName)
        }
      }
    }
  }

  const status = findings.some(finding => finding.severity === 'ERROR')
    ? 'FAIL'
    : findings.some(finding => finding.severity === 'UNKNOWN') ? 'NOT_PROVEN' : 'PASS'
  return { status, findings, repository: manifest.repository.slug }
}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> }
type FetchLike = (input: string, init?: RequestInit) => Promise<JsonResponse>

async function getJson(fetcher: FetchLike, url: string, token: string): Promise<{ status: number; value: unknown }> {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) return { status: response.status, value: null }
  return { status: response.status, value: await response.json() }
}

function matchesBranchPattern(pattern: string, branch: string, defaultBranch: string): boolean {
  if (pattern === '~ALL') return true
  if (pattern === '~DEFAULT_BRANCH') return branch === defaultBranch
  const value = pattern.startsWith('refs/heads/') ? pattern.slice('refs/heads/'.length) : pattern
  const escaped = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(branch)
}

function rulesetApplies(ruleset: Record<string, unknown>, branch: string, defaultBranch: string): boolean {
  if (ruleset.target !== 'branch' || ruleset.enforcement !== 'active') return false
  const conditions = ruleset.conditions as { ref_name?: { include?: string[]; exclude?: string[] } } | undefined
  const include = conditions?.ref_name?.include ?? ['~ALL']
  const exclude = conditions?.ref_name?.exclude ?? []
  return include.some(pattern => matchesBranchPattern(pattern, branch, defaultBranch))
    && !exclude.some(pattern => matchesBranchPattern(pattern, branch, defaultBranch))
}

/** Consulta GitHub em modo somente-leitura. Sem token de leitura, retorna NOT_PROVEN. */
export async function readExternalProtection(
  manifest: ReleasePolicyManifest,
  token: string | undefined,
  fetcher: FetchLike = fetch as FetchLike,
): Promise<ExternalProtectionSnapshot> {
  if (!token) return { status: 'NOT_PROVEN', reason: 'GITHUB_TOKEN ausente; proteção externa não foi consultada.' }
  const api = 'https://api.github.com'
  const repo = manifest.repository.slug
  const appResponse = await getJson(fetcher, `${api}/apps/github-actions`, token)
  if (appResponse.status !== 200) return { status: 'NOT_PROVEN', reason: `Consulta do app emissor falhou (HTTP ${appResponse.status}).` }
  const appId = (appResponse.value as { id?: number }).id
  if (typeof appId !== 'number') return { status: 'NOT_PROVEN', reason: 'Resposta do app github-actions sem ID verificável.' }

  const rulesetsResponse = await getJson(fetcher, `${api}/repos/${repo}/rulesets?per_page=100`, token)
  if (rulesetsResponse.status !== 200 || !Array.isArray(rulesetsResponse.value)) {
    return { status: 'NOT_PROVEN', reason: `Consulta dos rulesets falhou (HTTP ${rulesetsResponse.status}).` }
  }
  const rulesets = rulesetsResponse.value as Array<Record<string, unknown>>
  const branches: BranchProtectionSnapshot[] = []

  for (const branchName of manifest.repository.protectedBranchTargets) {
    const url = `${api}/repos/${repo}/branches/${encodeURIComponent(branchName)}/protection`
    const response = await getJson(fetcher, url, token)
    if (response.status !== 200 && response.status !== 404) {
      return { status: 'NOT_PROVEN', branches, reason: `Consulta de proteção para ${branchName} falhou (HTTP ${response.status}).` }
    }
    const protection = response.status === 200 ? response.value as Record<string, unknown> : null
    const requiredStatus = protection?.required_status_checks as { strict?: boolean; contexts?: string[]; checks?: Array<{ context?: string; app_id?: number | null }> } | null | undefined
    const checkEntries = requiredStatus?.checks?.length
      ? requiredStatus.checks.map(check => ({ context: check.context ?? '', appId: check.app_id ?? null }))
      : (requiredStatus?.contexts ?? []).map(context => ({ context, appId: null }))
    let strict: boolean | null = typeof requiredStatus?.strict === 'boolean' ? requiredStatus.strict : null
    const bypassActors: string[] = []
    if (protection?.enforce_admins && typeof protection.enforce_admins === 'object'
      && (protection.enforce_admins as { enabled?: boolean }).enabled === false) bypassActors.push('admins')

    let rulesetProtects = false
    for (const ruleset of rulesets) {
      if (!rulesetApplies(ruleset, branchName, manifest.repository.defaultBranch)) continue
      for (const actor of (ruleset.bypass_actors as Array<Record<string, unknown>> | undefined) ?? []) {
        bypassActors.push(`${String(actor.actor_type ?? 'unknown')}:${String(actor.actor_id ?? 'unknown')}:${String(actor.bypass_mode ?? 'unknown')}`)
      }
      for (const rule of (ruleset.rules as Array<Record<string, unknown>> | undefined) ?? []) {
        if (rule.type !== 'required_status_checks') continue
        rulesetProtects = true
        const parameters = rule.parameters as { required_status_checks?: Array<{ context?: string; integration_id?: number | null }>; strict_required_status_checks_policy?: boolean } | undefined
        for (const check of parameters?.required_status_checks ?? []) {
          checkEntries.push({ context: check.context ?? '', appId: check.integration_id ?? null })
        }
        if (typeof parameters?.strict_required_status_checks_policy === 'boolean') {
          strict = strict === true || parameters.strict_required_status_checks_policy
        }
      }
    }
    const requiredChecks = checkEntries.filter(check => check.context).map(check => ({
      context: check.context,
      appSlug: check.appId === null ? null : check.appId === appId ? 'github-actions' : `app-id:${check.appId}`,
    }))
    branches.push({
      branch: branchName,
      protected: response.status === 200 || rulesetProtects,
      strict,
      requiredChecks,
      bypassActors: [...new Set(bypassActors)].sort(),
    })
  }
  return { status: 'AVAILABLE', branches }
}

async function main() {
  const root = join(import.meta.dir, '..')
  const manifestPath = resolve(process.env.RELEASE_POLICY_MANIFEST ?? join(root, 'docs', 'release-policy.json'))
  const workflowPath = resolve(process.env.RELEASE_POLICY_WORKFLOW ?? join(root, '.github', 'workflows', 'ci.yml'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReleasePolicyManifest
  const workflowJobs = parseWorkflowJobContexts(await readFile(workflowPath, 'utf8'))
  const protection = await readExternalProtection(manifest, process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN)
  const audit = auditReleasePolicy(manifest, workflowJobs, protection)
  const report = {
    ...audit,
    checkedAt: new Date().toISOString(),
    commitSha: Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root }).stdout.toString().trim(),
    externalProtection: protection,
  }
  const outputPath = process.env.RELEASE_POLICY_AUDIT_OUTPUT
  if (outputPath) {
    const destination = resolve(outputPath)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  }
  console.log(JSON.stringify(report, null, 2))
  if (audit.status !== 'PASS') process.exitCode = 1
}

if (import.meta.main) await main()
