// 椅子多列円弧配置(FR-064)の入力パネル。
// キャンバス上で方向指定・端ハンドルを操作できるようにするため、モーダルではなく
// 非モーダルの浮動パネルにする。プレビュー値はこことApp.tsxの一時状態だけに保持し、
// ProjectおよびUndo履歴へは「配置する」を押すまで一切書き込まない。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import { createPresetObject } from "../state/appState";
import {
  CHAIR_ARC_DEFAULT_FIRST_GAP_MM,
  CHAIR_ARC_DEFAULT_ROW_GAP_MM,
  CHAIR_ARC_MAX_ARC_DEG,
  CHAIR_ARC_MAX_CHAIRS_PER_ROW,
  CHAIR_ARC_MAX_ROWS,
  CHAIR_ARC_MIN_ARC_DEG,
  CHAIR_ARC_MIN_CHAIRS_PER_ROW,
  chairArcChairRadiusMm,
  chairArcFirstRowRadiusMm,
  createChairArcRowPlacements,
  detectChairArcObjectOverlaps,
  detectChairArcOffStagePlacements,
  detectChairArcOverlaps,
  validateChairArcRowsOptions,
  type ChairArcRowsOptions,
  type ChairArcSession,
} from "../core/arrangement";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  session: ChairArcSession;
  onSessionChange: (session: ChairArcSession) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

function numericValue(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function rowLabels(refs: readonly { rowIndex: number }[]): string {
  const rows = [...new Set(refs.map((ref) => ref.rowIndex))].sort((a, b) => a - b);
  return rows.map((rowIndex) => `${rowIndex + 1}列目`).join("、");
}

export function ChairArcRowsDialog({ state, dispatch, session, onSessionChange, onClose, onNotice }: Props) {
  const { options } = session;
  const podium = state.project.objects.find((object) => object.id === options.podiumId);
  const chairTemplate = createPresetObject("chair", options.layerId, 0);
  const errors = validateChairArcRowsOptions(options);

  function update(patch: Partial<ChairArcRowsOptions>) {
    onSessionChange({ ...session, options: { ...options, ...patch } });
  }

  function updateRowCount(rowIndex: number, chairCount: number) {
    update({ rows: options.rows.map((row, index) => index === rowIndex ? { chairCount } : row) });
  }

  function addRow() {
    if (options.rows.length >= CHAIR_ARC_MAX_ROWS) return;
    const previous = options.rows[options.rows.length - 1]?.chairCount ?? CHAIR_ARC_MIN_CHAIRS_PER_ROW;
    const chairCount = Math.min(CHAIR_ARC_MAX_CHAIRS_PER_ROW, Math.max(CHAIR_ARC_MIN_CHAIRS_PER_ROW, Math.floor(previous) + 2));
    update({ rows: [...options.rows, { chairCount }] });
  }

  function removeRow(rowIndex: number) {
    if (options.rows.length <= 1 || rowIndex === 0) return;
    update({ rows: options.rows.filter((_, index) => index !== rowIndex) });
  }

  const placements = podium && chairTemplate ? createChairArcRowPlacements(podium, chairTemplate, options) : [];
  const chairRadiusMm = chairTemplate ? chairArcChairRadiusMm(chairTemplate) : 0;
  const firstRowRadiusMm = podium && chairTemplate ? chairArcFirstRowRadiusMm(podium, chairTemplate, options) : 0;
  const chairOverlaps = detectChairArcOverlaps(placements, chairRadiusMm);
  const objectOverlaps = detectChairArcObjectOverlaps(
    placements,
    chairRadiusMm,
    state.project.objects.filter((object) => object.visible && state.project.layers.find((layer) => layer.id === object.layerId)?.visible !== false),
  );
  const offStage = detectChairArcOffStagePlacements(placements, chairRadiusMm, state.project.stageFront);

  const warnings: string[] = [];
  if (chairOverlaps.length > 0) {
    warnings.push(`${rowLabels(chairOverlaps.map((overlap) => overlap.a))}の椅子同士が重なっています。円弧を広げるか、椅子数を減らしてください。`);
  }
  if (objectOverlaps.length > 0) {
    warnings.push(`${rowLabels(objectOverlaps.map((overlap) => overlap.placement))}の椅子${objectOverlaps.length}脚が既存オブジェクトと重なっています。`);
  }
  if (offStage.length > 0) {
    warnings.push(`${rowLabels(offStage)}の椅子${offStage.length}脚が舞台前端より客席側にあります。`);
  }

  function submit() {
    if (errors.length > 0 || placements.length === 0) return;
    dispatch({ type: "ADD_CHAIR_ARC_ROWS", options });
    onNotice(`椅子${placements.length}脚${options.includeMusicStands ? `・譜面台${placements.length}台` : ""}を${options.rows.length}列の円弧上へ配置しました。`);
    onClose();
  }

  const arcDeg = Math.round(options.halfSpanDeg * 2 * 10) / 10;

  return (
    <section className="chair-arc-panel" role="region" aria-label="椅子を多列円弧配置">
      <div className="chair-arc-panel-head">
        <h2>椅子を多列円弧配置</h2>
        <button type="button" className="chair-arc-close" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <p className="hint">基準指揮台: {podium ? (podium.label || podium.name) : "選択が解除されました"}</p>
      <p className="hint preview-interaction-hint">プレビュー中です。キャンバス上の配置物は操作できます。Escapeまたは閉じるでキャンセルします。</p>

      <div className="chair-arc-grid">
        <label>1列目空き距離(mm)
          <input
            type="number"
            min={1}
            value={options.firstGapMm}
            onChange={(event) => update({ firstGapMm: numericValue(event.target.value) })}
          />
        </label>
        <button type="button" className="chair-arc-preset" onClick={() => update({ firstGapMm: CHAIR_ARC_DEFAULT_FIRST_GAP_MM })}>1間(1820mm)</button>
        <label>列間隔(mm)
          <input
            type="number"
            min={1}
            value={options.rowGapMm}
            onChange={(event) => update({ rowGapMm: numericValue(event.target.value) })}
          />
        </label>
        <button type="button" className="chair-arc-preset" onClick={() => update({ rowGapMm: CHAIR_ARC_DEFAULT_ROW_GAP_MM })}>半間(910mm)</button>
        <label>円弧角(度)
          <input
            type="number"
            min={CHAIR_ARC_MIN_ARC_DEG}
            max={CHAIR_ARC_MAX_ARC_DEG}
            step={1}
            value={arcDeg}
            onChange={(event) => update({ halfSpanDeg: numericValue(event.target.value) / 2 })}
          />
        </label>
        <button
          type="button"
          className={"chair-arc-preset" + (session.pickingDirection ? " active" : "")}
          aria-pressed={session.pickingDirection}
          onClick={() => onSessionChange({ ...session, pickingDirection: !session.pickingDirection })}
        >
          {session.pickingDirection ? "方向指定中…" : "方向を指定"}
        </button>
      </div>
      <label className="chair-arc-stand-option">
        <input
          type="checkbox"
          checked={options.includeMusicStands ?? false}
          onChange={(event) => update({ includeMusicStands: event.target.checked })}
        />
        各椅子の前に譜面台を配置
      </label>

      <p className="hint">
        キャンバス上で、方向ハンドルは中心方向、左右端ハンドルは円弧角、円弧の線そのものを外側／内側へドラッグすると距離(1列目は空き距離、2列目以降は列間隔)を10mm刻みで変更できます。
        {firstRowRadiusMm > 0 && ` 1列目半径 ${Math.round(firstRowRadiusMm)}mm`}
      </p>

      <div className="chair-arc-rows">
        <div className="chair-arc-rows-head">
          <span>列一覧({options.rows.length}列 / 合計{placements.length}脚)</span>
          <button type="button" onClick={addRow} disabled={options.rows.length >= CHAIR_ARC_MAX_ROWS}>列を追加</button>
        </div>
        <ul>
          {options.rows.map((row, rowIndex) => (
            <li key={rowIndex}>
              <span className="chair-arc-row-name">{rowIndex + 1}列目</span>
              <input
                type="number"
                min={CHAIR_ARC_MIN_CHAIRS_PER_ROW}
                max={CHAIR_ARC_MAX_CHAIRS_PER_ROW}
                step={1}
                value={row.chairCount}
                aria-label={`${rowIndex + 1}列目の椅子数`}
                onChange={(event) => updateRowCount(rowIndex, Math.floor(numericValue(event.target.value)))}
              />
              <span className="chair-arc-row-unit">脚</span>
              <button type="button" onClick={() => removeRow(rowIndex)} disabled={rowIndex === 0 || options.rows.length <= 1}>削除</button>
            </li>
          ))}
        </ul>
      </div>

      {errors.length > 0 && (
        <ul className="chair-arc-errors" role="alert">
          {errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="chair-arc-warnings" role="status">
          {warnings.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}

      <div className="dialog-buttons">
        <button type="button" onClick={onClose}>キャンセル</button>
        <button type="button" className="primary" onClick={submit} disabled={errors.length > 0 || placements.length === 0}>配置する</button>
      </div>
    </section>
  );
}
