import { describe, expect, it } from "vitest";
import { normalizeStageOpenTemplateSvg, STAGE_OPEN_TEMPLATE_ASSETS } from "./stageOpenTemplateSymbols";

describe("StageOpenTemplate SVG assets", () => {
  it("normalizes local references and removes source annotations", () => {
    const asset = normalizeStageOpenTemplateSvg(
      '<svg width="12mm" height="8mm" viewBox="0 0 12 8"><metadata>meta</metadata><style>.x{fill:#000000}</style><defs><symbol id="body"><path d="M0 0" /></symbol></defs><use href="#body" /><text>English</text></svg>',
      "sample",
    );

    expect(asset.viewBox).toBe("0 0 12 8");
    expect(asset.rawSvg).toContain('id="sample-body"');
    expect(asset.rawSvg).toContain('href="#sample-body"');
    expect(asset.rawSvg).not.toContain("<metadata");
    expect(asset.rawSvg).not.toContain("<style");
    expect(asset.rawSvg).not.toContain("<text");
  });

  it("loads the bundled source assets without external references", () => {
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoFull.viewBox).toBe("0 0 21.371962 15.551068");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoSemi.viewBox).toBe("0 0 21.371962 15.551068");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.timpaniSet.viewBox).toBe("0 0 22.846644 14.27731");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.riser6x6.viewBox).toBe("0 0 18.33 18.33");
    for (const asset of Object.values(STAGE_OPEN_TEMPLATE_ASSETS)) {
      expect(asset.rawSvg).not.toContain("http://");
      expect(asset.rawSvg).not.toContain("https://");
      expect(asset.rawSvg).not.toContain("<text");
    }
  });
});
