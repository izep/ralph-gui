// Parsing utilities for LLM output
import type { TaskEntry } from "./task-manager.js";

export interface ParsedBlockedInfo {
  summary: string;
  impact: string;
  nextStep: string;
  needs: string;
}

export function parseJsonTaskList(
  content: string
): Pick<TaskEntry, "id" | "title" | "description" | "status">[] {
  const m = content.match(/```[Jj][Ss][Oo][Nn]\s*\n([\s\S]*?)\n```/);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const results: Pick<TaskEntry, "id" | "title" | "description" | "status">[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj["id"] !== "number" || typeof obj["title"] !== "string" || !obj["title"]) continue;
    results.push({
      id: obj["id"] as number,
      title: (obj["title"] as string).trim(),
      description: typeof obj["description"] === "string" && obj["description"] ? obj["description"] : "",
      status: typeof obj["status"] === "string" && obj["status"] ? obj["status"] : "backlog",
    });
  }
  return results;
}

export function parseTaskId(content: string): number | null {
  const m = content.match(/<task-id>(\d+)<\/task-id>/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function parseTaskTitle(content: string, taskNum: number): string {
  let m = content.match(/##\s*Task:\s*(.+)/);
  if (m) return m[1].trim();
  m = content.match(/^#{1,3}\s+(.+)/m);
  if (m) return m[1].trim();
  return `Task ${taskNum}`;
}

export function parseTaskDescription(content: string): string {
  const m = content.match(/(#{1,3}\s+.+[\s\S]*)/);
  if (m) {
    const desc = m[0].trim();
    return desc.length > 2000 ? desc.slice(0, 2000) + "..." : desc;
  }
  return content.slice(0, 500).trim();
}

export function parseRemainingTasks(content: string): string[] {
  const m = content.match(/## Remaining Planned Tasks\s*\n((?:- .+\n?)+)/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/^-\s+(.+)/gm), (r) => r[1].trim());
}

function readTag(content: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = content.match(new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return m ? m[1].trim() : "";
}

export function parseBlockedInfo(content: string): ParsedBlockedInfo {
  return {
    summary: readTag(content, "blocked-summary"),
    impact: readTag(content, "blocked-impact"),
    nextStep: readTag(content, "blocked-next-step"),
    needs: readTag(content, "blocked-needs"),
  };
}

/**
 * Parse `<research-prompt>...</research-prompt>` blocks from plan output.
 * The plan agent can emit one or more of these to request parallel research
 * sub-jobs when `dockerPlanParallel` is enabled.
 */
export function parseResearchPrompts(content: string): string[] {
  const prompts: string[] = [];
  const re = /<research-prompt>([\s\S]*?)<\/research-prompt>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const p = m[1].trim();
    if (p) prompts.push(p);
  }
  return prompts;
}
