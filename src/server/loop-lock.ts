import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

export function loopLockPath(repoRoot: string): string {
  return path.join(path.resolve(repoRoot), "ralph", "loop.lock");
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseLock(contents: string): { pid: number; ownerId: string } | null {
  const [pidRaw, ownerId] = contents.trim().split(/\s+/);
  const pid = Number(pidRaw);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  return { pid, ownerId: ownerId || "" };
}

function readLock(lockPath: string): { pid: number; ownerId: string } | null {
  try {
    return parseLock(readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function writeLock(lockPath: string, ownerId: string, flag?: "wx"): void {
  writeFileSync(lockPath, `${process.pid} ${ownerId}\n`, flag ? { flag } : undefined);
}

/** Exclusive lock so two Ralph loops cannot share one target repo. */
export function acquireRepoLoopLock(repoRoot: string, ownerId: string): void {
  const ralphDir = path.join(path.resolve(repoRoot), "ralph");
  mkdirSync(ralphDir, { recursive: true });
  const lockPath = loopLockPath(repoRoot);

  try {
    writeLock(lockPath, ownerId, "wx");
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
  }

  const existing = readLock(lockPath);
  if (existing?.pid === process.pid && existing.ownerId === ownerId) return;
  if (existing != null && pidIsAlive(existing.pid) && existing.ownerId !== ownerId) {
    throw new Error(
      `Another Ralph loop is already running for this repo (pid ${existing.pid}). Use a different --repo.`,
    );
  }

  writeLock(lockPath, ownerId);
}

export function releaseRepoLoopLock(repoRoot: string, ownerId: string): void {
  const lockPath = loopLockPath(repoRoot);
  try {
    if (!existsSync(lockPath)) return;
    const existing = readLock(lockPath);
    if (existing != null && (existing.pid !== process.pid || existing.ownerId !== ownerId)) {
      return;
    }
    unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}
