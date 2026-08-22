import { describe, expect, it } from "vitest";
import { createChairLineSession } from "./ChairLineDialog";

describe("椅子横一列配置の初期セッション", () => {
  it("各椅子の前に譜面台を配置する設定を既定で有効にする", () => {
    const session = createChairLineSession({ xMm: 1000, yMm: 2000 }, "layer-objects");

    expect(session.options.includeMusicStands).toBe(true);
  });
});
