/**
 * 楽器・舞台配置シンボルの資産台帳。
 *
 * SVGのviewBoxや画面上の描画サイズは物理寸法の正本ではないため、
 * 原本対応・variant分類・利用範囲だけをここで管理する。寸法は
 * instrumentCatalog.ts、配置値はSceneObjectのmmフィールドを正本とする。
 */

import { CHAIR_MUSIC_STAND_SET_PRESET_ID } from "./presets";

export type VariantKind = "visual" | "projection" | "preset";
export type AssetUsage = "plan" | "legend-only";

export type DimensionBasis =
  | "yamaha-reference"
  | "official-model-reference"
  | "nominal-size-plus-small-margin"
  | "representative-layout"
  | "user-defined";

export type DimensionStatus =
  | "verified-reference"
  | "representative"
  | "provisional"
  | "user-defined";

export type RenderMode =
  | "svg-preserve-aspect"
  | "parametric-circle"
  | "parametric-bass-drum"
  | "fixed-group-preset"
  | "resizable-generic";

export interface ContentBox {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

/** 物理寸法を持たない、原本または生成描画資産のメタデータ。 */
export interface SymbolAsset {
  id: string;
  label: string;
  sourcePath: string;

  variantKind: VariantKind;
  usage: AssetUsage;
  planEnabled: boolean;

  contentBox?: ContentBox;
  defaultRotationDeg: number;
  anchorXRatio: number;
  anchorYRatio: number;

  sourceFileName?: string;
  sourceHash?: string;
  derivedFromAssetId?: string;
  note?: string;
}

/** 既存のraw importをstableなassetIdへ結び付ける内部対応情報。 */
type RuntimeSymbolAsset = SymbolAsset & {
  runtimeKey?: string;
};

function svgAsset(
  id: string,
  label: string,
  sourcePath: string,
  sourceFileName: string,
  variantKind: VariantKind,
  runtimeKey?: string,
  options: Pick<SymbolAsset, "usage" | "planEnabled" | "derivedFromAssetId" | "note"> = { usage: "plan", planEnabled: true },
): RuntimeSymbolAsset {
  return {
    id,
    label,
    sourcePath,
    sourceFileName,
    variantKind,
    usage: options.usage,
    planEnabled: options.planEnabled,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    ...(runtimeKey === undefined ? {} : { runtimeKey }),
    ...(options.derivedFromAssetId === undefined ? {} : { derivedFromAssetId: options.derivedFromAssetId }),
    ...(options.note === undefined ? {} : { note: options.note }),
  };
}

const repositorySymbolAssets: readonly RuntimeSymbolAsset[] = [
  svgAsset("stage-open-template/amp-speaker-a", "アンプA", "src/assets/stage-open-template/amp-speaker.svg", "楽器アンプA.svg", "visual", "ampSpeaker"),
  svgAsset("stage-open-template/bass-drum-a", "バスドラムA", "src/assets/stage-open-template/bass-drum.svg", "バスドラムA.svg", "visual", "bassDrum"),
  svgAsset("stage-open-template/celesta-a", "チェレスタ等鍵盤楽器", "src/assets/stage-open-template/celesta.svg", "アップライトピアノ・チェレスタ等鍵盤楽器.svg", "visual", "celesta"),
  svgAsset("stage-open-template/chair-a", "椅子A", "src/assets/stage-open-template/chair.svg", "椅子A上.svg", "preset", "chair"),
  svgAsset("stage-open-template/chair-back-e", "椅子E", "src/assets/stage-open-template/chair-back.svg", "椅子E上.svg", "preset", "chairBack"),
  svgAsset("stage-open-template/chimes-a", "コンサートチャイムA", "src/assets/stage-open-template/chimes.svg", "チューブラーベル・コンサートチャイムA.svg", "visual", "chimes"),
  svgAsset("stage-open-template/snare-drum-a", "スネアドラムA", "src/assets/stage-open-template/smallPercussionSources.ts", "スネアドラムA.svg", "visual", "snareDrum"),
  svgAsset("stage-open-template/snare-drum-b", "スネアドラムB", "src/assets/stage-open-template/smallPercussionSources.ts", "スネアドラムB.svg", "visual"),
  svgAsset("stage-open-template/suspended-cymbal-ag", "サスペンデッドシンバルAG", "src/assets/stage-open-template/smallPercussionSources.ts", "シンバル・サスペンデッドAG.svg", "visual", "suspendedCymbal"),
  svgAsset("stage-open-template/suspended-cymbal-aw", "サスペンデッドシンバルAW", "src/assets/stage-open-template/smallPercussionSources.ts", "シンバル・サスペンデッドAW.svg", "visual"),
  svgAsset("stage-open-template/crash-cymbal-pair", "クラッシュシンバル一対", "src/assets/stage-open-template/smallPercussionSources.ts", "シンバル・クラッシュ.svg", "preset", "crashCymbalPair"),
  svgAsset("stage-open-template/gong-tam-tam-ag", "銅鑼／タムタムAG", "src/assets/stage-open-template/gong-tam-tam-ag.svg", "ドラ・タムタムAG.svg", "visual", "gongTamTamAG"),
  svgAsset("stage-open-template/gong-tam-tam-aw", "銅鑼／タムタムAW", "src/assets/stage-open-template/gong-tam-tam-aw.svg", "ドラ・タムタムAW.svg", "visual"),
  svgAsset("stage-open-template/conga-2-ag", "コンガ（2本）AG", "src/assets/stage-open-template/smallPercussionSources.ts", "コンガAG.svg", "visual", "conga2"),
  svgAsset("stage-open-template/conga-2-aw", "コンガ（2本）AW", "src/assets/stage-open-template/smallPercussionSources.ts", "コンガAW.svg", "visual"),
  svgAsset("stage-open-template/conga-2-b", "コンガ（2本）B", "src/assets/stage-open-template/smallPercussionSources.ts", "コンガB.svg", "visual"),
  svgAsset("stage-open-template/bongo-a", "ボンゴA", "src/assets/stage-open-template/smallPercussionSources.ts", "ボンゴA.svg", "visual", "bongo"),
  svgAsset("stage-open-template/bongo-b", "ボンゴB", "src/assets/stage-open-template/smallPercussionSources.ts", "ボンゴB.svg", "visual"),
  svgAsset("stage-open-template/wind-chime", "ウィンドチャイム", "src/assets/stage-open-template/smallPercussionSources.ts", "ウィンドチャイム.svg", "preset", "windChime"),
  svgAsset("stage-open-template/conductor-stand-big-band", "ビッグバンド用譜面台", "src/assets/stage-open-template/conductor-stand.svg", "譜面台ビッグバンド.svg", "preset", "conductorStand"),
  svgAsset("stage-open-template/contrabass-b", "コントラバスB", "src/assets/stage-open-template/contrabass.svg", "コントラバスB.svg", "visual", "contrabass", { usage: "plan", planEnabled: true, note: "正面図との区別は原本確認後に確定する。" }),
  svgAsset("stage-open-template/drum-set-a", "ドラムセットA", "src/assets/stage-open-template/drum-set.svg", "ドラムセットA.svg", "visual", "drumSet"),
  svgAsset("stage-open-template/grand-piano-a", "グランドピアノA", "src/assets/stage-open-template/grand-piano.svg", "グランドピアノA.svg", "visual", undefined, { usage: "legend-only", planEnabled: false, note: "現行runtimeでは未使用の原本別名。" }),
  svgAsset("stage-open-template/grand-piano-full-ab", "グランドピアノAB（旧割当）", "src/assets/stage-open-template/grand-piano-full.svg", "グランドピアノAB.svg", "preset", undefined, { usage: "legend-only", planEnabled: false, note: "旧JSON互換のため保持。現行配置には使用しない。" }),
  svgAsset("stage-open-template/grand-piano-semi-a", "グランドピアノA（旧割当）", "src/assets/stage-open-template/grand-piano-semi.svg", "グランドピアノA.svg", "preset", undefined, { usage: "legend-only", planEnabled: false, note: "旧JSON互換のため保持。現行配置には使用しない。" }),
  svgAsset("stage-open-template/grand-piano-d", "グランドピアノD", "src/assets/stage-open-template/grand-piano-d.svg", "グランドピアノD.svg", "preset", "grandPianoFull", { usage: "plan", planEnabled: true, note: "フルコンサートグランドの固定原本。" }),
  svgAsset("stage-open-template/grand-piano-bb", "グランドピアノBB", "src/assets/stage-open-template/grand-piano-bb.svg", "グランドピアノBB.svg", "preset", "grandPianoSemi", { usage: "plan", planEnabled: true, note: "セミグランドの固定原本。" }),
  svgAsset("stage-open-template/hakouma-a", "箱馬A", "src/assets/stage-open-template/hakouma.svg", "箱馬A上1尺x6寸.svg", "preset", "hakouma"),
  svgAsset("stage-open-template/harp-a", "ハープA", "src/assets/stage-open-template/harp.svg", "ハープA.svg", "visual", "harp"),
  svgAsset("stage-open-template/lectern-c", "演台C", "src/assets/stage-open-template/lectern.svg", "譜面台C.svg", "preset", "lectern"),
  svgAsset("stage-open-template/marimba-a", "マリンバA", "src/assets/stage-open-template/marimba-a-derived.svg", "マリンバA_右端補完派生.svg", "visual", "marimba", { usage: "plan", planEnabled: true, note: "マリンバA原本を保持し、右端の欠けだけを補完した派生SVG。Bは未変更。" }),
  svgAsset("stage-open-template/marimba-b", "マリンバB", "src/assets/stage-open-template/marimba-b.svg", "マリンバB.svg", "visual", undefined, { usage: "plan", planEnabled: true, note: "指定配布元のマリンバB.svgを使用する。" }),
  svgAsset("stage-open-template/marimba-4oct-a", "マリンバ（4オクターブ）A", "src/assets/stage-open-template/marimba-4oct-a.svg", "マリンバA_4オクターブ派生.svg", "visual", "marimba4Oct", {
    usage: "plan",
    planEnabled: true,
    derivedFromAssetId: "stage-open-template/marimba-a",
    note: "マリンバAの作図スケールと高音側端部を保ち、全長と低音側端部だけを4オクターブ寸法へ合わせた派生SVG。",
  }),
  svgAsset("stage-open-template/music-stand-a", "譜面台A", "src/assets/stage-open-template/music-stand.svg", "譜面台A.svg", "preset", "musicStand"),
  svgAsset("stage-open-template/piano-bench-backless", "ピアノ椅子（背なし）", "src/assets/stage-open-template/piano-bench.svg", "ピアノ椅子背なし.svg", "preset", "pianoBench"),
  svgAsset("stage-open-template/platform-3x3", "平台3x3", "src/assets/stage-open-template/podium.svg", "平台3x3.svg", "preset", "podium"),
  svgAsset("stage-open-template/platform-3x6", "平台3x6", "src/assets/stage-open-template/riser-3x6.svg", "平台3x6.svg", "preset", "riser3x6"),
  svgAsset("stage-open-template/platform-4x6", "平台4x6", "src/assets/stage-open-template/riser-4x6.svg", "平台4x6.svg", "preset", "riser4x6"),
  svgAsset("stage-open-template/platform-6x6", "平台6x6", "src/assets/stage-open-template/riser-6x6.svg", "平台6x6.svg", "preset", "riser6x6"),
  svgAsset("stage-open-template/table-percussion", "小物置き・パーカッションテーブル", "src/assets/stage-open-template/table.svg", "小物置き・パーカッションテーブル.svg", "preset", "table"),
  svgAsset("stage-open-template/timpani-ag", "ティンパニAG原本", "src/assets/stage-open-template/timpani.svg", "ティンパニAG.svg", "preset", undefined, { usage: "legend-only", planEnabled: false, note: "本体描画には使用せず、レイアウト参照に限定する。" }),
  svgAsset("stage-open-template/timpani-set-ag-reference", "ティンパニセットAG参照", "src/assets/stage-open-template/timpani-set.svg", "ティンパニAG.svg", "preset", undefined, { usage: "legend-only", planEnabled: false, note: "ティンパニAG原本の別名。現行runtimeでは未使用。" }),
  svgAsset("stage-open-template/upright-piano-a", "アップライトピアノA", "src/assets/stage-open-template/upright-piano.svg", "アップライトピアノA.svg", "visual", "uprightPiano"),
  svgAsset("stage-open-template/vibraphone-b", "ビブラフォンB", "src/assets/stage-open-template/vibraphone-b.svg", "ビブラフォンB.svg", "visual", undefined, { usage: "plan", planEnabled: true, note: "指定配布元のビブラフォンB.svgを使用する。" }),
  svgAsset("stage-open-template/xylophone-b", "シロフォンB", "src/assets/stage-open-template/xylophone-b.svg", "シロフォンB.svg", "visual", undefined, { usage: "plan", planEnabled: true, note: "指定配布元のシロフォンB.svgを使用する。" }),
  svgAsset("stage-open-template/vibraphone-a", "ビブラフォンA", "src/assets/stage-open-template/vibraphone-a-derived.svg", "ビブラフォンA_右端補完派生.svg", "visual", "vibraphone", { usage: "plan", planEnabled: true, note: "ビブラフォンA原本を保持し、右端の欠けだけを補完した派生SVG。Bは未変更。" }),
  svgAsset("stage-open-template/xylophone-a", "シロフォンA", "src/assets/stage-open-template/xylophone-a-derived.svg", "シロフォンA_右端補完派生.svg", "visual", "xylophone", { usage: "plan", planEnabled: true, note: "シロフォンA原本を保持し、右端の欠けだけを補完した派生SVG。Bは未変更。" }),
  svgAsset("stage-open-template/glockenspiel-concert-provisional", "グロッケンシュピール（暫定）", "src/assets/stage-open-template/glockenspiel-a-derived.svg", "グロッケンシュピールA_右端補完派生.svg", "visual", "glockenspiel", {
    usage: "plan",
    planEnabled: true,

    note: "グロッケンシュピールA原本を保持し、右端の欠けだけを補完した派生SVG。Bは未変更。",
  }),
  svgAsset("stage-open-template/glockenspiel-b", "グロッケンシュピールB", "src/assets/stage-open-template/glockenspiel-b.svg", "グロッケンシュピールB.svg", "visual", undefined, { usage: "plan", planEnabled: true, note: "指定配布元のグロッケンシュピールB.svgを使用する。" }),
];

const generatedSymbolAssets: readonly SymbolAsset[] = [
  {
    id: "generated/grand-piano-full-outline",
    label: "グランドピアノ（フル輪郭・旧）",
    sourcePath: "generated:parametric-piano",
    variantKind: "preset",
    usage: "legend-only",
    planEnabled: false,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    derivedFromAssetId: "stage-open-template/grand-piano-full-ab",
    note: "旧JSON互換のため保持。現行配置には使用しない。",
  },
  {
    id: "generated/grand-piano-semi-outline",
    label: "グランドピアノ（セミ輪郭・旧）",
    sourcePath: "generated:parametric-piano",
    variantKind: "preset",
    usage: "legend-only",
    planEnabled: false,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    derivedFromAssetId: "stage-open-template/grand-piano-semi-a",
    note: "旧JSON互換のため保持。現行配置には使用しない。",
  },
  {
    id: "generated/concert-bass-drum-36x22",
    label: "コンサートバスドラム36×22インチ",
    sourcePath: "generated:parametric-bass-drum",
    variantKind: "preset",
    usage: "legend-only",
    planEnabled: false,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    derivedFromAssetId: "stage-open-template/bass-drum-a",
    note: "旧JSON互換のため保持。現行配置には元SVGを使用する。",
  },
  {
    id: "generated/timpani-circle",
    label: "ティンパニ円形",
    sourcePath: "generated:parametric-circle",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    note: "口径ごとの寸法はinstrumentCatalog.tsを正本とする。",
  },
  {
    id: "generated/timpani-set-4",
    label: "ティンパニ4台セット",
    sourcePath: "generated:fixed-group-preset",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    note: "配置時は4個の子要素を持つGroupPresetへ展開する。",
  },
  {
    id: "generated/chair-music-stand-set",
    label: "Chair + music stand set",
    sourcePath: "generated:fixed-group-preset",
    variantKind: "preset",
    usage: "legend-only",
    planEnabled: false,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    note: "Virtual group preset expanded into chair and music stand child objects at placement time.",
  },
  {
    id: "generated/concert-tom-16",
    label: "コンサートトム16",
    sourcePath: "generated:parametric-circle",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
  },
  {
    id: "generated/concert-tom-14",
    label: "コンサートトム14",
    sourcePath: "generated:parametric-circle",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
  },
  {
    id: "generated/concert-tom-12",
    label: "コンサートトム12",
    sourcePath: "generated:parametric-circle",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
  },
  {
    id: "generated/concert-tom-10",
    label: "コンサートトム10",
    sourcePath: "generated:parametric-circle",
    variantKind: "preset",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
  },
  {
    id: "generated/concert-tom-set-4",
    label: "コンサートトム4台セット",
    sourcePath: "generated:fixed-group-preset",
    variantKind: "preset",
    usage: "legend-only",
    planEnabled: false,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    note: "配置時は4個の子オブジェクトへ展開する。",
  },
  {
    id: "generated/music-stand-cross",
    label: "譜面台×",
    sourcePath: "generated:parametric-cross",
    variantKind: "visual",
    usage: "plan",
    planEnabled: true,
    defaultRotationDeg: 0,
    anchorXRatio: 0.5,
    anchorYRatio: 0.5,
    note: "ホール図面で一般的な×印の略記号。寸法はmusic-standプリセットを正本とする。",
  },
];

export const REPOSITORY_SYMBOL_ASSETS = repositorySymbolAssets;
export const GENERATED_SYMBOL_ASSETS = generatedSymbolAssets;
export const ALL_SYMBOL_ASSETS: readonly SymbolAsset[] = [
  ...REPOSITORY_SYMBOL_ASSETS,
  ...GENERATED_SYMBOL_ASSETS,
];

/** Explicit visual alternatives. Size presets are intentionally not included here. */
export interface VisualAssetVariantOption {
  assetId: string;
  label: string;
}

export const VISUAL_ASSET_VARIANTS_BY_PRESET: Readonly<Record<string, readonly VisualAssetVariantOption[]>> = {
  "music-stand": [
    { assetId: "stage-open-template/music-stand-a", label: "A" },
    { assetId: "generated/music-stand-cross", label: "×" },
  ],
  "snare-drum": [
    { assetId: "stage-open-template/snare-drum-a", label: "A" },
    { assetId: "stage-open-template/snare-drum-b", label: "B" },
  ],
  "suspended-cymbal": [
    { assetId: "stage-open-template/suspended-cymbal-ag", label: "AG" },
    { assetId: "stage-open-template/suspended-cymbal-aw", label: "AW" },
  ],
  "gong-tam-tam": [
    { assetId: "stage-open-template/gong-tam-tam-ag", label: "AG" },
    { assetId: "stage-open-template/gong-tam-tam-aw", label: "AW" },
  ],
  "conga-2": [
    { assetId: "stage-open-template/conga-2-ag", label: "AG" },
    { assetId: "stage-open-template/conga-2-aw", label: "AW" },
    { assetId: "stage-open-template/conga-2-b", label: "B" },
  ],
  bongo: [
    { assetId: "stage-open-template/bongo-a", label: "A" },
    { assetId: "stage-open-template/bongo-b", label: "B" },
  ],
  marimba: [
    { assetId: "stage-open-template/marimba-a", label: "A" },
    { assetId: "stage-open-template/marimba-b", label: "B" },
  ],
  "marimba-5oct": [
    { assetId: "stage-open-template/marimba-a", label: "A" },
    { assetId: "stage-open-template/marimba-b", label: "B" },
  ],
  // 4オクターブ用のB相当原本がないため、視覚バリエーションはAのみ。
  "marimba-4oct": [
    { assetId: "stage-open-template/marimba-4oct-a", label: "A" },
  ],
  vibraphone: [
    { assetId: "stage-open-template/vibraphone-a", label: "A" },
    { assetId: "stage-open-template/vibraphone-b", label: "B" },
  ],
  "vibraphone-standard": [
    { assetId: "stage-open-template/vibraphone-a", label: "A" },
    { assetId: "stage-open-template/vibraphone-b", label: "B" },
  ],
  xylophone: [
    { assetId: "stage-open-template/xylophone-a", label: "A" },
    { assetId: "stage-open-template/xylophone-b", label: "B" },
  ],
  "xylophone-concert": [
    { assetId: "stage-open-template/xylophone-a", label: "A" },
    { assetId: "stage-open-template/xylophone-b", label: "B" },
  ],
  "glockenspiel-concert": [
    { assetId: "stage-open-template/glockenspiel-concert-provisional", label: "A" },
    { assetId: "stage-open-template/glockenspiel-b", label: "B" },
  ],
};

export function visualAssetVariantsForPreset(presetId: string | null): readonly VisualAssetVariantOption[] {
  return presetId ? VISUAL_ASSET_VARIANTS_BY_PRESET[presetId] ?? [] : [];
}
const SYMBOL_ASSET_BY_ID = new Map(ALL_SYMBOL_ASSETS.map((asset) => [asset.id, asset]));
const SYMBOL_ASSET_BY_RUNTIME_KEY = new Map(
  REPOSITORY_SYMBOL_ASSETS
    .filter((asset): asset is RuntimeSymbolAsset & { runtimeKey: string } => typeof asset.runtimeKey === "string")
    .map((asset) => [asset.runtimeKey, asset]),
);

export const DEFAULT_ASSET_VARIANT_ID_BY_PRESET: Readonly<Record<string, string>> = {
  chair: "stage-open-template/chair-a",
  [CHAIR_MUSIC_STAND_SET_PRESET_ID]: "generated/chair-music-stand-set",
  "chair-back": "stage-open-template/chair-back-e",
  "piano-bench": "stage-open-template/piano-bench-backless",
  "music-stand": "stage-open-template/music-stand-a",
  lectern: "stage-open-template/lectern-c",
  "conductor-stand": "stage-open-template/conductor-stand-big-band",
  podium: "stage-open-template/platform-3x3",
  "riser-3x6": "stage-open-template/platform-3x6",
  "riser-4x6": "stage-open-template/platform-4x6",
  "riser-6x6": "stage-open-template/platform-6x6",
  hakouma: "stage-open-template/hakouma-a",
  "table-long": "stage-open-template/table-percussion",
  "grand-piano-full": "stage-open-template/grand-piano-d",
  "grand-piano-semi": "stage-open-template/grand-piano-bb",
  "upright-piano": "stage-open-template/upright-piano-a",
  celesta: "stage-open-template/celesta-a",
  "snare-drum": "stage-open-template/snare-drum-a",
  "suspended-cymbal": "stage-open-template/suspended-cymbal-ag",
  "crash-cymbal-pair": "stage-open-template/crash-cymbal-pair",
  "gong-tam-tam": "stage-open-template/gong-tam-tam-ag",
  "conga-2": "stage-open-template/conga-2-ag",
  bongo: "stage-open-template/bongo-a",
  "wind-chime": "stage-open-template/wind-chime",
  "timpani-23": "generated/timpani-circle",
  "timpani-26": "generated/timpani-circle",
  "timpani-29": "generated/timpani-circle",
  "timpani-32": "generated/timpani-circle",
  marimba: "stage-open-template/marimba-a",
  "bass-drum": "stage-open-template/bass-drum-a",
  vibraphone: "stage-open-template/vibraphone-a",
  xylophone: "stage-open-template/xylophone-a",
  "marimba-5oct": "stage-open-template/marimba-a",
  "marimba-4oct": "stage-open-template/marimba-4oct-a",
  "vibraphone-standard": "stage-open-template/vibraphone-a",
  "xylophone-concert": "stage-open-template/xylophone-a",
  "glockenspiel-concert": "stage-open-template/glockenspiel-concert-provisional",
  "tubular-bells-concert": "stage-open-template/chimes-a",
  "drum-set-compact": "stage-open-template/drum-set-a",
  "drum-set-standard": "stage-open-template/drum-set-a",
  "drum-set-large": "stage-open-template/drum-set-a",
  chimes: "stage-open-template/chimes-a",
  "drum-set": "stage-open-template/drum-set-a",
  "timpani-set-4": "generated/timpani-set-4",
  "concert-tom-16": "generated/concert-tom-16",
  "concert-tom-14": "generated/concert-tom-14",
  "concert-tom-12": "generated/concert-tom-12",
  "concert-tom-10": "generated/concert-tom-10",
  "concert-tom-set-4": "generated/concert-tom-set-4",
  harp: "stage-open-template/harp-a",
  "grand-harp-47": "stage-open-template/harp-a",
  "legacy-xylophone-glockenspiel": "stage-open-template/xylophone-a",
  "legacy-drum-set": "stage-open-template/drum-set-a",
  "contrabass-stool": "stage-open-template/contrabass-b",
  "amp-speaker": "stage-open-template/amp-speaker-a",
};

export function symbolAssetForRuntimeKey(runtimeKey: string): SymbolAsset | undefined {
  return SYMBOL_ASSET_BY_RUNTIME_KEY.get(runtimeKey);
}

export function symbolAssetForId(assetId: string): SymbolAsset | undefined {
  return SYMBOL_ASSET_BY_ID.get(assetId);
}

export function isKnownSymbolAssetId(value: unknown): value is string {
  return typeof value === "string" && SYMBOL_ASSET_BY_ID.has(value);
}

export function defaultAssetVariantIdForPreset(presetId: string | null): string | null {
  if (!presetId) return null;
  return DEFAULT_ASSET_VARIANT_ID_BY_PRESET[presetId] ?? null;
}

/** 旧JSONのvariant欠落・未知variantを既定variantへ安全に戻す。 */
export function resolveAssetVariantId(value: unknown, presetId: string | null): string | null {
  return isKnownSymbolAssetId(value) ? value : defaultAssetVariantIdForPreset(presetId);
}
