// PNG/PDF出力ダイアログ(FR-080〜085)。出力設定と欄外情報をまとめて指定する。

import { useRef, useState, type Dispatch } from "react";
import { canPlaceObjects, type Action, type AppState } from "../state/appState";
import type { ExportSettings, ProjectMetadata } from "../types/project";
import {
  appServices,
  DEFAULT_EXPORT_LAYERS,
  type ExportLayerOptions,
} from "../services";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onClose: () => void;
  onNotice: (message: string) => void;
}

type Format = "png" | "pdf";

function safeOutputBaseName(name: string): string {
  return (name.trim() || "stage-layout").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80);
}

export function ExportDialog({ state, dispatch, onClose, onNotice }: Props) {
  const [format, setFormat] = useState<Format>("pdf");
  const [pngLongSidePx, setPngLongSidePx] = useState(4000);
  const [paper, setPaper] = useState<ExportSettings["paper"]>(state.project.exportSettings.paper);
  const [orientation, setOrientation] = useState<ExportSettings["orientation"]>(state.project.exportSettings.orientation);
  const [scale, setScale] = useState<ExportSettings["scale"]>(state.project.exportSettings.scale);
  const [layers, setLayers] = useState<ExportLayerOptions>({ ...DEFAULT_EXPORT_LAYERS, grid: state.project.stageTemplate !== null });
  const [metadata, setMetadata] = useState<ProjectMetadata>({ ...state.project.metadata });
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onClose });

  function setMetadataField<K extends keyof ProjectMetadata>(key: K, value: ProjectMetadata[K]) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  function setLayer(key: keyof ExportLayerOptions, value: boolean) {
    setLayers((current) => ({ ...current, [key]: value }));
  }

  async function handleExport() {
    if (!canPlaceObjects(state.project)) {
      onNotice("未校正のため出力できません。先に校正してください。");
      return;
    }
    setBusy(true);
    const exportSettings: ExportSettings = { paper, orientation, scale };
    const exportProject = { ...state.project, metadata, exportSettings };
    try {
      const artifact = format === "png"
        ? await appServices.exporter.exportPng(exportProject, { longSidePx: pngLongSidePx, layers })
        : await appServices.exporter.exportPdf(exportProject, { paper, orientation, scale, layers });
      await appServices.file.saveFile({
        filename: `${safeOutputBaseName(state.project.name)}.${artifact.extension}`,
        mimeType: artifact.mimeType,
        data: artifact.data,
      });
      dispatch({ type: "SET_EXPORT_CONFIGURATION", metadata, settings: exportSettings });
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
      <div ref={dialogRef} className="dialog export-dialog" role="dialog" aria-modal="true" aria-label="図面出力" tabIndex={-1}>
        <h2>図面を出力</h2>
        {!canPlaceObjects(state.project) && <p className="error-message">実寸設定がないため出力できません。</p>}

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
          <label className="row"><input type="checkbox" checked={layers.grid} onChange={(e) => setLayer("grid", e.target.checked)} />{state.project.stageTemplate ? "1間グリッド" : "910mmグリッド"}</label>
          <label className="row"><input type="checkbox" checked={layers.annotations !== false} onChange={(e) => setLayer("annotations", e.target.checked)} />注釈</label>
        </div>

        <h3>出力情報欄</h3>
        <label>ホール名<input value={metadata.hallName} onChange={(e) => setMetadataField("hallName", e.target.value)} /></label>
        <label>公演名<input value={metadata.performanceName} onChange={(e) => setMetadataField("performanceName", e.target.value)} /></label>
        <label>日付<input type="date" value={metadata.date} onChange={(e) => setMetadataField("date", e.target.value)} /></label>
        <label>作成者<input value={metadata.author} onChange={(e) => setMetadataField("author", e.target.value)} /></label>
        <label>備考<textarea value={metadata.notes} onChange={(e) => setMetadataField("notes", e.target.value)} rows={2} /></label>

        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="button" className="primary" disabled={busy || !canPlaceObjects(state.project)} onClick={handleExport}>{busy ? "出力中…" : `${format === "png" ? "PNG" : "PDF"}を出力`}</button>
        </div>
        {format === "pdf" && (
          <div className="export-scale-hint hint">
            <p><b>縮尺の意味</b></p>
            <ul>
              <li><b>1:50</b>：実寸の50分の1（1820mm → 36.4mm）</li>
              <li><b>1:100</b>：実寸の100分の1（1820mm → 18.2mm）</li>
              <li><b>用紙にフィット</b>：用紙に合わせるため、実寸縮尺は保証されません</li>
            </ul>
            <p>1:50/1:100で印刷するときは、プリンター側を「倍率100%／実際のサイズ」にしてください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
