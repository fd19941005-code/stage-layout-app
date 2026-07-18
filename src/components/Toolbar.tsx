// 上部ツールバー(10.1): 新規、開く、保存、背景読込、モード切替、ズーム

import { useRef, type ChangeEvent, type Dispatch } from "react";
import type { Action, AppState, ToolMode } from "../state/appState";
import { deserializeProject, serializeProject } from "../core/project";
import { zoomAt } from "../core/transform";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onNotice: (message: string) => void;
}

export function Toolbar({ state, dispatch, onNotice }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const { project, mode, saveState } = state;

  function handleNew() {
    if (
      saveState === "dirty" &&
      !window.confirm("未保存の変更があります。新規プロジェクトを作成しますか?")
    ) {
      return;
    }
    dispatch({ type: "NEW_PROJECT" });
  }

  function handleImageSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      // PDF読み込み(FR-011)はPhase 1でPDF.jsにより対応する
      onNotice("PNGまたはJPEG画像を選択してください(PDF対応はPhase 1で実装予定)");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => onNotice("画像の読み込みに失敗しました");
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => onNotice("画像を解析できません。別のファイルを試してください");
      img.onload = () => {
        dispatch({
          type: "SET_BACKGROUND",
          imageDataUrl: dataUrl,
          naturalWidthPx: img.naturalWidth,
          naturalHeightPx: img.naturalHeight,
        });
        onNotice("背景を読み込みました。「校正」で2点と実距離を指定してください。");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
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
      } catch (err) {
        // 破損ファイルでもクラッシュさせない(NFR-013、AC-014)
        onNotice(err instanceof Error ? err.message : "プロジェクトを開けません");
      }
    };
    reader.readAsText(file);
  }

  function handleSave() {
    const json = serializeProject(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "stage-layout"}.stage.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: "MARK_SAVED" });
  }

  function setMode(next: ToolMode) {
    dispatch({ type: "SET_MODE", mode: mode === next ? "select" : next });
  }

  function zoomBy(factor: number) {
    const next = Math.min(2, Math.max(0.005, project.view.zoom * factor));
    dispatch({
      type: "SET_VIEW",
      view: zoomAt(project.view, { x: 480, y: 320 }, next),
    });
  }

  const modeButton = (m: ToolMode, label: string) => (
    <button
      type="button"
      className={mode === m ? "active" : ""}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <header className="toolbar">
      <input
        className="project-name"
        value={project.name}
        onChange={(e) => dispatch({ type: "SET_PROJECT_NAME", name: e.target.value })}
        aria-label="プロジェクト名"
      />
      <button type="button" onClick={handleNew}>新規</button>
      <button type="button" onClick={() => projectInputRef.current?.click()}>開く</button>
      <button type="button" onClick={handleSave}>保存(JSON)</button>
      <span className="separator" />
      <button type="button" onClick={() => imageInputRef.current?.click()}>背景読込</button>
      <span className="separator" />
      {modeButton("calibrate", "校正")}
      {modeButton("measure", "測定")}
      <span className="separator" />
      <button type="button" onClick={() => zoomBy(1.25)}>拡大</button>
      <button type="button" onClick={() => zoomBy(1 / 1.25)}>縮小</button>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={handleImageSelected}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleProjectSelected}
      />
    </header>
  );
}
