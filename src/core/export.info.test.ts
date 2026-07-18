import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import { renderPdfInfoSvg } from "./export";

describe("PDF出力情報欄", () => {
  it("日本語のタイトル・ホール名・公演名・備考を欄外SVGへ保持する", () => {
    const project = createEmptyProject("春季演奏会");
    project.metadata = {
      hallName: "市民ホール",
      performanceName: "交響曲第九番",
      date: "2026-07-18",
      author: "舞台担当",
      notes: "倍率100%で印刷",
    };
    const svg = renderPdfInfoSvg(project, "1:100", 100);
    expect(svg).toContain("春季演奏会");
    expect(svg).toContain("市民ホール");
    expect(svg).toContain("交響曲第九番");
    expect(svg).toContain("倍率100%");
  });
});
