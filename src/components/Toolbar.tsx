// 図面作業の主導線を、ファイル操作・履歴・表示・ツールの順に整理したヘッダー。
// 画面幅が狭い場合も、キャンバスを優先してサイドパネルを開閉できるようにする。

import { useEffect, useState, type Dispatch } from "react";
import type { PointMm } from "../types/project";
import type { Action, AppState, ToolMode } from "../state/appState";
import { toolModeLabel } from "../state/appState";
import { fitViewToProject, zoomAt } from "../core/transform";
import { findPreset } from "../core/presets";
import { appServices, isPdfFile, isSupportedBackgroundFile, type PdfPageImage } from "../services";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onNotice: (message: string) => void;
  onExport: () => void;
  onToggle3d: () => void;
  is3dOpen: boolean;
  wallDraft: PointMm[];
  onFinishWall: (heightMm: number) => void;
  onClearWallDraft: () => void;
  onToggleLibrary?: () => void;
  onToggleInspector?: () => void;
  libraryOpen?: boolean;
  inspectorOpen?: boolean;
}

function canvasViewport(): { width: number; height: number } {
  const canvas = document.querySelector<SVGSVGElement>(".canvas-stage");
  const rect = canvas?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
  return { width: Math.max(320, window.innerWidth - 520), height: Math.max(240, window.innerHeight - 180) };
}

export function Toolbar({
  state,
  dispatch,
  onNotice,
  onExport,
  onToggle3d,
  is3dOpen,
  wallDraft,
  onFinishWall,
  onClearWallDraft,
  onToggleLibrary,
  onToggleInspector,
  libraryOpen = true,
  inspectorOpen = true,
}: Props) {
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [wallHeightMm, setWallHeightMm] = useState(6000);
  const [projectNameDraft, setProjectNameDraft] = useState(state.project.name);
  const { project, mode, saveState } = state;

  useEffect(() => setProjectNameDraft(project.name), [project.name]);

  function commitProjectName() {
    const name = projectNameDraft.trim() || "新規プロジェクト";
    setProjectNameDraft(name);
    if (name !== project.name) dispatch({ type: "SET_PROJECT_NAME", name });
  }

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

  async function handleBackgroundOpen() {
    let file;
    try {
      file = await appServices.file.openFile({ accept: ["image/png", "image/jpeg", "application/pdf", ".png", ".jpg", ".jpeg", ".pdf"] });
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "背景ファイルを開けません");
      return;
    }
    if (!file) return;
    if (!isSupportedBackgroundFile(file)) {
      onNotice("対応形式はPNG、JPEG、PDFです。ファイル形式を確認してください。");
      return;
    }
    if (isPdfFile(file)) {
      setPdfLoading(true);
      appServices.pdf.loadPages(file)
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
    try {
      const image = await appServices.image.loadImage(file);
      applyBackground({ pageNumber: 1, ...image }, "image");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "画像の読み込みに失敗しました");
    }
  }

  async function handleOpen() {
    if (saveState === "dirty" && !window.confirm("未保存の変更があります。読み込むと現在の変更は破棄されます。続けますか？")) return;
    try {
      const loaded = await appServices.project.openProject();
      if (!loaded) return;
      dispatch({ type: "LOAD_PROJECT", project: loaded });
      onNotice(`プロジェクト「${loaded.name}」を開きました`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "プロジェクトを開けません");
    }
  }

  async function handleSave() {
    setFileSaving(true);
    try {
      await appServices.project.saveProject(project);
      dispatch({ type: "MARK_SAVED" });
      onNotice("プロジェクトを保存しました");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "プロジェクトの保存に失敗しました");
    } finally {
      setFileSaving(false);
    }
  }

  function setMode(next: ToolMode) {
    if (next === "verifyCalibration" && project.calibration.mmPerPixel === null) {
      onNotice("校正済みのプロジェクトで校正確認を実行してください");
      return;
    }
    const nextMode = mode === next ? "select" : next;
    if (nextMode !== "traceWall") onClearWallDraft();
    dispatch({ type: "SET_MODE", mode: nextMode });
  }

  function zoomBy(factor: number) {
    const viewport = canvasViewport();
    const nextZoom = Math.min(2, Math.max(0.005, project.view.zoom * factor));
    dispatch({ type: "SET_VIEW", view: zoomAt(project.view, { x: viewport.width / 2, y: viewport.height / 2 }, nextZoom) });
  }

  function fitAll() {
    const viewport = canvasViewport();
    dispatch({ type: "SET_VIEW", view: fitViewToProject(project, viewport.width, viewport.height) });
    onNotice("図面全体を表示しました");
  }

  const pendingPreset = state.pendingPresetId ? findPreset(state.pendingPresetId) : null;
  const modeButton = (m: ToolMode, label: string, disabled = false) => (
    <button
      type="button"
      className={`tool-button${mode === m ? " active" : ""}`}
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
      <header className="toolbar app-toolbar">
        <div className="toolbar-topline">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">舞台</span>
            <div className="project-heading">
              <input
                className="project-name"
                value={projectNameDraft}
                onChange={(e) => setProjectNameDraft(e.target.value)}
                onBlur={commitProjectName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") { setProjectNameDraft(project.name); e.currentTarget.blur(); }
                }}
                aria-label="プロジェクト名"
              />
              <span className={`save-chip ${saveState === "dirty" ? "dirty" : "saved"}`}>
                {saveState === "dirty" ? "未保存" : "保存済み"}
              </span>
            </div>
          </div>

          <div className="toolbar-group file-actions" aria-label="ファイル操作">
            <button type="button" onClick={handleNew}>新規</button>
            <button type="button" onClick={handleOpen}>開く</button>
            <button type="button" className="primary-action" onClick={handleSave} disabled={fileSaving}>{fileSaving ? "保存中…" : "保存"}</button>
            <button type="button" onClick={onExport} disabled={project.calibration.mmPerPixel === null}>出力</button>
          </div>

          <div className="toolbar-group history-actions" aria-label="編集履歴">
            <button type="button" onClick={() => dispatch({ type: "UNDO" })} disabled={state.past.length === 0} title="Ctrl/Cmd+Z">↶</button>
            <button type="button" onClick={() => dispatch({ type: "REDO" })} disabled={state.future.length === 0} title="Ctrl/Cmd+Shift+Z">↷</button>
          </div>

          <div className="toolbar-group viewport-actions" aria-label="表示操作">
            <button type="button" onClick={fitAll} title="図面全体をキャンバスに収めます">全体表示</button>
            <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="縮小">−</button>
            <span className="zoom-readout" aria-label={`ズーム ${Math.round(project.view.zoom * 100)}パーセント`}>{Math.round(project.view.zoom * 100)}%</span>
            <button type="button" onClick={() => zoomBy(1.25)} aria-label="拡大">＋</button>
          </div>

          <div className="toolbar-group panel-actions" aria-label="パネル表示">
            {onToggleLibrary && <button type="button" className="panel-toggle" aria-pressed={libraryOpen} onClick={onToggleLibrary}>ライブラリ</button>}
            {onToggleInspector && <button type="button" className="panel-toggle" aria-pressed={inspectorOpen} onClick={onToggleInspector}>インスペクター</button>}
          </div>
        </div>

        <div className="tool-ribbon">
          <div className="tool-cluster">
            <span className="tool-cluster-label">図面</span>
            <button type="button" onClick={handleBackgroundOpen} disabled={pdfLoading}>{pdfLoading ? "読込中…" : "背景読込"}</button>
            {modeButton("calibrate", "校正")}
            {modeButton("verifyCalibration", "校正確認", project.calibration.mmPerPixel === null)}
            {modeButton("measure", "測定")}
          </div>
          <div className="tool-cluster">
            <span className="tool-cluster-label">編集</span>
            {modeButton("select", "選択")}
            {modeButton("selectRect", "範囲選択")}
            <button type="button" onClick={onToggle3d} disabled={!is3dOpen && project.calibration.mmPerPixel === null}>{is3dOpen ? "2D編集へ" : "3Dビュー"}</button>
          </div>
          <div className="tool-cluster annotation-tools">
            <span className="tool-cluster-label">注釈</span>
            {modeButton("annotationText", "文字")}
            {modeButton("annotationLine", "線")}
            {modeButton("annotationArrow", "矢印")}
            {modeButton("annotationRect", "矩形")}
            {modeButton("annotationCircle", "円")}
            {modeButton("annotationDimension", "寸法")}
          </div>
          <div className="toolbar-mode-status" role="status" aria-label={`現在のモード: ${toolModeLabel(mode)}`}>
            <span className="mode-dot" aria-hidden="true" />
            <span>{toolModeLabel(mode)}</span>
            {pendingPreset && <small>配置待機中: {pendingPreset.name}</small>}
            {state.placementContinuous && <span className="continuous-badge">連続配置</span>}
          </div>
        </div>

        {mode === "traceWall" && (
          <div className="wall-trace-toolbar">
            <span>壁トレース · {wallDraft.length}点</span>
            <label>壁高(mm)<input type="number" min={1} value={wallHeightMm} onChange={(e) => setWallHeightMm(Math.max(1, Number(e.target.value) || 1))} /></label>
            <button type="button" disabled={wallDraft.length < 2} onClick={() => onFinishWall(wallHeightMm)}>壁を確定</button>
            <button type="button" disabled={wallDraft.length === 0} onClick={onClearWallDraft}>やり直し</button>
          </div>
        )}
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
