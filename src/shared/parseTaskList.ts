/**
 * Parse a ```json``` fenced array of task objects from model output.
 * Shared by server (task sync) and client (plan log summaries).
 */
export type ParsedTaskListItem = {
  id: number;
  title: string;
  description: string;
  status: string;
};

export function parseJsonTaskList(
  content: string,
): ParsedTaskListItem[] {
  const m = content.match(/```[Jj][Ss][Oo][Nn]\s*\n([\s\S]*?)\n```/);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]!);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const results: ParsedTaskListItem[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj["id"] !== "number" || typeof obj["title"] !== "string" || !obj["title"]) {
      continue;
    }
    results.push({
      id: obj["id"] as number,
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
