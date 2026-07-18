import { describe, expect, it } from "vitest";
import { isPdfFile, isSupportedBackgroundFile } from "./pdf";

describe("背景ファイル入力のエラー耐性 (AC-014)", () => {
  it("PNG/JPEG/PDFと拡張子付きファイルを受け付ける", () => {
    expect(isSupportedBackgroundFile({ name: "plan.png", type: "image/png" })).toBe(true);
    expect(isSupportedBackgroundFile({ name: "plan.jpg", type: "image/jpeg" })).toBe(true);
    expect(isSupportedBackgroundFile({ name: "plan.pdf", type: "" })).toBe(true);
    expect(isPdfFile({ name: "plan.pdf", type: "" })).toBe(true);
  });

  it("未知形式を受け付けない", () => {
    expect(isSupportedBackgroundFile({ name: "plan.dwg", type: "application/octet-stream" })).toBe(false);
    expect(isPdfFile({ name: "plan.png", type: "image/png" })).toBe(false);
  });
});
