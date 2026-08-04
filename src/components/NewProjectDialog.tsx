import { useRef, useState, type FormEvent } from "react";
import { stageDimensionToMm, type StageTemplateInputUnit } from "../core/stageTemplate";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  onClose: () => void;
  onCreateBlank: () => void;
  onCreateStageTemplate: (widthMm: number, depthMm: number) => void;
}

const UNIT_LABELS: Record<StageTemplateInputUnit, string> = {
  ken: "間（けん）",
  m: "m",
  cm: "cm",
  mm: "mm",
};

function formatMm(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("ja-JP")} mm`;
}

export function NewProjectDialog({ onClose, onCreateBlank, onCreateStageTemplate }: Props) {
  const [kind, setKind] = useState<"blank" | "template">("template");
  const [unit, setUnit] = useState<StageTemplateInputUnit>("ken");
  const [width, setWidth] = useState("8");
  const [depth, setDepth] = useState("8");
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onClose });

  const widthMm = stageDimensionToMm(width, unit);
  const depthMm = stageDimensionToMm(depth, unit);
  const canCreateTemplate = widthMm !== null && depthMm !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "blank") {
      onCreateBlank();
      return;
    }
    if (widthMm !== null && depthMm !== null) onCreateStageTemplate(widthMm, depthMm);
  }

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="dialog new-project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title" tabIndex={-1}>
        <h2 id="new-project-title">新規プロジェクト</h2>
        <p className="dialog-intro">背景図面を読み込むか、実寸の舞台テンプレートから始めます。</p>
        <form onSubmit={handleSubmit}>
          <fieldset className="new-project-kinds">
            <legend>開始方法</legend>
            <label className="new-project-kind">
              <input type="radio" name="new-project-kind" checked={kind === "blank"} onChange={() => setKind("blank")} />
              <span><strong>空のプロジェクト</strong><small>あとから背景図面を読み込みます</small></span>
            </label>
            <label className="new-project-kind">
              <input type="radio" name="new-project-kind" checked={kind === "template"} onChange={() => setKind("template")} />
              <span><strong>実寸舞台テンプレート</strong><small>図面なしで、1間グリッド付きの舞台を作成します</small></span>
            </label>
          </fieldset>

          {kind === "template" && (
            <fieldset className="stage-template-fields">
              <legend>舞台寸法</legend>
              <label>
                単位
                <select value={unit} onChange={(event) => setUnit(event.target.value as StageTemplateInputUnit)}>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="dimension-inputs">
                <label>横<input type="number" min="0.001" step="any" inputMode="decimal" value={width} onChange={(event) => setWidth(event.target.value)} /> {UNIT_LABELS[unit]}</label>
                <span aria-hidden="true">×</span>
                <label>縦<input type="number" min="0.001" step="any" inputMode="decimal" value={depth} onChange={(event) => setDepth(event.target.value)} /> {UNIT_LABELS[unit]}</label>
              </div>
              <p className="hint">1間 = 1,820mm。横方向は中央基準、縦方向は図面下端から1間ずつ配置します。</p>
              <p className="stage-template-preview" role="status">実寸: 横 {formatMm(widthMm)} × 縦 {formatMm(depthMm)}</p>
            </fieldset>
          )}

          <div className="dialog-buttons">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" className="primary" disabled={kind === "template" && !canCreateTemplate}>作成</button>
          </div>
        </form>
      </div>
    </div>
  );
}
