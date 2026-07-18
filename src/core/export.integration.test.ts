import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createEmptyProject } from "./project";
import { createProjectPdf } from "./export";

const tinyPng = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
  (character) => character.charCodeAt(0),
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PDF出力のブラウザ境界", () => {
  it("AC-011/AC-012: 1ページPDFを生成し、A3横のページ寸法を維持する", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:stage-export", revokeObjectURL: () => undefined });
    vi.stubGlobal("Image", class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    });
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") throw new Error(`unexpected element: ${tagName}`);
        return {
          width: 0,
          height: 0,
          getContext: () => ({ fillStyle: "", fillRect: () => undefined, drawImage: () => undefined }),
          toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob([tinyPng], { type: "image/png" })),
        };
      },
    });

    const project = createEmptyProject("PDF受入テスト");
    project.calibration.mmPerPixel = 1;
    const blob = await createProjectPdf(project, {
      paper: "A3",
      orientation: "landscape",
      scale: "1:100",
      layers: { background: false, objects: false, labels: false, grid: false },
    });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(1);
    const page = pdf.getPage(0);
    expect(page.getWidth()).toBeCloseTo(420 * 72 / 25.4, 5);
    expect(page.getHeight()).toBeCloseTo(297 * 72 / 25.4, 5);
  });
});
