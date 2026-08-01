// 弦楽器テンプレ配置(FR-062)の入力パネル。
// キャンバス上のライブプレビューを見ながら全体補正を調整できるよう、モーダルではなく
// 非モーダルの浮動パネルにする。プレビュー結果はApp.tsxの一時状態だけに保持し、
// Project・Undo履歴・自動保存へは「配置する」を押すまで一切書き込まない(15.2)。
//
// 編成型は8/10/12/14/16型、配置は標準/対抗とVa・Vc入れ替えの4通りから選ぶ。
// 人数入力・カスタム編成・奇数人数の設定は持たない。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { SceneObject } from "../types/project";
import {
  STRING_ENSEMBLE_PRESETS,
  STRING_LAYOUT_PLAYER_COUNTS,
  STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
  STRING_LAYOUT_12_DEFAULT_LATERAL_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
  STRING_LAYOUT_12_DRAG_STEP_MM,
  STRING_LAYOUT_12_LABELS,
  STRING_LAYOUT_12_LIMITS,
  STRING_LAYOUT_12_SECTIONS,
  STRING_SEATING_VARIANT_IDS,
  STRING_SEATING_VARIANT_LABELS,
  STRING_SEATING_VARIANT_ORDER,
  stringLayoutAnchorsFor,
  stringLayoutPultCount,
  stringLayoutRowCount,
  validateStringLayout12Options,
  type StringLayout12Options,
  type StringPultPlacement,
  type StringSectionTemplateSession,
  type StringTemplateWarning,
} from "../core/stringSectionTemplate";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  session: StringSectionTemplateSession;
  options: StringLayout12Options;
  placements: readonly StringPultPlacement[];
  previewObjects: readonly SceneObject[];
  warnings: readonly StringTemplateWarning[];
  /** 必要なプリセットを取得できない場合は確定不能にする(16.3)。 */
  presetMissing: boolean;
  onSessionChange: (session: StringSectionTemplateSession) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

interface NumberField {
  key: "lateralOffsetMm" | "depthOffsetMm" | "spreadScale" | "firstRowRadiusMm" | "rowGapMm";
  label: string;
  step: number;
  unit: string;
  hint: string;
}

const ADJUST_FIELDS: NumberField[] = [
  { key: "lateralOffsetMm", label: "左右位置補正", step: 50, unit: "mm", hint: "図面右へ正" },
  { key: "depthOffsetMm", label: "前後位置補正", step: 50, unit: "mm", hint: "舞台奥へ正。既定は指揮者前を空ける600mm" },
  { key: "spreadScale", label: "全体間隔倍率", step: 0.05, unit: "倍", hint: "プルト内の椅子間隔は変わりません" },
];

const ROW_FIELDS: NumberField[] = [
  { key: "firstRowRadiusMm", label: "1列目までの距離", step: 50, unit: "mm", hint: "指揮台中心から1列目まで" },
  { key: "rowGapMm", label: "列間隔", step: 50, unit: "mm", hint: "隣り合う列の間隔。全列共通" },
];

function numericValue(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

export function StringSectionTemplateDialog({
  state,
  dispatch,
  session,
  options,
  placements,
  previewObjects,
  warnings,
  presetMissing,
  onSessionChange,
  onClose,
  onNotice,
}: Props) {
  const podium = session.podiumId
    ? state.project.objects.find((object) => object.id === session.podiumId) ?? null
    : null;
  const errors = [
    ...validateStringLayout12Options(options),
    ...(presetMissing ? ["椅子・譜面台・コントラバス用椅子のプリセットを取得できません。"] : []),
  ];
  const counts = STRING_LAYOUT_PLAYER_COUNTS[session.ensembleTypeId];
  const playerTotal = STRING_LAYOUT_12_SECTIONS.reduce((total, section) => total + counts[section], 0);
  const chairCount = previewObjects.filter((object) => object.type === "chair").length;
  const standCount = previewObjects.filter((object) => object.type === "musicStand").length;

  function update(patch: Partial<StringSectionTemplateSession>) {
    onSessionChange({ ...session, ...patch });
  }

  function numberField({ key, label, step, unit, hint }: NumberField) {
    const range = STRING_LAYOUT_12_LIMITS[key];
    const valid = inRange(session[key], range);
    return (
      <label key={key}>
        {label}({unit})
        <input
          type="number"
          min={range.min}
          max={range.max}
          step={step}
          value={session[key]}
          className={valid ? undefined : "input-invalid"}
          aria-invalid={!valid}
          onChange={(event) => update({ [key]: numericValue(event.target.value) } as Partial<StringSectionTemplateSession>)}
        />
        {valid ? <small className="hint">{hint}</small> : <small className="input-error">{range.min}〜{range.max}{unit}</small>}
      </label>
    );
  }

  function submit() {
    if (errors.length > 0 || previewObjects.length === 0) return;
    dispatch({ type: "ADD_STRING_SECTION_TEMPLATE", options });
    onNotice(`${session.ensembleTypeId}型・${STRING_SEATING_VARIANT_LABELS[session.seatingVariantId]}として`
      + `奏者位置${chairCount}個・譜面台${standCount}台を配置しました。`);
    onClose();
  }

  return (
    <section className="chair-arc-panel string-template-panel" role="region" aria-label="弦楽器テンプレ配置プレビュー">
      <div className="chair-arc-panel-head">
        <h2>弦楽器テンプレ配置</h2>
        <button type="button" className="chair-arc-close" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <p className="hint preview-interaction-hint">プレビュー中です。キャンバス上の配置物は操作できます。Escapeまたは閉じるでキャンセルします。</p>

      <fieldset className="string-template-group">
        <legend>配置バリエーション</legend>
        <div className="string-template-preset-row">
          {STRING_SEATING_VARIANT_IDS.map((variantId) => (
            <button
              key={variantId}
              type="button"
              className={"chair-arc-preset" + (variantId === session.seatingVariantId ? " active" : "")}
              aria-pressed={variantId === session.seatingVariantId}
              onClick={() => update({ seatingVariantId: variantId })}
            >
              {STRING_SEATING_VARIANT_LABELS[variantId]}
            </button>
          ))}
        </div>
        <p className="hint">
          下手から {STRING_SEATING_VARIANT_ORDER[session.seatingVariantId]
            .map((part) => STRING_LAYOUT_12_LABELS[part]).join(" → ")}
          。Cbはチェロと同じ側の外側後方に付きます。
        </p>
      </fieldset>

      <fieldset className="string-template-group">
        <legend>編成型</legend>
        <div className="string-template-preset-row">
          {STRING_ENSEMBLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={"chair-arc-preset" + (preset.id === session.ensembleTypeId ? " active" : "")}
              aria-pressed={preset.id === session.ensembleTypeId}
              disabled={!preset.available}
              onClick={() => update({ ensembleTypeId: preset.id })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {STRING_LAYOUT_12_SECTIONS
            .map((section) => `${STRING_LAYOUT_12_LABELS[section]} ${counts[section]}`)
            .join("／")}（{playerTotal}人）
        </p>
        <p className="hint">固定テンプレート。生成後に個別調整できます。</p>
        <p className="hint">
          {STRING_LAYOUT_12_SECTIONS.map((section) =>
            `${STRING_LAYOUT_12_LABELS[section]} ${stringLayoutAnchorsFor(session.seatingVariantId, session.ensembleTypeId, section).length}プルト`).join(" / ")}
          （計{stringLayoutPultCount(session.seatingVariantId, session.ensembleTypeId)}プルト）
        </p>
      </fieldset>

      <fieldset className="string-template-group">
        <legend>配置基準</legend>
        <div className="string-template-radio-row">
          <label>
            <input
              type="radio"
              name="string-template-basis"
              checked={session.basis === "podium"}
              disabled={!podium}
              onChange={() => update({ basis: "podium" })}
            />
            選択中の指揮台を使用
          </label>
          <label>
            <input
              type="radio"
              name="string-template-basis"
              checked={session.basis === "coordinate"}
              onChange={() => update({ basis: "coordinate" })}
            />
            座標を指定
          </label>
        </div>
        {session.basis === "podium" && (
          <p className="hint">
            {podium
              ? `基準指揮台: ${podium.label || podium.name}（X ${Math.round(podium.xMm)} / Y ${Math.round(podium.yMm)}mm）。この位置を原点として20プルトを配置します。`
              : "指揮台が見つかりません。座標を指定してください。"}
          </p>
        )}
        {session.basis === "coordinate" && (
          <div className="string-template-grid">
            <label>指揮者位置X(mm)
              <input
                type="number"
                value={session.conductor.xMm}
                onChange={(event) => update({ conductor: { ...session.conductor, xMm: numericValue(event.target.value) } })}
              />
            </label>
            <label>指揮者位置Y(mm)
              <input
                type="number"
                value={session.conductor.yMm}
                onChange={(event) => update({ conductor: { ...session.conductor, yMm: numericValue(event.target.value) } })}
              />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="string-template-group">
        <legend>列の間隔</legend>
        <div className="string-template-grid">{ROW_FIELDS.map(numberField)}</div>
        <div className="string-template-preset-row">
          <button
            type="button"
            className="chair-arc-preset"
            onClick={() => update({
              firstRowRadiusMm: STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
              rowGapMm: STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
            })}
          >
            既定に戻す({STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM} / {STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM}mm)
          </button>
        </div>
        <p className="hint">
          列は指揮台を中心とした{stringLayoutRowCount(session.seatingVariantId, session.ensembleTypeId)}本の同心の輪です。キャンバス上で列の補助線を
          外側／内側へドラッグしても、1列目は距離、2列目以降は列間隔を{STRING_LAYOUT_12_DRAG_STEP_MM}mm刻みで変更できます。
        </p>
      </fieldset>

      <fieldset className="string-template-group">
        <legend>全体補正</legend>
        <div className="string-template-grid">{ADJUST_FIELDS.map(numberField)}</div>
        <div className="string-template-preset-row">
          <button
            type="button"
            className="chair-arc-preset"
            onClick={() => update({
              lateralOffsetMm: STRING_LAYOUT_12_DEFAULT_LATERAL_OFFSET_MM,
              depthOffsetMm: STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
            })}
          >
            位置を既定に戻す(0 / {STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM}mm)
          </button>
        </div>
        <p className="hint">
          キャンバス上の中心ハンドル（半円の中心にある十字）をドラッグしても、
          左右と前後の位置補正を{STRING_LAYOUT_12_DRAG_STEP_MM}mm刻みで同時に変更できます。
        </p>
      </fieldset>

      <p className="hint string-template-summary">
        生成予定: 奏者位置{chairCount}個 / 譜面台{standCount}台（合計{previewObjects.length}オブジェクト・{placements.length}プルト）
      </p>

      {errors.length > 0 && (
        <ul className="chair-arc-errors" role="alert">
          {errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="chair-arc-warnings" role="status">
          {warnings.map((warning) => <li key={warning.kind}>{warning.message}</li>)}
        </ul>
      )}

      <div className="dialog-buttons">
        <button type="button" onClick={onClose}>キャンセル</button>
        <button type="button" className="primary" onClick={submit} disabled={errors.length > 0 || previewObjects.length === 0}>配置する</button>
      </div>
    </section>
  );
}
