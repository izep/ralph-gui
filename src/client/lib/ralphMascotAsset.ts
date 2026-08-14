import raw from "../../../assets/ralph-wiggum-ascii.txt?raw";

/** Strip optional title / ref lines at top of the asset; keep the art block. */
function ralphMascotFromRaw(file: string): string {
  const lines = file.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "") {
      i++;
      continue;
    }
    if (/^Ralph Wiggum/i.test(t)) {
      i++;
      continue;
    }
    if (/^References?:/i.test(t)) {
      i++;
      continue;
    }
    if (/^Ref:\s/i.test(t)) {
      i++;
      continue;
    }
    if (/^https?:\/\//.test(t)) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n").replace(/\n+$/, "");
}

/** Mascot lines from `assets/ralph-wiggum-ascii.txt` for `[ralph]` log rows. */
export const RALPH_MASCOT_ART = ralphMascotFromRaw(raw);
