// PNG/PDF出力ダイアログ(FR-080〜085)。出力設定と欄外情報をまとめて指定する。

import { useState, type Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { ExportSettings, ProjectMetadata } from "../types/project";
import {
  createProjectPdf,
  DEFAULT_EXPORT_LAYERS,
  renderProjectToPng,
  type ExportLayerOptions,
} from "../core/export";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onClose: () => void;
  onNotice: (message: string) => void;
}

type Format = "png" | "pdf";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ state, dispatch, onClose, onNotice }: Props) {
  const [format, setFormat] = useState<Format>("pdf");
  const [pngLongSidePx, setPngLongSidePx] = useState(4000);
  const [paper, setPaper] = useState<ExportSettings["paper"]>(state.project.exportSettings.paper);
  const [orientation, setOrientation] = useState<ExportSettings["orientation"]>(state.project.exportSettings.orientation);
  const [scale, setScale] = useState<ExportSettings["scale"]>(state.project.exportSettings.scale);
  const [layers, setLayers] = useState<ExportLayerOptions>({ ...DEFAULT_EXPORT_LAYERS });
  const [metadata, setMetadata] = useState<ProjectMetadata>({ ...state.project.metadata });
  const [busy, setBusy] = useState(false);

  function setMetadataField<K extends keyof ProjectMetadata>(key: K, value: ProjectMetadata[K]) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  function setLayer(key: keyof ExportLayerOptions, value: boolean) {
    setLayers((current) => ({ ...current, [key]: value }));
  }

  async function handleExport() {
    if (state.project.calibration.mmPerPixel === null) {
      onNotice("未校正のため出力できません。先に校正してください。");
      return;
    }
    setBusy(true);
    const exportSettings: ExportSettings = { paper, orientation, scale };
    const exportProject = { ...state.project, metadata, exportSettings };
    try {
      dispatch({ type: "SET_METADATA", metadata });
      dispatch({ type: "SET_EXPORT_SETTINGS", settings: exportSettings });
      const blob = format === "png"
        ? await renderProjectToPng(exportProject, { longSidePx: pngLongSidePx, layers })
        : await createProjectPdf(exportProject, { paper, orientation, scale, layers });
      const extension = format === "png" ? "png" : "pdf";
      downloadBlob(blob, `${state.project.name || "stage-layout"}.${extension}`);
      onNotice(`${format === "png" ? "PNG" : "PDF"}を出力しました`);
      onClose();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "出力に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog export-dialog" role="dialog" aria-label="図面出力">
        <h2>図面を出力</h2>
        {state.project.calibration.mmPerPixel === null && <p className="error-message">未校正のため出力できません。</p>}

        <label>
          出力形式
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
          </select>
        </label>

        {format === "png" ? (
          <label>
            PNG長辺
            <select value={pngLongSidePx} onChange={(e) => setPngLongSidePx(Number(e.target.value))}>
              {[2000, 3000, 4000, 5000, 6000].map((value) => <option key={value} value={value}>{value}px</option>)}
            </select>
          </label>
        ) : (
          <div className="export-grid-fields">
            <label>用紙<select value={paper} onChange={(e) => setPaper(e.target.value as ExportSettings["paper"])}><option value="A4">A4</option><option value="A3">A3</option></select></label>
            <label>向き<select value={orientation} onChange={(e) => setOrientation(e.target.value as ExportSettings["orientation"])}><option value="landscape">横</option><option value="portrait">縦</option></select></label>
            <label>縮尺<select value={scale} onChange={(e) => setScale(e.target.value as ExportSettings["scale"])}><option value="1:50">1:50</option><option value="1:100">1:100</option><option value="fit">用紙にフィット</option></select></label>
          </div>
        )}

        <h3>出力レイヤー</h3>
        <div className="export-checks">
          <label className="row"><input type="checkbox" checked={layers.background} onChange={(e) => setLayer("background", e.target.checked)} />背景</label>
          <label className="row"><input type="checkbox" checked={layers.objects} onChange={(e) => setLayer("objects", e.target.checked)} />配置物</label>
          <label className="row"><input type="checkbox" checked={layers.labels} onChange={(e) => setLayer("labels", e.target.checked)} />ラベル</label>
          <label className="row"><input type="checkbox" checked={layers.grid} onChange={(e) => setLayer("grid", e.target.checked)} />910mmグリッド</label>
        </div>

        <h3>出力情報欄</h3>
        <label>ホール名<input value={metadata.hallName} onChange={(e) => setMetadataField("hallName", e.target.value)} /></label>
        <label>公演名<input value={metadata.performanceName} onChange={(e) => setMetadataField("performanceName", e.target.value)} /></label>
        <label>日付<input type="date" value={metadata.date} onChange={(e) => setMetadataField("date", e.target.value)} /></label>
        <label>作成者<input value={metadata.author} onChange={(e) => setMetadataField("author", e.target.value)} /></label>
        <label>備考<textarea value={metadata.notes} onChange={(e) => setMetadataField("notes", e.target.value)} rows={2} /></label>

        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="button" className="primary" disabled={busy || state.project.calibration.mmPerPixel === null} onClick={handleExport}>{busy ? "出力中…" : `${format === "png" ? "PNG" : "PDF"}を出力`}</button>
        </div>
        {format === "pdf" && <p className="hint">1:50/1:100はPDF内寸法を固定し、印刷時は倍率100%を指定します。</p>}
      </div>
    </div>
  );
}
