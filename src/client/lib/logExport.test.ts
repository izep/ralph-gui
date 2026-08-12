/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  LOG_EXPORT_CSS,
  buildLogHtmlDocument,
  buildRawLogText,
  logExportFilename,
  sanitizeLogBodyClone,
} from "./logExport";

describe("logExport", () => {
  it("joins raw lines with newlines and a trailing newline", () => {
    expect(buildRawLogText([])).toBe("");
    expect(buildRawLogText(["a"])).toBe("a\n");
    expect(buildRawLogText(["one", "two", "three"])).toBe("one\ntwo\nthree\n");
  });

  it("builds filenames with a compact timestamp", () => {
    const now = new Date(2026, 7, 12, 10, 5, 9);
    expect(logExportFilename("html", now)).toBe("ralph-log-2026-08-12T100509.html");
    expect(logExportFilename("txt", now)).toBe("ralph-log-2026-08-12T100509.txt");
  });

  it("wraps body HTML in a standalone document with embedded CSS", () => {
    const body = `<div class="log-line" title="raw &amp; line"><span>hello</span></div>`;
    const doc = buildLogHtmlDocument(body);
    expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(doc).toContain("<title>Ralph Output Log</title>");
    expect(doc).toContain("<style>");
    expect(doc).toContain(LOG_EXPORT_CSS);
    expect(doc).toContain("</style>");
    expect(doc).toContain('<div class="log-viewer__body">');
    expect(doc).toContain(body);
    expect(doc).toContain("</html>");
  });

  it("sanitizes buttons to static elements and drops empty expand panels", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="log-line__tool">
        <button type="button" class="log-line__tool-cols log-line__tool-cols--btn"
          title="full line" aria-expanded="false" onclick="alert(1)">
          <code class="log-line__tool-verb">read_file</code>
        </button>
        <div class="log-line__tool-expand"></div>
      </div>
      <div class="log-line__plan">
        <div class="log-line__plan-summary">
          Plan received
          <button type="button" class="log-line__plan-toggle" aria-expanded="true">Hide raw</button>
        </div>
        <pre class="log-line__plan-raw">{"ok":true}</pre>
      </div>
    `;

    sanitizeLogBodyClone(root);

    expect(root.querySelectorAll("button")).toHaveLength(0);
    expect(root.querySelector(".log-line__tool-expand")).toBeNull();

    const toolStatic = root.querySelector(".log-line__tool-cols--btn");
    expect(toolStatic?.tagName).toBe("DIV");
    expect(toolStatic?.getAttribute("title")).toBe("full line");
    expect(toolStatic?.hasAttribute("aria-expanded")).toBe(false);
    expect(toolStatic?.hasAttribute("onclick")).toBe(false);
    expect(toolStatic?.hasAttribute("type")).toBe(false);
    expect(toolStatic?.textContent).toContain("read_file");

    const toggle = root.querySelector(".log-line__plan-toggle");
    expect(toggle?.tagName).toBe("SPAN");
    expect(toggle?.textContent).toBe("Hide raw");
    expect(root.querySelector(".log-line__plan-raw")?.textContent).toBe(
      '{"ok":true}',
    );
  });

  it("keeps non-empty tool expand panels after sanitize", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="log-line__tool-expand">
        <div class="log-line__tool-expand-label">Arguments</div>
        <pre class="log-line__tool-raw">{"path":"a.ts"}</pre>
      </div>
    `;
    sanitizeLogBodyClone(root);
    expect(root.querySelector(".log-line__tool-expand")).not.toBeNull();
    expect(root.querySelector(".log-line__tool-raw")?.textContent).toBe(
      '{"path":"a.ts"}',
    );
  });
});
