// File I/O helpers for ralph-loop integration
import { readFile, writeFile, appendFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import path from "path";

export class RalphFileManager {
  private ralphDir: string;

  constructor(ralphDir: string) {
    this.ralphDir = ralphDir;
  }

  async bootstrap(
    plan: string,
    dev: string,
    qa: string,
    memory: string,
    _epic: string,
    defaultSettings: string
  ): Promise<void> {
    await mkdir(this.ralphDir, { recursive: true });
    await this.writeIfMissing("plan-prompt.md", plan);
    await this.writeIfMissing("dev-prompt.md", dev);
    await this.writeIfMissing("qa-prompt.md", qa);
    await this.writeIfMissing("memory.md", memory);
    await this.migrateGoalsToEpic();
    await this.writeIfMissing("settings.json", defaultSettings);
  }

  private async migrateGoalsToEpic(): Promise<void> {
    const epicPath = path.join(this.ralphDir, "epic.md");
    const goalsPath = path.join(this.ralphDir, "goals.md");

    try {
      await access(epicPath, constants.R_OK);
      return;
    } catch {
      // epic.md missing, continue migration attempt.
    }

    try {
      const goals = await readFile(goalsPath, "utf-8");
      await writeFile(epicPath, goals, "utf-8");
    } catch {
      // ignore if goals.md doesn't exist
    }
  }

  private async writeIfMissing(
    name: string,
    content: string
  ): Promise<void> {
    const filePath = path.join(this.ralphDir, name);
    try {
      await access(filePath, constants.R_OK);
    } catch {
      await writeFile(filePath, content, "utf-8");
    }
  }

  private safePath(name: string): string {
    const resolved = path.resolve(this.ralphDir, name);
    if (!resolved.startsWith(this.ralphDir + path.sep) && resolved !== this.ralphDir) {
      throw new Error(`Invalid file name: ${name}`);
    }
    return resolved;
  }

  async read(name: string): Promise<string> {
    return readFile(this.safePath(name), "utf-8");
  }

  async write(name: string, content: string): Promise<void> {
    await writeFile(this.safePath(name), content, "utf-8");
  }

  async append(name: string, content: string): Promise<void> {
    await appendFile(this.safePath(name), content + "\n", "utf-8");
  }
}
