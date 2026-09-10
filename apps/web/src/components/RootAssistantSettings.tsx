import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "./AppShell";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { api } from "../lib/api";

export default function RootAssistantSettings() {
  const { t } = useTranslation("assistant");
  const { user } = useAuth();
  const { availability, refresh } = useAssistant();
  const [provider, setProvider] = useState<"OPENAI" | "OPENROUTER">("OPENAI");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [governance, setGovernance] = useState({
    requestsPerMinute: 10,
    maxActivePerUser: 1,
    maxActivePerTenant: 3,
    dailyBudgetMicros: 100_000,
    tenantDailyBudgetMicros: 1_000_000,
    maxSteps: 4,
    maxToolCalls: 8,
    maxInputTokens: 8_000,
    maxOutputTokens: 2_000,
    maxPayloadBytes: 50_000,
    timeoutMs: 45_000,
  });
  const [usage, setUsage] = useState<{ activeRuns: number; dailyCostMicros: number } | null>(null);

  useEffect(() => {
    if (!availability) return;
    setEnabled(availability.enabled);
    if (
      availability.provider === "OPENAI" ||
      availability.provider === "OPENROUTER"
    )
      setProvider(availability.provider);
    if (availability.model) setModel(availability.model);
    if (availability.governance) setGovernance((current) => ({ ...current, ...availability.governance }));
  }, [availability]);

  useEffect(() => {
    if (user?.globalGroup !== "ROOT") return;
    void api.get<{ activeRuns: number; dailyCostMicros: number }>("/assistant/root/governance/usage").then(setUsage).catch(() => setUsage(null));
  }, [user?.globalGroup, availability?.updatedAt]);

  async function testConnection() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.post<{ status: string }>(
        "/assistant/root/provider/test",
        { provider, model, secret },
      );
      setMessage(
        result.status === "VALID"
          ? t("connectionValid")
          : t("operationFailed"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider(
    path: "/assistant/root/provider" | "/assistant/root/provider/rotate",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post(path, { provider, model, secret });
      setSecret("");
      setMessage(t("saved"));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
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

  async function revoke() {
    if (!window.confirm(t("revokeConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/assistant/root/provider/revoke", {});
      setSecret("");
      setEnabled(false);
      setMessage(t("revoked"));
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
      await api.patch("/assistant/root/governance", governance);
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
              aria-checked={enabled}
              disabled={busy || !availability?.configured}
              onClick={() => void setAvailability(!enabled)}
              className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`}
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
            ] as [keyof typeof governance, string][]).map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" min={1} value={governance[key]} onChange={(e) => setGovernance((current) => ({ ...current, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>)}
          </div>
           <button type="button" disabled={busy} onClick={() => void saveGovernance()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("saveLimits")}</button>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">{t("provider")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              {t("provider")}
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                <option value="OPENAI">OpenAI</option>
                <option value="OPENROUTER">OpenRouter</option>
              </select>
            </label>
            <label className="text-sm">
              {t("model")}
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === "OPENROUTER" ? "openai/gpt-4o-mini" : undefined}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            {t("apiKey")}
            <input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t("secretPlaceholder")}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !secret}
              onClick={() => void testConnection()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {t("test")}
            </button>
            <button
              type="button"
              disabled={busy || !secret}
              onClick={() => void saveProvider("/assistant/root/provider")}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("save")}
            </button>
            <button
              type="button"
              disabled={busy || !secret}
              onClick={() =>
                void saveProvider("/assistant/root/provider/rotate")
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {t("rotate")}
            </button>
            <button
              type="button"
              disabled={busy || !availability?.configured}
              onClick={() => void revoke()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" />
              {t("revoke")}
            </button>
            {busy && (
              <Loader2
                className="h-5 w-5 animate-spin self-center text-muted-foreground"
                aria-label={t("loading")}
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
