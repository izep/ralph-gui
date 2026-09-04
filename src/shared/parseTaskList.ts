/**
 * Parse a fenced or raw JSON array of task objects from model output.
 * Shared by server (task sync) and client (plan log summaries).
 */
export type ParsedTaskListItem = {
  id: number;
  title: string;
  description: string;
  status: string;
};

function stripTrailingCommas(json: string): string {
  let prev = "";
  let next = json;
  while (prev !== next) {
    prev = next;
    next = next.replace(/,\s*([}\]])/g, "$1");
  }
  return next;
}

function coerceTaskId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function tasksFromParsed(parsed: unknown): ParsedTaskListItem[] {
  if (!Array.isArray(parsed)) return [];
  const results: ParsedTaskListItem[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const id = coerceTaskId(obj["id"]);
    if (id === null || typeof obj["title"] !== "string" || !obj["title"].trim()) {
      continue;
    }
    results.push({
      id,
      title: (obj["title"] as string).trim(),
      description:
        typeof obj["description"] === "string" && obj["description"]
          ? obj["description"]
          : "",
      status:
        typeof obj["status"] === "string" && obj["status"]
          ? (obj["status"] as string)
          : "backlog",
    });
  }
  return results;
}

function tryParseJsonArray(raw: string): unknown[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidates = [trimmed, stripTrailingCommas(trimmed)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

function fencedBodies(content: string): string[] {
  const bodies: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    bodies.push(m[1] ?? "");
  }
  return bodies;
}

function rawJsonArraySlices(content: string): string[] {
  const slices: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "]") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start >= 0) {
          slices.push(content.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return slices;
}

export function parsePlanBacklog(content: string): {
  tasks: ParsedTaskListItem[];
  sawJsonArray: boolean;
} {
  if (!content) return { tasks: [], sawJsonArray: false };

  const consider = (
    raw: string,
  ): { tasks: ParsedTaskListItem[]; sawJsonArray: boolean } | null => {
    const arr = tryParseJsonArray(raw);
    if (arr === null) return null;
    return { tasks: tasksFromParsed(arr), sawJsonArray: true };
  };

  const fenced = fencedBodies(content);
  for (let i = fenced.length - 1; i >= 0; i--) {
    const hit = consider(fenced[i]!);
    if (hit) return hit;
  }

  const slices = rawJsonArraySlices(content);
  for (let i = slices.length - 1; i >= 0; i--) {
    const hit = consider(slices[i]!);
    if (hit) return hit;
  }

  return { tasks: [], sawJsonArray: false };
}

export function parseJsonTaskList(content: string): ParsedTaskListItem[] {
  return parsePlanBacklog(content).tasks;
}

/** Plan agent says the epic is done: complete tag or an empty fenced/raw JSON array. */
export function planOutputIsComplete(content: string): boolean {
  if (/<status>\s*complete\s*<\/status>/i.test(content)) return true;

  const fenced = fencedBodies(content);
  for (let i = fenced.length - 1; i >= 0; i--) {
    const arr = tryParseJsonArray(fenced[i]!);
    if (arr === null) continue;
    return arr.length === 0;
  }

  const arr = tryParseJsonArray(content.trim());
  return arr !== null && arr.length === 0;
}

/** YAML frontmatter `status: complete` on the epic file. */
export function epicFrontmatterIsComplete(epic: string): boolean {
  const m = epic.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  return /^status:\s*complete\s*$/m.test(m[1]!);
}

/** Compact a model reply for error logs. */
export function snippetForLog(text: string, max = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "(empty)";
  return t.length <= max ? t : `${t.slice(0, max)}...`;
}

export const PLAN_PARSE_RETRY_INSTRUCTION = [
  "## Parse correction",
  "Your previous response did not include a parseable task list.",
  "The loop engine writes ralph/task-status.json from this JSON; the Kanban stays empty without it.",
  "Output only a fenced JSON array of remaining backlog tasks.",
  'Each object must have numeric id, title, description, and status "backlog".',
  "Do not wrap the JSON in extra prose after the closing fence.",
  "If no epic work remains, output only <status>complete</status>.",
].join("\n");
