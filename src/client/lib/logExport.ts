/** Client-only Output Log export (styled HTML snapshot + raw text). */

/** Tokens + log panel rules for a self-contained offline HTML file. */
export const LOG_EXPORT_CSS = `
:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --border: #2a2d3a;
  --text: #e1e4ed;
  --text-dim: #8b8fa3;
  --text-muted: #5c5f73;
  --accent: #3b82f6;
  --amber: #f59e0b;
  --lane-backlog: #6b7280;
  --lane-in-progress: #3b82f6;
  --lane-in-qa: #f59e0b;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  padding: 16px;
}
.log-viewer__body {
  padding: 8px 16px;
  font-family: "SF Mono", "Menlo", "Monaco", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  background: var(--bg);
  max-width: 960px;
  margin: 0 auto;
}
.log-viewer__empty { color: var(--text-muted); font-style: italic; }
.log-viewer__run-state {
  --run-paper-ambient: rgba(0, 0, 0, 0.35);
  --run-bar-grad: linear-gradient(180deg, rgba(38, 40, 44) 0%, #1e2026 55%, #171a1f 100%);
  --run-bar-border-t: rgba(255, 255, 255, 0.06);
  --run-bar-border-outer: rgba(0, 0, 0, 0.32);
  --run-bar-border-bottom: rgba(0, 0, 0, 0.45);
  --run-phase-fg: color-mix(in srgb, var(--lane-backlog) 55%, white);
  --run-phase-bg: color-mix(in srgb, var(--lane-backlog) 22%, transparent);
  --run-phase-bdr: color-mix(in srgb, var(--lane-backlog) 48%, transparent);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin: 0 -16px 8px;
  padding: 8px 14px 10px;
  background: var(--run-bar-grad);
  border: 1px solid var(--run-bar-border-outer);
  border-top: 1px solid var(--run-bar-border-t);
  border-bottom: 1px solid var(--run-bar-border-bottom);
  border-radius: 0 0 6px 6px;
  font-size: 11px;
  line-height: 1.45;
  font-weight: 500;
  color: var(--text-dim);
}
.log-viewer__run-state--dev {
  --run-bar-grad: linear-gradient(180deg, rgba(24, 34, 52) 0%, rgba(20, 30, 48, 0.95) 40%, #141a24 100%);
  --run-phase-fg: color-mix(in srgb, var(--lane-in-progress) 65%, white);
  --run-phase-bg: color-mix(in srgb, var(--lane-in-progress) 20%, transparent);
  --run-phase-bdr: color-mix(in srgb, var(--lane-in-progress) 48%, transparent);
  --run-bar-border-t: color-mix(in srgb, var(--lane-in-progress) 22%, transparent);
  --run-bar-border-outer: color-mix(in srgb, var(--lane-in-progress) 45%, transparent);
}
.log-viewer__run-state--qa {
  --run-bar-grad: linear-gradient(180deg, rgba(40, 32, 20) 0%, rgba(34, 28, 18, 0.95) 45%, #1c1a14 100%);
  --run-phase-fg: color-mix(in srgb, var(--lane-in-qa) 70%, white);
  --run-phase-bg: color-mix(in srgb, var(--lane-in-qa) 18%, transparent);
  --run-phase-bdr: color-mix(in srgb, var(--lane-in-qa) 50%, transparent);
  --run-bar-border-t: color-mix(in srgb, var(--lane-in-qa) 24%, transparent);
  --run-bar-border-outer: color-mix(in srgb, var(--lane-in-qa) 42%, transparent);
}
.log-viewer__run-state--plan {
  --run-phase-fg: color-mix(in srgb, var(--lane-backlog) 55%, white);
  --run-phase-bg: color-mix(in srgb, var(--lane-backlog) 22%, transparent);
  --run-phase-bdr: color-mix(in srgb, var(--lane-backlog) 48%, transparent);
}
.log-viewer__run-phase {
  display: inline-flex; align-items: center; min-height: 22px; padding: 1px 10px;
  border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--run-phase-fg); background: var(--run-phase-bg);
  border: 1px solid var(--run-phase-bdr);
}
.log-viewer__run-main {
  display: flex; flex: 1 1 12rem; min-width: 0; flex-wrap: wrap; align-items: center;
  gap: 4px 10px; color: var(--text); font-size: 11.5px; font-weight: 500;
}
.log-viewer__run-task { color: #e2e8f0; font-weight: 600; }
.log-viewer__run-iter { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: capitalize; }
.log-viewer__run-stats {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-left: auto;
  padding: 2px 0 2px 10px; border-left: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 10.5px; color: var(--text-muted); font-variant-numeric: tabular-nums;
}
.log-viewer__run-stat-n { font-weight: 700; color: #cbd5e1; }
.log-viewer__run-stat-l { font-weight: 500; color: #64748b; }
.log-viewer__run-elapsed {
  padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10.5px;
  color: #a8b4c8; background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(100, 116, 139, 0.35);
}
.log-line { color: var(--text-dim); margin-bottom: 2px; }
.log-line--cols {
  display: grid; grid-template-columns: 5.5rem minmax(0, 1fr); column-gap: 6px; align-items: start;
}
.log-line__tag {
  grid-column: 1; grid-row: 1; padding: 1px 3px; border-radius: 3px; font-size: 9px;
  font-weight: 600; letter-spacing: 0.01em; line-height: 1.35; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.log-line__tag--vibe-plan {
  background: color-mix(in srgb, var(--lane-backlog) 20%, transparent);
  color: color-mix(in srgb, var(--lane-backlog) 55%, white);
  border: 1px solid color-mix(in srgb, var(--lane-backlog) 45%, transparent);
}
.log-line__tag--vibe-dev {
  background: color-mix(in srgb, var(--lane-in-progress) 16%, transparent);
  color: color-mix(in srgb, var(--lane-in-progress) 65%, white);
  border: 1px solid color-mix(in srgb, var(--lane-in-progress) 42%, transparent);
}
.log-line__tag--vibe-qa {
  background: color-mix(in srgb, var(--lane-in-qa) 16%, transparent);
  color: color-mix(in srgb, var(--lane-in-qa) 70%, white);
  border: 1px solid color-mix(in srgb, var(--lane-in-qa) 45%, transparent);
}
.log-line__tag--vibe-generic {
  background: rgba(167, 139, 250, 0.18); color: #ddd6fe; border: 1px solid rgba(167, 139, 250, 0.35);
}
.log-line__tag--copilot-generic {
  background: rgba(45, 212, 191, 0.14); color: #5eead4; border: 1px solid rgba(45, 212, 191, 0.3);
}
.log-line__tag--ralph {
  background: linear-gradient(145deg, rgba(250, 204, 21, 0.28), rgba(245, 158, 11, 0.18));
  color: #fde68a; border: 1px solid rgba(251, 191, 36, 0.45);
}
.log-line__tag-ralph-wiggum { font-weight: 800; color: #fef08a; }
.log-line__tag--dev {
  background: rgba(59, 130, 246, 0.16); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.38);
}
.log-line__tag--error {
  background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35);
}
.log-line__tag--default {
  background: rgba(139, 143, 163, 0.12); color: var(--text-dim); border: 1px solid var(--border);
}
.log-line__tag--task {
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.45), rgba(168, 85, 247, 0.35));
  color: #fff; font-weight: 700; border: 1px solid rgba(255, 255, 255, 0.28);
}
.log-line--task-row {
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.1), transparent);
  border-radius: 6px; padding-top: 3px; padding-bottom: 3px; margin-bottom: 4px;
}
.log-line--ralph-row { padding-top: 4px; padding-bottom: 6px; margin-bottom: 4px; }
.log-line__body--header-stack { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.log-line__header-art {
  margin: 0; padding: 6px 8px; font-size: 11px; line-height: 1.2; white-space: pre;
  font-family: "SF Mono", "Menlo", "Monaco", "Courier New", monospace; border-radius: 6px;
  background: rgba(0, 0, 0, 0.22); overflow-x: auto; color: var(--text-dim);
}
.log-line__header-art--ralph { border: 1px solid rgba(251, 191, 36, 0.22); color: #fde68a; }
.log-line__header-art--vibe-plan { border: 1px solid rgba(107, 114, 128, 0.45); color: #e5e7eb; }
.log-line__header-art--vibe-dev { border: 1px solid rgba(59, 130, 246, 0.45); color: #bfdbfe; }
.log-line__header-art--vibe-qa { border: 1px solid rgba(245, 158, 11, 0.45); color: #fde68a; }
.log-line__header-art--copilot { border: 1px solid rgba(45, 212, 191, 0.35); color: #99f6e4; }
.log-line__header-art--task { border: 1px solid rgba(251, 146, 60, 0.4); color: #f5d0fe; }
.log-line__header-art--error { border: 1px solid rgba(239, 68, 68, 0.45); color: #fecaca; }
.log-line__task-banner { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.log-line__task-pill {
  display: inline-flex; padding: 1px 8px; border-radius: 999px; font-size: 10px;
  font-weight: 700; text-transform: uppercase; border: 1px solid transparent;
}
.log-line__task-pill--dev { background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.4); color: #93c5fd; }
.log-line__task-pill--qa { background: rgba(245, 158, 11, 0.16); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24; }
.log-line__task-pill--id { background: rgba(248, 113, 113, 0.14); border-color: rgba(248, 113, 113, 0.35); color: #fecaca; }
.log-line__task-title { color: #e9d5ff; font-weight: 500; }
.log-line__task-title--banner { font-weight: 600; color: #f5d0fe; }
.log-line__meta-label, .log-line__meta-colon { color: var(--text-muted); font-weight: 600; }
.log-line__arrow { color: #94a3b8; font-weight: 700; }
.log-line__sep { color: var(--text-muted); opacity: 0.85; }
.log-line__cmd-inline {
  font-family: inherit; font-size: 11px; background: none; border: none; padding: 0;
  white-space: pre-wrap; word-break: break-word;
}
.log-line__cmd-dollar { color: #64748b; font-weight: 600; }
.log-line__cmd-name--shell { color: #fbbf24; font-weight: 600; }
.log-line__cmd-args--shell { color: #a5b4fc; }
.log-line__cmd-name--meta { color: #22d3ee; font-weight: 600; }
.log-line__cmd-args--meta { color: #bae6fd; }
.log-line__cmd-name--result { color: #cbd5e1; font-weight: 600; }
.log-line__cmd-args--result { color: #64748b; }
.log-line__cmd-name--tool { color: #60a5fa; font-weight: 600; }
.log-line__cmd-args--tool { color: #93c5fd; }
.log-line__body {
  grid-column: 2; grid-row: 1; min-width: 0; color: var(--text-dim); font-size: 12px;
  line-height: 1.5; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
}
.log-line__body--meta { color: var(--text-muted); font-size: 11px; }
.log-line__body--tool-wrap, .log-line__body--plan-wrap { min-width: 0; }
.log-line__tool { display: block; width: 100%; min-width: 0; }
.log-line__tool-cols--btn {
  display: grid;
  grid-template-columns: minmax(4.5rem, max-content) minmax(0, 1fr) minmax(3.5rem, max-content);
  gap: 6px 10px; align-items: center; width: 100%; min-width: 0; font: inherit; text-align: left;
  color: var(--text);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.2));
  border: 1px solid var(--border); border-radius: 6px; padding: 4px 7px 4px 6px; cursor: default;
}
.log-line__tool-verb {
  font-size: 10px; font-weight: 600; text-transform: lowercase;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #e2e8f0;
  background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(100, 116, 139, 0.45);
  border-radius: 4px; padding: 1px 5px;
}
.log-line__tool-target {
  font-size: 11px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #cbd5e1;
}
.log-line__tool-delta { font-size: 10px; text-align: right; color: #94a3b8; white-space: nowrap; }
.log-line__tool-delta--empty { color: rgba(148, 163, 184, 0.35); }
.log-line__tool-expand { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.log-line__tool-expand-label {
  font-size: 9px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(148, 163, 184, 0.8);
}
.log-line__tool-raw {
  margin: 0; padding: 7px 9px; max-height: 220px; overflow: auto; font-size: 10px; line-height: 1.5;
  background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(71, 85, 105, 0.45); border-radius: 5px;
  color: #cbd5e1; white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.log-line__plan { display: block; width: 100%; min-width: 0; }
.log-line__plan-summary {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 6px 10px; font-weight: 500; color: #d1d5db;
}
.log-line__plan-list { margin: 4px 0 0; padding: 0 0 0 1rem; list-style: disc; color: var(--text); }
.log-line__plan-id { color: var(--amber); font-weight: 600; }
.log-line__plan-st { color: var(--text-dim); font-size: 10px; }
.log-line__json-human { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; width: 100%; }
.log-line__json-human-text { flex: 1 1 auto; min-width: 0; color: var(--text); font-weight: 500; }
.log-line__copilot-combined { color: var(--text); font-weight: 500; }
.log-line__plan-raw {
  margin-top: 4px; max-height: 200px; overflow: auto; padding: 6px 8px; font-size: 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: #cbd5e1;
  white-space: pre-wrap; word-break: break-all;
}
.log-line__plan-toggle {
  font-size: 10px; font-weight: 600; padding: 1px 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--accent); border-radius: 4px; cursor: default; font-family: inherit;
}
.log-line__body--full {
  grid-column: 1 / -1; color: var(--text-dim); white-space: pre-wrap; border-left: none;
}
.log-line--row-error .log-line__body { color: #fecaca; }
`.trim();

const INTERACTIVE_ATTRS = new Set([
  "type",
  "aria-expanded",
  "aria-controls",
  "tabindex",
  "disabled",
]);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `ralph-log-YYYY-MM-DDTHHMMSS.{ext}` */
export function logExportFilename(ext: "html" | "txt", now = new Date()): string {
  const stamp =
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` +
    `T${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `ralph-log-${stamp}.${ext}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildRawLogText(lines: string[]): string {
  if (lines.length === 0) return "";
  return `${lines.join("\n")}\n`;
}

export function buildLogHtmlDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ralph Output Log</title>
<style>
${LOG_EXPORT_CSS}
</style>
</head>
<body>
<div class="log-viewer__body">
${bodyHtml}
</div>
</body>
</html>
`;
}

function replaceButtonWithStatic(btn: HTMLButtonElement): void {
  const isToggle = btn.classList.contains("log-line__plan-toggle");
  const replacement = document.createElement(isToggle ? "span" : "div");
  for (const attr of Array.from(btn.attributes)) {
    const name = attr.name.toLowerCase();
    if (INTERACTIVE_ATTRS.has(name) || name.startsWith("on")) continue;
    replacement.setAttribute(attr.name, attr.value);
  }
  while (btn.firstChild) {
    replacement.appendChild(btn.firstChild);
  }
  btn.replaceWith(replacement);
}

/** Make a cloned log body safe/static for offline HTML (no interactive controls). */
export function sanitizeLogBodyClone(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll(".log-line__tool-expand"))) {
    if (!el.textContent?.trim()) {
      el.remove();
    }
  }
  for (const btn of Array.from(root.querySelectorAll("button"))) {
    replaceButtonWithStatic(btn as HTMLButtonElement);
  }
}

export function exportLogAsHtml(bodyEl: HTMLElement): void {
  const clone = bodyEl.cloneNode(true) as HTMLElement;
  sanitizeLogBodyClone(clone);
  const html = buildLogHtmlDocument(clone.innerHTML);
  downloadBlob(
    logExportFilename("html"),
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
}

export function exportLogAsText(lines: string[]): void {
  const text = buildRawLogText(lines);
  downloadBlob(
    logExportFilename("txt"),
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
}
