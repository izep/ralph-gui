/** Legacy loop logs used `[system]`; treat as `[ralph]` everywhere in the UI. */
export function normalizeLogTag(tag: string): string {
  return tag === "[system]" ? "[ralph]" : tag;
}

/** Split ` [tag] rest` into columns; first bracket group is the tag. */
export function splitLogLine(line: string): { tag: string; body: string } {
  const m = line.match(/^(\[[^\]]+\])\s*(.*)$/s);
  if (m) return { tag: normalizeLogTag(m[1]), body: m[2] };
  return { tag: "", body: line };
}

export type TagKind =
  | "vibe"
  | "olv"
  | "copilot"
  | "ralph"
  | "dev"
  | "task"
  | "error"
  | "default";

export function tagKind(tag: string, fullLine: string): TagKind {
  if (!tag) return "default";
  if (tag === "[ralph]") return "ralph";
  if (tag === "[dev]") return "dev";
  if (tag === "[task]") return "task";
  // Phased vibe/olv lines (incl. :stdout / :stderr) — stderr is normal progress, not "error" styling
  if (tag === "[vibe]" || tag.startsWith("[vibe:")) {
    return "vibe";
  }
  if (tag === "[olv]" || tag.startsWith("[olv:")) {
    return "olv";
  }
  if (
    tag.includes(":stderr]") ||
    tag.includes(":error]") ||
    fullLine.startsWith("[stderr]")
  ) {
    return "error";
  }
  if (tag === "[copilot]" || tag.startsWith("[copilot:")) return "copilot";
  return "default";
}

/**
 * CSS suffix for `log-line__tag--${suffix}`. Vibe phases each get their own color;
 * bare `[vibe]` uses the generic purple accent.
 */
export function logTagPillClassSuffix(tag: string, kind: TagKind): string {
  if (kind === "vibe") {
    if (tag.startsWith("[vibe:plan")) return "vibe-plan";
    if (tag.startsWith("[vibe:dev")) return "vibe-dev";
    if (tag.startsWith("[vibe:qa")) return "vibe-qa";
    return "vibe-generic";
  }
  if (kind === "olv") {
    if (tag.startsWith("[olv:plan")) return "vibe-plan";
    if (tag.startsWith("[olv:dev")) return "vibe-dev";
    if (tag.startsWith("[olv:qa")) return "vibe-qa";
    return "vibe-generic";
  }
  if (kind === "copilot") {
    if (tag.startsWith("[copilot:plan")) return "vibe-plan";
    if (tag.startsWith("[copilot:dev")) return "vibe-dev";
    if (tag.startsWith("[copilot:qa")) return "vibe-qa";
    return "copilot-generic";
  }
  return kind;
}
