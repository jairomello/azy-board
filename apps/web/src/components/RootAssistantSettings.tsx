import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "./AppShell";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { api } from "../lib/api";
import { sanitizedGovernance } from "../lib/governanceLimits";
import { DEFAULT_GOVERNANCE, GOVERNANCE_BOUNDS } from "@azy-board/assistant-contracts";

type ModelConfig = {
  id: string
  provider: "OPENAI" | "OPENROUTER"
  model: string
  keyPrefix: string | null
  position: number
  enabled: boolean
  validationStatus: "UNVALIDATED" | "VALID" | "INVALID"
  validatedAt: string | null
}

export default function RootAssistantSettings() {
  const { t } = useTranslation("assistant");
  const { user } = useAuth();
  const { availability, refresh } = useAssistant();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [provider, setProvider] = useState<"OPENAI" | "OPENROUTER">("OPENAI");
  const [model, setModel] = useState("");
  const [secret, setSecret] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [modelFeedback, setModelFeedback] = useState("");
  const [modelError, setModelError] = useState("");
  const [modelBusy, setModelBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [governance, setGovernance] = useState({ ...DEFAULT_GOVERNANCE });
  const [usage, setUsage] = useState<{ activeRuns: number; dailyCostMicros: number } | null>(null);

  useEffect(() => {
    if (!availability) return;
    setEnabled(availability.enabled);
    if (availability.governance) setGovernance((current) => ({ ...current, ...availability.governance }));
  }, [availability]);

  async function refreshModels() {
    const response = await api.get<{ models: ModelConfig[] }>('/assistant/root/models');
    setModels(response.models);
  }

  useEffect(() => {
    if (user?.globalGroup !== 'ROOT') return;
    void refreshModels().catch(() => setModels([]));
  }, [user?.globalGroup]);

  useEffect(() => {
    if (user?.globalGroup !== "ROOT") return;
    void api.get<{ activeRuns: number; dailyCostMicros: number }>("/assistant/root/governance/usage").then(setUsage).catch(() => setUsage(null));
  }, [user?.globalGroup, availability?.updatedAt]);

  function openNewModel() {
    setEditingModelId(null); setProvider('OPENAI'); setModel(''); setSecret('');
    setModelFeedback(''); setModelError(''); setFormOpen(true);
  }

  function openEditModel(config: ModelConfig) {
    setEditingModelId(config.id); setProvider(config.provider); setModel(config.model); setSecret('');
    setModelFeedback(''); setModelError(''); setFormOpen(true);
  }

  async function testModelConnection(configId?: string) {
    setModelBusy(true); setModelError(''); setModelFeedback('');
    try {
      const stored = configId ? models.find(config => config.id === configId) : undefined;
      const editingStored = Boolean(configId && editingModelId === configId && formOpen);
      const result = configId
        ? await api.post<{ status: string }>(`/assistant/root/models/${configId}/test`, {
            provider: editingStored ? provider : stored?.provider,
            model: editingStored ? model : stored?.model,
            ...(editingStored && secret ? { secret } : {}),
          })
        : await api.post<{ status: string }>('/assistant/root/models/test', { provider, model, secret });
      if (result.status === 'VALID') setModelFeedback(t('connectionValid'));
      else setModelError(t('connectionInvalid'));
    } catch (e) {
      setModelError(e instanceof Error ? e.message : t('operationFailed'));
    } finally {
      setModelBusy(false);
    }
  }

  async function saveModel() {
    setModelBusy(true); setModelError(''); setModelFeedback('');
    try {
      const body = { provider, model, ...(secret ? { secret } : {}) };
      if (editingModelId) await api.patch(`/assistant/root/models/${editingModelId}`, body);
      else await api.post('/assistant/root/models', body);
      setSecret(''); setFormOpen(false); setModelFeedback(t('modelSaved'));
      await refreshModels();
      await refresh();
    } catch (e) {
      setModelError(e instanceof Error ? e.message : t('operationFailed'));
    } finally {
      setModelBusy(false);
    }
  }

  async function toggleModel(config: ModelConfig) {
    setModelBusy(true); setModelError('');
    try {
      await api.patch(`/assistant/root/models/${config.id}`, { enabled: !config.enabled });
      await refreshModels(); await refresh();
    } catch (e) { setModelError(e instanceof Error ? e.message : t('operationFailed')); }
    finally { setModelBusy(false); }
  }

  async function moveModel(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= models.length) return;
    const ordered = [...models];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex]!, ordered[index]!];
    setModelBusy(true); setModelError('');
    try {
      const response = await api.patch<{ models: ModelConfig[] }>('/assistant/root/models/reorder', { orderedIds: ordered.map(item => item.id) });
      setModels(response.models); await refresh();
    } catch (e) { setModelError(e instanceof Error ? e.message : t('operationFailed')); }
    finally { setModelBusy(false); }
  }

  async function removeModel(config: ModelConfig) {
    if (!window.confirm(t('removeModelConfirm', { model: config.model }))) return;
    setModelBusy(true); setModelError('');
    try {
      await api.delete(`/assistant/root/models/${config.id}`);
      await refreshModels(); await refresh(); setModelFeedback(t('modelRemoved'));
    } catch (e) { setModelError(e instanceof Error ? e.message : t('operationFailed')); }
    finally { setModelBusy(false); }
  }

  async function setAvailability(next: boolean) {
    setBusy(true);
    setError("");
    try {
      await api.patch("/assistant/root/availability", { enabled: next });
      setEnabled(next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveGovernance() {
    setBusy(true);
    setError("");
    try {
      // Card B6 — campo vazio/fora dos limites não bloqueia o salvamento: cada
      // chave é normalizada para os limites do contrato (`Number('')` = 0 volta
      // ao default) e a própria tela passa a exibir os valores normalizados.
      const normalized = sanitizedGovernance(governance);
      await api.patch("/assistant/root/governance", normalized);
      setGovernance(normalized);
      setMessage(t("governanceSaved"));
      await refresh();
      const current = await api.get<{ activeRuns: number; dailyCostMicros: number }>("/assistant/root/governance/usage");
      setUsage(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (user?.globalGroup !== "ROOT")
    return (
      <AppShell sectionLabel={t("rootTitle")} contextLabel={t("accessDenied")}>
        <div
          role="alert"
          className="mx-auto mt-10 max-w-xl rounded-xl border border-border bg-card p-6 text-center"
        >
          {t("accessDenied")}
        </div>
      </AppShell>
    );

  return (
    <AppShell
      sectionLabel={t("rootTitle")}
      contextLabel={t("configuration")}
      contentClassName="overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl space-y-5 py-6 sm:py-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Root
          </p>
          <h2 className="mt-1 text-2xl font-bold">{t("rootTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("securityNote")}
          </p>
        </header>
        {(message || error) && (
          <p
            role={error ? "alert" : "status"}
            className={`rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}
          >
            {error || message}
          </p>
        )}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t("availability")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("availabilityHelp")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled && Boolean(availability?.configured)}
              disabled={busy || !availability?.configured}
              onClick={() => void setAvailability(!enabled)}
              className={`relative h-7 w-12 rounded-full transition ${enabled && availability?.configured ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled && availability?.configured ? "left-6" : "left-1"}`}
              />
            </button>
          </div>
          <p
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            {availability?.configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            {availability?.configured
                ? t("configured")
                : t("pending")}
          </p>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
             <h3 className="font-semibold">{t("governance")}</h3>
             <p className="text-sm text-muted-foreground">{t("governanceHelp")}</p>
          </div>
           {usage && <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2"><span>{t("activeRuns")}: <strong>{usage.activeRuns}</strong></span><span>{t("costToday")}: <strong>${(usage.dailyCostMicros / 1_000_000).toFixed(2)}</strong></span></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["requestsPerMinute", t("requestsPerMinute")],
              ["maxActivePerUser", t("maxActivePerUser")],
              ["maxActivePerTenant", t("maxActivePerTenant")],
              ["maxSteps", t("maxSteps")],
              ["maxToolCalls", t("maxToolCalls")],
              ["maxInputTokens", t("maxInputTokens")],
              ["maxOutputTokens", t("maxOutputTokens")],
              ["maxPayloadBytes", t("maxPayloadBytes")],
              ["timeoutMs", t("timeoutMs")],
              ["dailyBudgetMicros", t("dailyBudgetMicros")],
              ["tenantDailyBudgetMicros", t("tenantDailyBudgetMicros")],
            ] as [keyof typeof governance, string][]).map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" min={GOVERNANCE_BOUNDS[key][0]} max={GOVERNANCE_BOUNDS[key][1]} value={governance[key]} onChange={(e) => setGovernance((current) => ({ ...current, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>)}
          </div>
           <button type="button" disabled={busy} onClick={() => void saveGovernance()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("saveLimits")}</button>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t("modelsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("modelsHelp")}</p>
            </div>
            <button type="button" disabled={modelBusy} onClick={openNewModel} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Plus className="h-4 w-4" />{t("addModel")}
            </button>
          </div>

          {(modelFeedback || modelError) && <p role={modelError ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${modelError ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{modelError || modelFeedback}</p>}

          {models.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <p className="font-semibold">{t("noModels")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("noModelsHelp")}</p>
            </div>
          ) : (
            <ol className="space-y-3" aria-label={t("modelsOrder")}>
              {models.map((config, index) => {
                const eligibleBefore = models.slice(0, index).filter(item => item.enabled && item.validationStatus === 'VALID').length;
                const eligible = config.enabled && config.validationStatus === 'VALID';
                const isPrimary = eligible && eligibleBefore === 0;
                return (
                <li key={config.id} className={`rounded-xl border bg-background p-4 ${index === 0 ? "border-primary/40" : "border-border"}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">{config.model}</h4>
                        {isPrimary && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">{t("primaryModel")}</span>}
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{isPrimary ? t("primaryLabel") : eligible ? t("fallbackLabel", { number: eligibleBefore }) : t("modelInactive")} · {config.provider}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t("apiKey")}: {config.keyPrefix ?? t("credentialUnavailable")}</p>
                      <p className={`mt-2 flex items-center gap-1.5 text-xs ${config.validationStatus === "VALID" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {config.validationStatus === "VALID" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                        {t(config.validationStatus === "VALID" ? "modelValidated" : "modelNeedsValidation")}
                      </p>
                    </div>
                    <button type="button" role="switch" aria-checked={config.enabled} aria-label={t("toggleModel", { model: config.model })} disabled={modelBusy || config.validationStatus !== "VALID"} onClick={() => void toggleModel(config)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${config.enabled ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${config.enabled ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                    <button type="button" aria-label={t("moveModelUp", { model: config.model })} title={t("moveUp")} disabled={modelBusy || index === 0} onClick={() => void moveModel(index, -1)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={t("moveModelDown", { model: config.model })} title={t("moveDown")} disabled={modelBusy || index === models.length - 1} onClick={() => void moveModel(index, 1)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" disabled={modelBusy} onClick={() => void testModelConnection(config.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"><KeyRound className="h-4 w-4" />{t("test")}</button>
                    <button type="button" disabled={modelBusy} onClick={() => openEditModel(config)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">{t("editModel")}</button>
                    <button type="button" disabled={modelBusy} aria-label={t("removeModel", { model: config.model })} onClick={() => void removeModel(config)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              )})}
            </ol>
          )}

          {formOpen && <form className="space-y-4 rounded-xl border border-primary/30 bg-muted/20 p-4" onSubmit={(event) => { event.preventDefault(); void saveModel(); }}>
            <div className="flex items-start justify-between gap-3">
              <div><h4 className="font-semibold">{t(editingModelId ? "editModelTitle" : "addModelTitle")}</h4><p className="mt-1 text-sm text-muted-foreground">{t("modelFormHelp")}</p></div>
              <button type="button" aria-label={t("cancel")} onClick={() => setFormOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">×</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">{t("provider")}<select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"><option value="OPENAI">OpenAI</option><option value="OPENROUTER">OpenRouter</option></select></label>
              <label className="text-sm">{t("model")}<input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={provider === "OPENROUTER" ? "anthropic/claude-sonnet-4" : "gpt-4.1"} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            </div>
            <label className="block text-sm">{t("apiKey")}<input type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={editingModelId ? t("secretKeepExisting") : t("secretPlaceholder")} required={!editingModelId} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {modelFeedback && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{modelFeedback}</p>}
              <div className="ml-auto flex gap-2">
                <button type="button" disabled={modelBusy || (!secret && !editingModelId)} onClick={() => void testModelConnection(editingModelId ?? undefined)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"><KeyRound className="h-4 w-4" />{t("test")}</button>
                <button type="submit" disabled={modelBusy || !model.trim() || (!editingModelId && !secret)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />{modelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("saveModel")}</button>
              </div>
            </div>
          </form>}
          <p className="text-xs text-muted-foreground">{t("fallbackPrivacyNote")}</p>
          {modelBusy && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t("loading")} />}
        </section>
      </div>
    </AppShell>
  );
}
