import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getLogHeaderBlock } from "../lib/logHeaderArt";
import {
  logTagPillClassSuffix,
  splitLogLine,
  tagKind,
  type TagKind,
} from "../lib/logTags";
import {
  formatToolArgsJsonForDisplay,
  isPlanEnvelopeTag,
  parsePlanResponseLine,
  parseToolLine,
} from "../lib/parseToolLine";
import {
  humanizeCombinedCopilotBody,
  humanizeLogBody,
  looksLikeJson,
  looksLikeReportIntent,
  type HumanizeJsonResult,
} from "../lib/humanizeJsonLogBody";
import { shouldOmitLogLine } from "../lib/logLineFilters";
import {
  humanizeCopilotLogSegment,
  looksLikeReportIntentCall,
  parseCopilotFunctionCall,
} from "../../shared/copilotLogFormat";
import {
  deriveRunStateForCurrentTask,
  toolCountsSummaryLine,
  type RunStateFromLog,
} from "../lib/runStateFromLog";

const HEIGHT_KEY = "ralph.logviewer.height";

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 220;
const MAX_VIEWPORT_RATIO = 0.75;
/** Pixels from bottom to count as “following” the live tail. */
const STICK_THRESHOLD_PX = 72;

function maxLogHeight(): number {
  if (typeof window === "undefined") return 600;
  return Math.max(
    MIN_HEIGHT,
    Math.floor(window.innerHeight * MAX_VIEWPORT_RATIO),
  );
}

function loadLogHeight(): number {
  if (typeof localStorage === "undefined") return DEFAULT_HEIGHT;
  const s = localStorage.getItem(HEIGHT_KEY);
  if (!s) return DEFAULT_HEIGHT;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return DEFAULT_HEIGHT;
  return Math.min(maxLogHeight(), Math.max(MIN_HEIGHT, n));
}

/** Tag pill: `[ralph]` gets a wiggling “ralph” (Ralph W. × ralph loops). */
function LogTag({ tag, kind }: { tag: string; kind: TagKind }) {
  const pillSuffix = logTagPillClassSuffix(tag, kind);
  const base = `log-line__tag log-line__tag--${pillSuffix}`;
  if (kind === "ralph") {
    return (
      <span className={base}>
        <span className="log-line__tag-ralph-bracket">[</span>
        <span className="log-line__tag-ralph-wiggum">ralph</span>
        <span className="log-line__tag-ralph-bracket">]</span>
      </span>
    );
  }
  return <span className={base}>{tag}</span>;
}

function bodyModifier(body: string, fullLine: string): string {
  if (
    /\[vibe:[^\]]+\]\s*meta:/.test(fullLine) ||
    /\[vibe\]\s*meta:/.test(fullLine) ||
    /\[olv:[^\]]+\]\s*meta:/.test(fullLine) ||
    /\[copilot(?::[^\]]+)?\]\s*meta:/.test(fullLine) ||
    body.startsWith("meta:")
  ) {
    return "log-line__body--meta";
  }
  return "";
}

type CmdVariant = "shell" | "meta" | "result" | "tool";

/** Split shell / tool lines: optional `$`, then command token, then rest as arguments. */
function parseCommandParts(text: string): {
  dollar: boolean;
  command: string;
  arguments: string;
} {
  let s = text.trim();
  let dollar = false;
  if (s.startsWith("$")) {
    dollar = true;
    s = s.slice(1).trim();
  }
  const tool = s.match(/^(read|write|edit|grep)\b\s*(.*)$/s);
  if (tool) {
    return {
      dollar,
      command: tool[1],
      arguments: tool[2]?.trim() ?? "",
    };
  }
  const m = s.match(/^(\S+)(?:\s+(.*))?$/s);
  if (m) {
    return { dollar, command: m[1], arguments: m[2]?.trim() ?? "" };
  }
  return { dollar, command: s, arguments: "" };
}

function CmdColored({
  fullText,
  variant,
}: {
  fullText: string;
  variant: CmdVariant;
}) {
  const { dollar, command, arguments: argStr } = parseCommandParts(fullText);
  return (
    <code className={`log-line__cmd-inline log-line__cmd-inline--${variant}`}>
      {dollar && (
        <>
          <span className="log-line__cmd-dollar">$</span>{" "}
        </>
      )}
      <span className={`log-line__cmd-name log-line__cmd-name--${variant}`}>
        {command}
      </span>
      {argStr
        ? (
          <span className={`log-line__cmd-args log-line__cmd-args--${variant}`}>
            {" "}
            {argStr}
          </span>
        )
        : null}
    </code>
  );
}

function toolRowModifier(verb: string, _isError: boolean): string {
  if (verb === "report_intent") {
    return "log-line__body--tool-intent";
  }
  if (verb === "list_dir" || verb === "read_file" || verb === "grep") {
    return "log-line__body--tool-scan";
  }
  if (verb === "run_command") {
    return "log-line__body--tool-exec";
  }
  if (verb === "write_file" || verb === "edit_file") {
    return "log-line__body--tool-write";
  }
  return "";
}

function toolRowAccessibleSummary(t: {
  verb: string;
  target: string;
  delta: string;
}): string {
  const path = t.target || "—";
  const d = t.delta?.trim();
  if (d) return `${t.verb} · ${path} · ${d}`;
  return `${t.verb} · ${path}`;
}

function ToolRow({ body, fullLine }: { body: string; fullLine: string }) {
  const [open, setOpen] = useState(false);
  const toolArgsLabelId = useId();
  const t = parseToolLine(body);
  if (t.kind === "opaque") {
    return <span className="log-line__body">{t.raw}</span>;
  }
  const mod = toolRowModifier(t.verb, false);
  const summary = toolRowAccessibleSummary(t);
  return (
    <div className="log-line__tool">
      <button
        type="button"
        className={`log-line__tool-cols log-line__tool-cols--btn ${mod}`.trim()}
        onClick={() => setOpen((o) => !o)}
        title={fullLine}
        aria-label={open ? `Hide tool arguments. ${summary}` : summary}
        aria-expanded={open}
      >
        <code className="log-line__tool-verb" translate="no">
          {t.verb}
        </code>
        <span className="log-line__tool-target" title={t.target} translate="no">
          {t.target || "—"}
        </span>
        <span
          className={`log-line__tool-delta${
            t.delta?.trim() ? "" : " log-line__tool-delta--empty"
          }`}
        >
          {t.delta?.trim() ? t.delta : " "}
        </span>
      </button>
      {open
        ? (
          <div className="log-line__tool-expand">
            <div className="log-line__tool-expand-label" id={toolArgsLabelId}>
              Arguments
            </div>
            <pre
              className="log-line__tool-raw"
              tabIndex={-1}
              aria-labelledby={toolArgsLabelId}
            >
              {formatToolArgsJsonForDisplay(t.argsJson)}
            </pre>
          </div>
        )
        : null}
    </div>
  );
}

function PlanResponseRow({ line }: { line: string }) {
  const [rawOpen, setRawOpen] = useState(false);
  const p = parsePlanResponseLine(line);
  if (!p) {
    return <span className="log-line__body">{line}</span>;
  }
  if (p.kind === "plan-raw") {
    const note = p.parseNote ? ` — ${p.parseNote}` : "";
    return (
      <div className="log-line__plan">
        <div className="log-line__plan-summary">
          Plan output (unparsed{note})
          <button
            type="button"
            className="log-line__plan-toggle"
            onClick={() => setRawOpen((o) => !o)}
            aria-expanded={rawOpen}
          >
            {rawOpen ? "Hide raw" : "View raw"}
          </button>
        </div>
        {rawOpen ? <pre className="log-line__plan-raw">{p.rawJson}</pre> : null}
      </div>
    );
  }
  return (
    <div className="log-line__plan">
      <div className="log-line__plan-summary">
        Plan received · {p.tasks.length} task
        {p.tasks.length === 1 ? "" : "s"}
        <button
          type="button"
          className="log-line__plan-toggle"
          onClick={() => setRawOpen((o) => !o)}
          aria-expanded={rawOpen}
        >
          {rawOpen ? "Hide raw" : "View raw"}
        </button>
      </div>
      {p.tasks.length > 0
        ? (
          <ul className="log-line__plan-list">
            {p.tasks.map((t) => (
              <li key={t.id} className="log-line__plan-item">
                <span className="log-line__plan-id">#{t.id}</span>{" "}
                <span className="log-line__plan-title">{t.title}</span>{" "}
                <span className="log-line__plan-st">[{t.status}]</span>
              </li>
            ))}
          </ul>
        )
        : null}
      {rawOpen
        ? <pre className="log-line__plan-raw" tabIndex={-1}>{p.rawJson}</pre>
        : null}
    </div>
  );
}

function formatElapsedSec(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function RunStateHeader({
  lines,
  state,
  currentTaskNum,
}: {
  lines: string[];
  state: RunStateFromLog | null;
  currentTaskNum: number;
}) {
  const started = useRef<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lines.length > 0 && !started.current) {
      started.current = Date.now();
    }
  }, [lines.length]);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!state) return null;
  const startedAt = started.current;
  const elapsed = startedAt
    ? formatElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    : "0s";
  const ph = state.phase.toUpperCase();
  const toolBreakdown = toolCountsSummaryLine(state.toolCounts);
  const statsTitle = [
    "File writes, read/scans, MCP calls (olv tool lines with __ in the name)",
    toolBreakdown ? `Per verb: ${toolBreakdown}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <div
      className={`log-viewer__run-state log-viewer__run-state--${state.phase}`}
      role="status"
      aria-live="polite"
    >
      <span className="log-viewer__run-phase" title={`Phase at this point in the log: ${ph}`}>
        {ph}
      </span>
      <div
        className="log-viewer__run-main"
        title={
          [
            state.taskLine,
            state.iter,
            currentTaskNum > 0
              ? `Current loop task #${currentTaskNum}`
              : "No active task",
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      >
        {state.taskLine
          ? <span className="log-viewer__run-task">{state.taskLine}</span>
          : null}
        {state.iter
          ? <span className="log-viewer__run-iter">{state.iter}</span>
          : null}
      </div>
      <div className="log-viewer__run-stats" title={statsTitle}>
        <span className="log-viewer__run-stat">
          <span className="log-viewer__run-stat-n">{state.writes}</span>{" "}
          <span className="log-viewer__run-stat-l">writes</span>
        </span>
        <span className="log-viewer__run-stat">
          <span className="log-viewer__run-stat-n">{state.reads}</span>{" "}
          <span className="log-viewer__run-stat-l">
            read/scan{state.reads === 1 ? "" : "s"}
          </span>
        </span>
        <span className="log-viewer__run-stat">
          <span className="log-viewer__run-stat-n">{state.mcpCalls}</span>{" "}
          <span className="log-viewer__run-stat-l">mcp</span>
        </span>
        <span
          className="log-viewer__run-elapsed"
          title="Wall time since first line in this view"
        >
          {elapsed}
        </span>
      </div>
    </div>
  );
}

/** Rich body: shell / meta lines for LLM; task banner segments for [task]. */
function renderHighlightedBody(body: string, tag: string): ReactNode {
  if (tag === "[task]") {
    return renderTaskBody(body);
  }
  if (body.startsWith("meta:")) {
    const rest = body.slice(5).trim();
    return (
      <>
        <span className="log-line__meta-label">meta</span>
        <span className="log-line__meta-colon">:</span>
        {" "}
        <CmdColored fullText={rest} variant="meta" />
      </>
    );
  }
  if (body.startsWith("→")) {
    const rest = body.slice(1).trim();
    return (
      <>
        <span className="log-line__arrow">→</span>
        {" "}
        <CmdColored fullText={rest} variant="result" />
      </>
    );
  }
  const pieces = body.split(" · ");
  return pieces.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="log-line__sep"> · </span>}
      {renderToolSegment(part)}
    </Fragment>
  ));
}

function renderToolSegment(part: string): ReactNode {
  const t = part.trim();
  if (t.startsWith("$")) {
    return <CmdColored fullText={t} variant="shell" />;
  }
  if (/^(read|write|edit|grep)\b/.test(t)) {
    return <CmdColored fullText={t} variant="tool" />;
  }
  return <span>{part}</span>;
}

function renderTaskBody(body: string): ReactNode {
  const pieces = body.split(" · ");
  const cleaned = pieces.map((seg) => seg.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const taskIdIdx = cleaned.findIndex((seg) => /^Task #\d+$/.test(seg));
  const phaseIdx = cleaned.findIndex((seg) =>
    /\b(Dev iteration|QA pass)\b/.test(seg) || /^[▶◇◆◎○✦✧※⁕⁎]/.test(seg)
  );

  const phase = phaseIdx >= 0 ? cleaned[phaseIdx] : "";
  const taskId = taskIdIdx >= 0 ? cleaned[taskIdIdx] : "";
  const title = cleaned
    .filter((_, idx) => idx !== phaseIdx && idx !== taskIdIdx)
    .join(" · ");

  if (!phase && !taskId) {
    return cleaned.map((seg, i) => (
      <Fragment key={`${seg}-${i}`}>
        {i > 0 && <span className="log-line__sep"> · </span>}
        <span className="log-line__task-title">{seg}</span>
      </Fragment>
    ));
  }

  const isQaPhase = /\bQA pass\b/.test(phase) || /^[✦✧※⁕⁎]/.test(phase);
  return (
    <span className="log-line__task-banner">
      {phase
        ? (
          <span
            className={`log-line__task-pill ${
              isQaPhase ? "log-line__task-pill--qa" : "log-line__task-pill--dev"
            }`}
          >
            {phase}
          </span>
        )
        : null}
      {taskId
        ? <span className="log-line__task-pill log-line__task-pill--id">{taskId}</span>
        : null}
      {title
        ? <span className="log-line__task-title log-line__task-title--banner">{title}</span>
        : null}
    </span>
  );
}

function computeBodyClass(
  body: string,
  fullLine: string,
  headerBlock: ReturnType<typeof getLogHeaderBlock>,
): string {
  if (!body || headerBlock) return body ? bodyModifier(body, fullLine) : "";
  return bodyModifier(body, fullLine);
}

function JsonHumanRow({ result }: { result: HumanizeJsonResult }) {
  const [rawOpen, setRawOpen] = useState(false);
  if (result.kind === "hidden") return null;
  const hasRaw = Boolean(result.rawJson);
  return (
    <div className="log-line__json-human">
      <span className="log-line__json-human-text">{result.text}</span>
      {hasRaw
        ? (
          <button
            type="button"
            className="log-line__plan-toggle"
            onClick={() => setRawOpen((o) => !o)}
            aria-expanded={rawOpen}
          >
            {rawOpen ? "Hide raw" : "View raw"}
          </button>
        )
        : null}
      {rawOpen && result.rawJson
        ? <pre className="log-line__plan-raw">{result.rawJson}</pre>
        : null}
    </div>
  );
}

function renderHumanLogBody(tag: string, body: string): ReactNode | null {
  const trimmed = body.trim();
  if (tag.startsWith("[copilot:") && body.includes(" · ")) {
    return (
      <span className="log-line__copilot-combined">
        {humanizeCombinedCopilotBody(body)}
      </span>
    );
  }
  if (
    parseCopilotFunctionCall(trimmed) ||
    looksLikeReportIntentCall(trimmed) ||
    trimmed.startsWith("→ ")
  ) {
    const h = humanizeLogBody(tag, body);
    if (!h || h.kind === "hidden") return null;
    return <JsonHumanRow result={h} />;
  }
  if (!looksLikeJson(body) && !looksLikeReportIntent(body)) return null;
  const h = humanizeLogBody(tag, body);
  if (!h || h.kind === "hidden") return null;
  return <JsonHumanRow result={h} />;
}

function shouldRichPlanRow(tag: string, _body: string): boolean {
  return isPlanEnvelopeTag(tag);
}

function shouldRichToolRow(_tag: string, body: string): boolean {
  return /^\s*tool\s+/.test(body);
}

function toolBodyClass(body: string): string {
  const t = parseToolLine(body);
  if (t.kind === "opaque") {
    return "log-line__body--tool-wrap";
  }
  return `log-line__body--tool-wrap ${toolRowModifier(t.verb, false)}`.trim();
}

type RenderLineCtx = {
  line: string;
  index: number;
  lines: string[];
};

/** Renders a single line; returns `null` when the line is omitted. */
function renderLogLineContent(ctx: RenderLineCtx): ReactNode {
  const { line, index, lines } = ctx;
  if (shouldOmitLogLine(lines, index)) return null;
  const { tag, body } = splitLogLine(line);
  const headerBlock = getLogHeaderBlock(lines, index);
  if (!tag) {
    const jsonNode = renderHumanLogBody("", line);
    if (jsonNode) return jsonNode;
    return <span className="log-line__body log-line__body--full">{line}</span>;
  }
  if (headerBlock) {
    const richPlan = shouldRichPlanRow(tag, body) &&
      parsePlanResponseLine(line) != null;
    const richTool = shouldRichToolRow(tag, body);
    const bodyNode = richPlan
      ? <PlanResponseRow line={line} />
      : richTool
      ? <ToolRow body={body} fullLine={line} />
      : body
      ? (renderHumanLogBody(tag, body) ?? renderHighlightedBody(body, tag))
      : null;
    return (
      <>
        <pre
          className={`log-line__header-art log-line__header-art--${headerBlock.channel}`}
        >
          {headerBlock.art}
        </pre>
        {bodyNode
          ? <div className="log-line__header-msg">{bodyNode}</div>
          : null}
      </>
    );
  }
  if (shouldRichPlanRow(tag, body)) {
    return <PlanResponseRow line={line} />;
  }
  if (shouldRichToolRow(tag, body)) {
    return <ToolRow body={body} fullLine={line} />;
  }
  if (body.trim().toLowerCase().startsWith("meta:")) {
    return body ? renderHighlightedBody(body, tag) : "\u00a0";
  }
  const humanNode = renderHumanLogBody(tag, body);
  if (humanNode) return humanNode;
  if (tag.startsWith("[copilot:")) {
    const seg = humanizeCopilotLogSegment(body);
    if (seg !== body) {
      return <span className="log-line__body">{seg}</span>;
    }
  }
  return body ? renderHighlightedBody(body, tag) : "\u00a0";
}

export function LogViewer({
  lines,
  currentTaskNum = 0,
  currentTaskTitle,
  onClose,
}: {
  lines: string[];
  /** Active task from the loop; drives the sticky run header. */
  currentTaskNum?: number;
  currentTaskTitle?: string;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [height, setHeight] = useState(loadLogHeight);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  const heightRef = useRef(height);
  heightRef.current = height;

  const runState = useMemo(
    () =>
      lines.length === 0
        ? null
        : deriveRunStateForCurrentTask(
            lines,
            currentTaskNum,
            currentTaskTitle,
          ),
    [lines, currentTaskNum, currentTaskTitle],
  );

  const syncStickFromScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist <= STICK_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && lines.length > 0);
  }, [lines.length]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || lines.length === 0 || !autoScroll) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines.length, autoScroll]);

  useEffect(() => {
    if (lines.length === 0) setShowJumpToLatest(false);
  }, [lines.length]);

  const jumpToLatest = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  function onAutoScrollChange(next: boolean) {
    setAutoScroll(next);
    if (next) {
      const el = bodyRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      setShowJumpToLatest(false);
    }
  }

  const stopResize = useCallback(() => {
    resizeStateRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(HEIGHT_KEY, String(heightRef.current));
      } catch {
        /* ignore quota */
      }
    }
  }, []);

  const onResizeMove = useCallback((event: PointerEvent) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const delta = state.startY - event.clientY;
    const maxHeight = Math.max(
      MIN_HEIGHT,
      Math.floor(window.innerHeight * MAX_VIEWPORT_RATIO),
    );
    const nextHeight = Math.min(
      maxHeight,
      Math.max(MIN_HEIGHT, state.startHeight + delta),
    );
    setHeight(nextHeight);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [onResizeMove, stopResize]);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: height,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  const showRunStateHeader = lines.length > 0;
  return (
    <div
      className={showRunStateHeader
        ? "log-viewer log-viewer--seamless-run-header"
        : "log-viewer"}
      style={{ height }}
    >
      <div
        className="log-viewer__resize-handle"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize output log"
      />
      <div className="log-viewer__header">
        <span className="log-viewer__title">Output Log</span>
        <span className="log-viewer__count">{lines.length} lines</span>
        <label className="log-viewer__auto-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            aria-label="Auto-scroll output log when new lines arrive"
          />
          <span>Auto-scroll</span>
        </label>
        <button
          type="button"
          className="log-viewer__close"
          onClick={onClose}
          aria-label="Close output log"
        >
          &times;
        </button>
      </div>
      <div className="log-viewer__scroll-area">
        <div
          className="log-viewer__body"
          ref={bodyRef}
          onScroll={syncStickFromScroll}
        >
          {lines.length === 0
            ? <span className="log-viewer__empty">No output yet</span>
            : (
              <>
                {showRunStateHeader && (
                  <RunStateHeader
                    lines={lines}
                    state={runState}
                    currentTaskNum={currentTaskNum}
                  />
                )}
                {lines.map((line, i) => {
                  const { tag, body } = splitLogLine(line);
                  const tKind = tagKind(tag, line);
                  const content = renderLogLineContent({
                    line,
                    index: i,
                    lines,
                  });
                  if (content === null) {
                    return null;
                  }
                  const headerBlock = getLogHeaderBlock(lines, i);
                  const bodyClass = computeBodyClass(body, line, headerBlock);
                  const showToolCols = shouldRichToolRow(tag, body);
                  const showPlanWrap = shouldRichPlanRow(tag, body) &&
                    !showToolCols;
                  const rowExtra = tKind === "error"
                    ? "log-line--row-error"
                    : tKind === "task"
                    ? "log-line--task-row"
                    : tKind === "ralph"
                    ? "log-line--ralph-row"
                    : "";
                  const rowClass = `log-line log-line--cols ${rowExtra}`.trim();
                  return (
                    <div
                      key={`${i}-${line.slice(0, 32)}`}
                      className={rowClass}
                      title={line}
                      data-log-line-index={i}
                    >
                      {tag
                        ? (
                          <>
                            <LogTag tag={tag} kind={tKind} />
                            <span
                              className={[
                                "log-line__body",
                                headerBlock ? "log-line__body--header-stack" : "",
                                showToolCols ? toolBodyClass(body) : "",
                                showPlanWrap ? "log-line__body--plan-wrap" : "",
                                bodyClass,
                              ].filter(Boolean).join(" ")}
                            >
                              {content}
                            </span>
                          </>
                        )
                        : (
                          <span className="log-line__body log-line__body--full">
                            {line}
                          </span>
                        )}
                    </div>
                  );
                }).filter((x) => x !== null)}
              </>
            )}
        </div>
        {showJumpToLatest && (
          <button
            type="button"
            className="log-viewer__jump"
            onClick={jumpToLatest}
          >
            Latest ↓
          </button>
        )}
      </div>
    </div>
  );
}
