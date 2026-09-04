import { appendFile, mkdir, writeFile } from "fs/promises";
import path from "path";

export interface RalphRunStatus {
  updatedAt: string;
  lastLog: string;
  loopStatus: string | null;
  tag: string | null;
  elapsed: string | null;
  idle: string | null;
  idleKillAfter: string | null;
}

const HEARTBEAT_RE =
  /^\[([^\]]+)\] meta: … (.+?) \(idle ([^);]+)(?:; kill after (.+?) idle)?\)$/;

export function parseAgentHeartbeat(line: string): {
  tag: string;
  elapsed: string;
  idle: string;
  idleKillAfter: string | null;
} | null {
  const m = line.match(HEARTBEAT_RE);
  if (!m) return null;
  return {
    tag: m[1]!,
    elapsed: m[2]!.trim(),
    idle: m[3]!.trim(),
    idleKillAfter: m[4]?.trim() ?? null,
  };
}

function emptyStatus(): RalphRunStatus {
  return {
    updatedAt: new Date().toISOString(),
    lastLog: "",
    loopStatus: null,
    tag: null,
    elapsed: null,
    idle: null,
    idleKillAfter: null,
  };
}

/** Persist live loop progress under `ralph/run-status.json` and `ralph/run.log`. */
export class RalphRunTracker {
  private ralphDir: string;
  private status: RalphRunStatus = emptyStatus();
  private chain: Promise<void> = Promise.resolve();

  constructor(ralphDir: string) {
    this.ralphDir = ralphDir;
  }

  setLoopStatus(status: string): void {
    this.status.loopStatus = status;
    this.status.updatedAt = new Date().toISOString();
    this.enqueue(() => this.flushStatus());
  }

  record(line: string): void {
    const now = new Date().toISOString();
    this.status.lastLog = line;
    this.status.updatedAt = now;
    const heartbeat = parseAgentHeartbeat(line);
    if (heartbeat) {
      this.status.tag = heartbeat.tag;
      this.status.elapsed = heartbeat.elapsed;
      this.status.idle = heartbeat.idle;
      this.status.idleKillAfter = heartbeat.idleKillAfter;
    } else {
      const tag = line.match(/^\[([^\]]+)\]/)?.[1];
      if (tag) this.status.tag = tag;
    }
    this.enqueue(async () => {
      await mkdir(this.ralphDir, { recursive: true });
      await appendFile(
        path.join(this.ralphDir, "run.log"),
        `${now} ${line}\n`,
        "utf-8",
      );
      await this.flushStatus();
    });
  }

  /** Wait until queued disk writes finish (tests). */
  flush(): Promise<void> {
    return this.chain;
  }

  private enqueue(fn: () => Promise<void>): void {
    this.chain = this.chain.then(fn).catch(() => undefined);
  }

  private async flushStatus(): Promise<void> {
    await mkdir(this.ralphDir, { recursive: true });
    await writeFile(
      path.join(this.ralphDir, "run-status.json"),
      JSON.stringify(this.status, null, 2),
      "utf-8",
    );
  }
}
