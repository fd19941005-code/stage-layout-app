import { describe, expect, it } from "vitest";
import { normalizeStageOpenTemplateSvg, STAGE_OPEN_TEMPLATE_ASSETS } from "./stageOpenTemplateSymbols";
import { SMALL_PERCUSSION_SVG_SOURCES } from "../assets/stage-open-template/smallPercussionSources";

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
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoFull.viewBox).toBe("0 0 16.406787 28.272829");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoFull.rawSvg).toContain("matrix(0 1 -1 0");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoSemi.viewBox).toBe("0 0 15.551068 21.371962");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.grandPianoSemi.rawSvg).toContain("matrix(0 1 -1 0");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.riser6x6.viewBox).toBe("0 0 18.33 18.33");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.glockenspiel.id).toBe("stage-open-template/glockenspiel-concert-provisional");
    expect(STAGE_OPEN_TEMPLATE_ASSETS.glockenspiel.rawSvg).not.toBe(STAGE_OPEN_TEMPLATE_ASSETS.xylophone.rawSvg);
    for (const asset of [STAGE_OPEN_TEMPLATE_ASSETS.marimba, STAGE_OPEN_TEMPLATE_ASSETS.vibraphone, STAGE_OPEN_TEMPLATE_ASSETS.xylophone, STAGE_OPEN_TEMPLATE_ASSETS.glockenspiel]) {
      expect(asset.rawSvg).toContain("right-edge-repair");
    }
    expect(STAGE_OPEN_TEMPLATE_ASSETS.glockenspiel.rawSvg).toContain("bottom-edge-repair");
    for (const asset of Object.values(STAGE_OPEN_TEMPLATE_ASSETS)) {
      expect(asset.rawSvg).not.toContain("http://");
      expect(asset.rawSvg).not.toContain("https://");
      expect(asset.rawSvg).not.toContain("<text");
    }
  });
  it("pads only the display viewBox for clipped small percussion lines", () => {
    const derived = [
      [STAGE_OPEN_TEMPLATE_ASSETS.snareA, SMALL_PERCUSSION_SVG_SOURCES.snareA, "-0.3 -0.3 4.6639968 4.8134269"],
      [STAGE_OPEN_TEMPLATE_ASSETS.snareB, SMALL_PERCUSSION_SVG_SOURCES.snareB, "-0.3 -0.3 3.6594335 3.8013546"],
      [STAGE_OPEN_TEMPLATE_ASSETS.suspendedCymbalAG, SMALL_PERCUSSION_SVG_SOURCES.suspendedCymbalAG, "-0.3 -0.3 4.6639968 4.6639968"],
      [STAGE_OPEN_TEMPLATE_ASSETS.suspendedCymbalAW, SMALL_PERCUSSION_SVG_SOURCES.suspendedCymbalAW, "-0.3 -0.3 4.6639968 4.6639968"],
      [STAGE_OPEN_TEMPLATE_ASSETS.bongoA, SMALL_PERCUSSION_SVG_SOURCES.bongoA, "-0.3 -0.3 4.1742466 2.5574797"],
      [STAGE_OPEN_TEMPLATE_ASSETS.bongoB, SMALL_PERCUSSION_SVG_SOURCES.bongoB, "-0.3 -0.3 4.5877336 2.6403526"],
    ] as const;

    for (const [asset, source, displayViewBox] of derived) {
      expect(asset.viewBox).toBe(displayViewBox);
      expect(source).toContain('viewBox="0 0 ');
      expect(asset.rawSvg).toContain("<g");
    }
    expect(STAGE_OPEN_TEMPLATE_ASSETS.crashCymbalPair.viewBox).toBe("0 0 3.9981215 5.0560868");
  });

});
