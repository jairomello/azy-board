import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { useAssistant } from "../contexts/AssistantContext";
import { MarkdownText } from "./MarkdownText";
import { notifyAssistantMutation } from "../lib/dataEvents";

interface Conversation {
  id: string;
  projectId: string | null;
  title: string | null;
  updatedAt: string;
}
interface ConversationDetail extends Conversation {
  messages: Message[];
}
interface Message {
  id: string;
  role: string;
  content: string;
  metadata?: { runId?: string; sources?: string[] };
}
interface Run {
  id: string;
  status: string;
  cursor: number;
  errorCode?: string | null;
  tools?: { toolName: string; displayName?: string; status: string; resultSummary?: string | null }[];
  approval?: {
    operationHash: string;
    preview: { summary?: string; markdown?: string; fields?: unknown[][]; diff?: Record<string, unknown> };
    expiresAt: string;
  } | null;
}

const CLIENT_RUN_TIMEOUT_MS = 180_000;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_MESSAGE_BYTES = 30_000;

function friendlyRunError(error: string | null | undefined, t: (key: string) => string): string {
  if (!error) return t("runFailed");
  const messages: Record<string, string> = {
    STEP_LIMIT: t("stepLimit"),
    TOOL_CALL_LIMIT: t("toolCallLimit"),
    TOKEN_LIMIT: t("tokenLimit"),
    TIMEOUT: t("runTimeout"),
    ACTION_LIMIT: t("actionLimit"),
    REPEATED_TOOL_CALL: t("repeatedToolCall"),
  };
  return messages[error] ?? error;
}

export function AzyAgentDrawer() {
  const { t } = useTranslation("assistant");
  const { availability, pageContext } = useAssistant();
  const projectId = pageContext?.projectId;
  const itemId = pageContext?.item?.id;
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [decisionPending, setDecisionPending] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reconcilingRunsRef = useRef(new Set<string>());
  const available = Boolean(availability?.enabled && availability.configured);
  const reconcileTerminalRun = useCallback(async (conversationId: string, runId: string) => {
    if (reconcilingRunsRef.current.has(runId)) return;
    reconcilingRunsRef.current.add(runId);
    let latest: ConversationDetail | undefined;
    try {
      for (const delay of [0, 100, 300]) {
        if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
        latest = await api.get<ConversationDetail>(`/assistant/conversations/${conversationId}`);
        if (latest.messages.some(message => message.role === "ASSISTANT" && message.metadata?.runId === runId)) {
          setMessages(latest.messages);
          return;
        }
      }
      setMessages(current => {
        const streamed = current.find(message => message.id === `stream-${runId}`);
        const fallback: Message = streamed ?? { id: `terminal-${runId}`, role: "ASSISTANT", content: t("completedWithoutMessage") };
        const persisted = latest?.messages ?? current.filter(message => !message.id.startsWith("local-"));
        return persisted.some(message => message.id === fallback.id) ? persisted : [...persisted, fallback];
      });
    } catch {
      setMessages(current => current.some(message => message.id === `stream-${runId}` || message.id === `terminal-${runId}`)
        ? current
        : [...current, { id: `terminal-${runId}`, role: "ASSISTANT", content: t("completedWithoutMessage") }]);
    } finally {
      reconcilingRunsRef.current.delete(runId);
    }
  }, [t]);
  useEffect(() => {
    if (!conversation || conversation.projectId === (projectId ?? null)) return;
    setConversation(null);
    setMessages([]);
    setRun(null);
    setError("");
  }, [conversation, projectId]);
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      panelRef.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    const runId = run?.id;
    if (
      !runId ||
      ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(run.status)
    )
      return;
    const base = (
      (window as unknown as { __BASE_PATH__?: string }).__BASE_PATH__ ?? ""
    ).replace(/\/+$/, "");
    const source = new EventSource(
      `${base}/api/assistant/runs/${runId}/events?cursor=${run.cursor ?? 0}`,
    );
    const handler = (event: MessageEvent) => {
      let data: {
        cursor?: number;
        text?: string;
        question?: string;
        tool?: string;
        error?: string;
      } = {};
      try {
        data = JSON.parse(event.data) as typeof data;
      } catch {
        setError(t("runFailed"));
        return;
      }
      const terminalStatus = event.type === "RUN_COMPLETED"
        ? "COMPLETED"
        : event.type === "RUN_FAILED"
          ? "FAILED"
          : event.type === "RUN_CANCELLED"
            ? "CANCELLED"
            : event.type === "RUN_EXPIRED"
              ? "EXPIRED"
              : event.type === "APPROVAL_REQUIRED"
                ? "WAITING_APPROVAL"
                : event.type === "QUESTION"
                  ? "WAITING_USER"
                  : undefined;
      setRun((current) =>
        current
          ? {
              ...current,
              cursor: data.cursor ?? current.cursor,
              status: terminalStatus ?? current.status,
            }
          : current,
      );
      if (event.type === "TEXT_DELTA" && data.text)
        setMessages((current) => [
          ...current.filter((item) => item.id !== `stream-${runId}`),
          {
            id: `stream-${runId}`,
            role: "ASSISTANT",
            content:
              (current.find((item) => item.id === `stream-${runId}`)?.content ??
                "") + (data.text ?? ""),
          },
        ]);
      if (event.type === "QUESTION" && data.question)
        setMessages((current) => [
          ...current.filter((item) => item.id !== `question-${runId}`),
          {
            id: `question-${runId}`,
            role: "SYSTEM",
            content: data.question ?? "",
          },
        ]);
      if (
        event.type === "APPROVAL_REQUIRED" ||
        event.type === "TOOL_STARTED" ||
        event.type === "TOOL_COMPLETED"
      )
        void api
          .get<Run>(`/assistant/runs/${runId}`)
          .then(setRun)
          .catch(() => {});
      if (event.type === "RUN_FAILED" || event.type === "RUN_EXPIRED")
        setError(friendlyRunError(data.error, t));
      if (event.type === "RUN_COMPLETED" && conversation)
        void reconcileTerminalRun(conversation.id, runId);
    };
    source.addEventListener("TEXT_DELTA", handler);
    source.addEventListener("QUESTION", handler);
    source.addEventListener("APPROVAL_REQUIRED", handler);
    source.addEventListener("TOOL_STARTED", handler);
    source.addEventListener("TOOL_COMPLETED", handler);
      source.addEventListener("RUN_COMPLETED", handler);
      source.addEventListener("RUN_FAILED", handler);
    source.addEventListener("RUN_CANCELLED", handler);
    source.addEventListener("RUN_EXPIRED", handler);
    source.onerror = () => {
      void api
        .get<Run>(`/assistant/runs/${runId}`)
        .then((latest) => {
          setRun(latest);
          if (["FAILED", "EXPIRED"].includes(latest.status)) {
            setError(friendlyRunError(latest.errorCode, t));
          } else if (latest.status === "COMPLETED" && conversation) {
            void reconcileTerminalRun(conversation.id, runId);
          }
        })
        .catch(() => setError(t("runFailed")));
    };
    return () => source.close();
  }, [conversation, reconcileTerminalRun, run?.id, run?.status, run?.cursor, t]);
  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, run?.status, error]);
  useEffect(() => {
    if (!run || !["QUEUED", "RUNNING"].includes(run.status)) return;
    const runId = run.id;
    const timer = window.setTimeout(() => {
      setRun((current) =>
        current?.id === runId ? { ...current, status: "EXPIRED" } : current,
      );
      setError(t("runFailed"));
      void api.post(`/assistant/runs/${runId}/cancel`, {}).catch(() => {});
    }, CLIENT_RUN_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [run?.id, run?.status, t]);
  async function ensureConversation() {
    if (conversation?.projectId === (projectId ?? null)) return conversation;
    const created = await api.post<Conversation>("/assistant/conversations", {
      projectId,
    });
    setConversation(created);
    return created;
  }
  function openDrawer() {
    setOpen(true);
  }
  async function send() {
    if (!input.trim()) return;
    if (new TextEncoder().encode(input).byteLength > MAX_MESSAGE_BYTES) {
      setError(t("messageTooLong"));
      return;
    }
    setError("");
    const text = input;
    setInput("");
    if (run?.status === "WAITING_APPROVAL" && run.approval) {
      if (/^(sim|s|yes|confirmo|confirmar|ok)$/i.test(text.trim())) {
        await decision(true);
      } else if (/^(não|nao|n|no|cancelo|cancelar)$/i.test(text.trim())) {
        await decision(false);
      } else {
        await adjust(text);
      }
      return;
    }
    setMessages((items) => [
      ...items,
      { id: `local-${Date.now()}`, role: "USER", content: text },
    ]);
    try {
      if (run?.status === "WAITING_USER") {
        await api.post(`/assistant/runs/${run.id}/question`, { answer: text });
        setRun({ ...run, status: "QUEUED" });
        return;
      }
      const current = await ensureConversation();
      const result = await api.post<{ runId: string; status: string }>(
        `/assistant/conversations/${current.id}/messages`,
        { content: text, projectId: projectId ?? null, itemId: itemId ?? null },
      );
      setRun({ id: result.runId, status: result.status, cursor: 0 });
    } catch (e) {
      if (e instanceof ApiError) {
        const messages: Record<string, string> = {
          RATE_LIMITED: t("rateLimit"),
          CONCURRENCY_LIMIT: t("concurrencyLimit"),
          QUOTA_EXCEEDED: t("quotaExceeded"),
          ASSISTANT_UNAVAILABLE: t("assistantUnavailable"),
        }
        setError(e.code && messages[e.code] ? messages[e.code] : e.message)
      } else {
        setError(e instanceof Error ? e.message : t("runFailed"))
      }
      setInput(text);
    }
  }
  async function decision(approved: boolean) {
    if (!run?.approval) return;
    setDecisionPending(true);
    setError("");
    try {
      await api.post(`/assistant/runs/${run.id}/approval`, {
        approved,
        operationHash: run.approval.operationHash,
      });
      const latest = await api.get<Run>(`/assistant/runs/${run.id}`);
      setRun(latest);
      if (latest.status === "FAILED") {
        setError(friendlyRunError(latest.errorCode, t));
      } else if (latest.status === "COMPLETED" && conversation) {
        for (const tool of latest.tools ?? []) {
          if (tool.status !== "COMPLETED") continue;
          let result: unknown = tool.resultSummary;
          try {
            result = tool.resultSummary ? JSON.parse(tool.resultSummary) : undefined;
          } catch {
            // Resultados escalares permanecem como texto.
          }
          notifyAssistantMutation({ toolName: tool.toolName, result });
        }
        await reconcileTerminalRun(conversation.id, run.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("runFailed"));
    } finally {
      setDecisionPending(false);
    }
  }
  async function adjust(instruction: string) {
    if (!run?.approval || !instruction.trim()) return;
    setDecisionPending(true);
    setError("");
    setMessages((items) => [
      ...items,
      { id: `local-adjust-${Date.now()}`, role: "USER", content: instruction },
    ]);
    try {
      const result = await api.post<{ runId: string; status: string }>(
        `/assistant/runs/${run.id}/adjust`,
        { instruction, operationHash: run.approval.operationHash, projectId: projectId ?? null, itemId: itemId ?? null },
      );
      setRun({ id: result.runId, status: result.status, cursor: 0 });
      setAdjusting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("runFailed"));
      setInput(instruction);
    } finally {
      setDecisionPending(false);
    }
  }
  function previewMarkdown(preview: NonNullable<Run["approval"]>["preview"]) {
    if (preview.markdown) return preview.markdown;
    const fields = preview.fields ?? Object.entries(preview.diff ?? {});
    return `### ${preview.summary ?? t("approval")}\n\n${fields.map(([label, value]) => `- **${String(label)}:** ${String(value ?? t("empty"))}`).join("\n")}`;
  }
  if (!available) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t("open")}
        onClick={openDrawer}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl hover:bg-primary/90"
      >
        <Bot className="h-5 w-5" />
        {t("name")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <button
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="azy-agent-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl outline-none"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2
                  id="azy-agent-title"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Bot className="h-5 w-5 text-primary" />
                  {t("name")}
                </h2>
                {pageContext?.projectName ? (
                  <nav aria-label={t("contextBreadcrumb")} className="max-w-[19rem] overflow-hidden text-xs text-muted-foreground">
                    <ol className="flex min-w-0 items-center gap-1">
                      {[{ id: projectId ?? "project", title: pageContext.projectName }, ...(pageContext.item?.ancestry ?? []), ...(pageContext.item ? [pageContext.item] : [])].map((node, index) => (
                        <li key={node.id} className="flex min-w-0 items-center gap-1">
                          {index > 0 && <span aria-hidden>›</span>}
                          <span className="truncate" title={node.title}>{node.title}</span>
                        </li>
                      ))}
                    </ol>
                  </nav>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("noProject")}</p>
                )}
              </div>
              <button
                type="button"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div
                  ref={messagesRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
                  aria-live="polite"
                >
                  {messages.length === 0 && (
                    <p className="mt-10 text-center text-sm text-muted-foreground">
                      {t("welcome")}
                    </p>
                  )}
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl p-3 text-sm ${item.role === "USER" ? "ml-7 bg-primary text-primary-foreground" : "mr-3 bg-muted text-foreground"}`}
                    >
                       <MarkdownText content={item.content} />
                      {item.metadata?.sources?.length ? (
                        <p className="mt-2 border-t border-border/50 pt-2 text-xs opacity-75">
                          {t("sources")}: {item.metadata.sources.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {run &&
                    !["WAITING_APPROVAL", "COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(
                      run.status,
                    ) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {run.status === "WAITING_USER"
                          ? t("answerQuestion")
                          : t("working")}
                        {run.tools?.map((tool, index) => (
                          <span
                            key={`${tool.toolName}-${index}`}
                            className="rounded bg-muted px-1"
                          >
                            {tool.displayName ?? tool.toolName.replace(/_/g, " ")}: {tool.status}
                          </span>
                        ))}
                      </div>
                    )}
                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 p-2 text-xs text-red-700"
                    >
                      {error}{" "}
                      <button
                        className="font-semibold underline"
                        onClick={() => setError("")}
                      >
                        {t("retry")}
                      </button>
                    </p>
                  )}
                  {run?.approval && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950">
                      <p className="font-semibold">{t("approval")}</p>
                      <div className="my-3 rounded-md bg-white/60 p-3 dark:bg-black/20">
                        <MarkdownText content={previewMarkdown(run.approval.preview)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void decision(true)}
                          disabled={decisionPending}
                          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                        >
                          {decisionPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          {decisionPending ? t("processing") : t("approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void decision(false)}
                          disabled={decisionPending}
                          className="rounded border border-border px-2 py-1 text-xs"
                        >
                          {t("reject")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjusting(true);
                            window.setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                          disabled={decisionPending}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
                        >
                          <Pencil className="h-3 w-3" />
                          {t("adjust")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-border p-3">
                  <label htmlFor="azy-agent-input" className="sr-only">
                    {t("inputLabel")}
                  </label>
                  <textarea
                    id="azy-agent-input"
                    ref={inputRef}
                    value={input}
                    maxLength={MAX_MESSAGE_CHARS}
                    onChange={(e) => {
                      setInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={adjusting ? t("adjustPlaceholder") : t("placeholder")}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new TextEncoder().encode(input).byteLength.toLocaleString()} / {MAX_MESSAGE_BYTES.toLocaleString()} bytes
                    </span>
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      aria-label={t("send")}
                      className="rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
