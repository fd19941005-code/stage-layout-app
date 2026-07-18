// 上部ツールバー(10.1): 新規、開く、保存、背景読込、編集履歴、選択、校正、測定、出力、ズーム

import { useRef, useState, type ChangeEvent, type Dispatch } from "react";
import type { Action, AppState, ToolMode } from "../state/appState";
import { toolModeLabel } from "../state/appState";
import { deserializeProject, serializeProject } from "../core/project";
import { zoomAt } from "../core/transform";
import { isPdfFile, isSupportedBackgroundFile, renderPdfPages, type PdfPageImage } from "../core/pdf";
import { findPreset } from "../core/presets";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onNotice: (message: string) => void;
  onExport: () => void;
}

export function Toolbar({ state, dispatch, onNotice, onExport }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { project, mode, saveState } = state;

  function handleNew() {
    if (saveState === "dirty" && !window.confirm("未保存の変更があります。新規プロジェクトを作成しますか？")) return;
    dispatch({ type: "NEW_PROJECT" });
  }

  function applyBackground(page: PdfPageImage, sourceType: "image" | "pdf") {
    dispatch({
      type: "SET_BACKGROUND",
      imageDataUrl: page.imageDataUrl,
      naturalWidthPx: page.naturalWidthPx,
      naturalHeightPx: page.naturalHeightPx,
      sourceType,
      sourcePage: sourceType === "pdf" ? page.pageNumber : null,
    });
    setPdfPages([]);
    onNotice(sourceType === "pdf" ? `PDF ${page.pageNumber}ページを背景として読み込みました。` : "背景を読み込みました。「校正」で2点と実距離を指定してください。");
  }

  function handleImageSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isSupportedBackgroundFile(file)) {
      onNotice("対応形式はPNG、JPEG、PDFです。ファイル形式を確認してください。");
      return;
    }
    if (isPdfFile(file)) {
      setPdfLoading(true);
      renderPdfPages(file)
        .then((pages) => {
          if (pages.length === 0) onNotice("PDFに読み込めるページがありません");
          else if (pages.length === 1) applyBackground(pages[0], "pdf");
          else {
            setPdfPages(pages);
            onNotice(`${pages.length}ページのPDFです。背景にするページを選択してください。`);
          }
        })
        .catch((error: unknown) => onNotice(error instanceof Error ? error.message : "PDFを読み込めません"))
        .finally(() => setPdfLoading(false));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => onNotice("画像の読み込みに失敗しました");
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => onNotice("画像を解析できません。別のファイルを試してください");
      img.onload = () => applyBackground({ pageNumber: 1, imageDataUrl: dataUrl, naturalWidthPx: img.naturalWidth, naturalHeightPx: img.naturalHeight }, "image");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleOpen() {
    if (saveState === "dirty" && !window.confirm("未保存の変更があります。読み込むと現在の変更は破棄されます。続けますか？")) return;
    projectInputRef.current?.click();
  }

  function handleProjectSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => onNotice("ファイルの読み込みに失敗しました");
    reader.onload = () => {
      try {
        const loaded = deserializeProject(reader.result as string);
        dispatch({ type: "LOAD_PROJECT", project: loaded });
        onNotice(`プロジェクト「${loaded.name}」を開きました`);
      } catch (error) {
        onNotice(error instanceof Error ? error.message : "プロジェクトを開けません");
      }
    };
    reader.readAsText(file);
  }

  function handleSave() {
    const blob = new Blob([serializeProject(project)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "stage-layout"}.stage.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: "MARK_SAVED" });
  }

  function setMode(next: ToolMode) {
    if (next === "verifyCalibration" && project.calibration.mmPerPixel === null) {
      onNotice("校正済みのプロジェクトで校正確認を実行してください");
      return;
    }
    dispatch({ type: "SET_MODE", mode: mode === next ? "select" : next });
  }

  function zoomBy(factor: number) {
    const next = Math.min(2, Math.max(0.005, project.view.zoom * factor));
    dispatch({ type: "SET_VIEW", view: zoomAt(project.view, { x: 480, y: 320 }, next) });
  }

  const pendingPreset = state.pendingPresetId ? findPreset(state.pendingPresetId) : null;
  const modeButton = (m: ToolMode, label: string, disabled = false) => (
    <button
      type="button"
      className={mode === m ? "active" : ""}
      aria-pressed={mode === m}
      disabled={disabled}
      title={disabled ? `${label}（校正済みのプロジェクトで使用できます）` : `${toolModeLabel(m)}モード`}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="toolbar">
        <input className="project-name" value={project.name} onChange={(e) => dispatch({ type: "SET_PROJECT_NAME", name: e.target.value })} aria-label="プロジェクト名" />
        <button type="button" onClick={handleNew}>新規</button>
        <button type="button" onClick={handleOpen}>開く</button>
        <button type="button" onClick={handleSave}>保存(JSON)</button>
        <button type="button" onClick={onExport} disabled={project.calibration.mmPerPixel === null}>出力</button>
        <span className="separator" />
        <button type="button" onClick={() => dispatch({ type: "UNDO" })} disabled={state.past.length === 0} title="Ctrl/Cmd+Z">↶ Undo</button>
        <button type="button" onClick={() => dispatch({ type: "REDO" })} disabled={state.future.length === 0} title="Ctrl/Cmd+Shift+Z">↷ Redo</button>
        <span className="separator" />
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={pdfLoading}>{pdfLoading ? "PDF読込中…" : "背景読込"}</button>
        <span className="separator" />
        {modeButton("select", "選択")}
        {modeButton("selectRect", "範囲選択")}
        {modeButton("calibrate", "校正")}
        {modeButton("verifyCalibration", "校正確認", project.calibration.mmPerPixel === null)}
        {modeButton("measure", "測定")}
        <span className="separator" />
        {modeButton("annotationText", "文字")}
        {modeButton("annotationLine", "線")}
        {modeButton("annotationArrow", "矢印")}
        {modeButton("annotationRect", "矩形注釈")}
        {modeButton("annotationCircle", "円注釈")}
        {modeButton("annotationDimension", "寸法線")}
        <span className="separator" />
        <button type="button" onClick={() => zoomBy(1.25)}>拡大</button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)}>縮小</button>
        <div className="toolbar-mode-status" role="status" aria-label={`現在のモード: ${toolModeLabel(mode)}`}>
          <span>現在のモード</span>
          <strong>{toolModeLabel(mode)}</strong>
          {pendingPreset && <span>配置待機中：{pendingPreset.name}（キャンバスをタップ）</span>}
          {state.placementContinuous && <span className="continuous-badge">連続配置中</span>}
          {mode === "select" && !pendingPreset && state.selectedIds.length > 0 && <span>矢印キー: 10mm移動（Shift+矢印: 100mm）</span>}
        </div>

        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,application/pdf,.pdf" hidden onChange={handleImageSelected} />
        <input ref={projectInputRef} type="file" accept=".json,application/json" hidden onChange={handleProjectSelected} />
      </header>

      {pdfPages.length > 0 && (
        <div className="dialog-backdrop">
          <div className="dialog pdf-page-dialog" role="dialog" aria-label="PDFページ選択">
            <h2>背景にするPDFページを選択</h2>
            <div className="pdf-page-grid">
              {pdfPages.map((page) => (
                <button type="button" className="pdf-page" key={page.pageNumber} onClick={() => applyBackground(page, "pdf")}>
                  <img src={page.imageDataUrl} alt={`${page.pageNumber}ページのプレビュー`} />
                  <span>{page.pageNumber}ページ</span>
                </button>
              ))}
            </div>
            <button type="button" className="cancel" onClick={() => setPdfPages([])}>キャンセル</button>
          </div>
        </div>
      )}
    </>
  );
}

