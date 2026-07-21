// 左パネル: 実寸プリセットを図面記号として探して配置するギャラリー。
// シンボルはCanvasStage/exportと同じcore/symbols.tsを参照し、ここでは表示用にだけ描画する。

import { useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from "react";
import type { Action, AppState } from "../state/appState";
import { canPlaceObjects } from "../state/appState";
import { OBJECT_PRESETS, PRESET_CATEGORIES, type ObjectPreset } from "../core/presets";
import { getSymbolDefinition, SYMBOL_VIEW_BOX, symbolIdForPreset, symbolPaintProps, type SymbolNode } from "../core/symbols";
import "../symbol-library.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onClose?: () => void;
}

const ALL_CATEGORIES = "すべて";

const CATEGORY_META: Record<string, { mark: string; description: string }> = {
  "座席・譜面": { mark: "SEAT", description: "椅子・譜面台" },
  "指揮・平台": { mark: "STAGE", description: "平台・舞台備品" },
  "鍵盤": { mark: "KEY", description: "ピアノ・鍵盤" },
  "打楽器": { mark: "PERC", description: "打楽器・セット" },
  "大型弦・他": { mark: "BASS", description: "大型楽器・音響" },
  "汎用": { mark: "FORM", description: "任意形状" },
};

function categoryClass(category: string): string {
  if (category === "座席・譜面") return "seat";
  if (category === "指揮・平台") return "stage";
  if (category === "鍵盤") return "keys";
  if (category === "打楽器") return "percussion";
  if (category === "大型弦・他") return "strings";
  return "generic";
}

function renderSymbolNode(node: SymbolNode, key: string): ReactNode {
  const paint = symbolPaintProps(node.paint);
  switch (node.kind) {
    case "rect":
      return <rect key={key} {...paint} x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} />;
    case "ellipse":
      return <ellipse key={key} {...paint} cx={node.cx} cy={node.cy} rx={node.rx} ry={node.ry} />;
    case "circle":
      return <circle key={key} {...paint} cx={node.cx} cy={node.cy} r={node.r} />;
    case "line":
      return <line key={key} {...paint} x1={node.x1} y1={node.y1} x2={node.x2} y2={node.y2} />;
    case "polyline":
      return <polyline key={key} {...paint} points={node.points.map((point) => `${point.x},${point.y}`).join(" ")} />;
    case "path":
      return <path key={key} {...paint} d={node.d} />;
  }
}

function PresetSymbol({ preset }: { preset: ObjectPreset }) {
  const symbolId = symbolIdForPreset(preset.id);
  const definition = symbolId ? getSymbolDefinition(symbolId) : undefined;
  const style = {
    "--symbol-body-opacity": "0.08",
    "--symbol-solid-opacity": "0.22",
    "--symbol-stroke-width": "18",
    "--symbol-detail-stroke-width": "14",
  } as CSSProperties;

  return (
    <span className="symbol-preview" aria-hidden="true">
      <svg className="library-symbol-svg" viewBox={definition?.viewBox ?? SYMBOL_VIEW_BOX} preserveAspectRatio={definition?.preserveAspectRatio ?? "none"} style={style}>
        {definition?.rawSvg
          ? <g className="stage-asset-preview" dangerouslySetInnerHTML={{ __html: definition.rawSvg }} />
          : definition
            ? definition.nodes.map((node, index) => renderSymbolNode(node, `${definition.id}-${index}`))
            : preset.shape === "circle"
            ? <ellipse className="generic-symbol-shape" cx="500" cy="500" rx="360" ry="360" />
            : <rect className="generic-symbol-shape" x="145" y="145" width="710" height="710" rx="38" />}
      </svg>
    </span>
  );
}

function matchesPreset(preset: ObjectPreset, query: string): boolean {
  if (!query) return true;
  const searchable = `${preset.name} ${preset.category} ${preset.widthMm} ${preset.depthMm}`.toLocaleLowerCase();
  return searchable.includes(query);
}

export function LibraryPanel({ state, dispatch, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const calibrated = canPlaceObjects(state.project);
  const activeLayer = state.project.layers.find((layer) => layer.id === state.activeLayerId);
  const canPlace = calibrated && Boolean(activeLayer?.visible) && !activeLayer?.locked;
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredPresets = useMemo(
    () => OBJECT_PRESETS.filter((preset) =>
      (activeCategory === ALL_CATEGORIES || preset.category === activeCategory)
      && matchesPreset(preset, normalizedQuery),
    ),
    [activeCategory, normalizedQuery],
  );

  const visibleCategories = activeCategory === ALL_CATEGORIES
    ? PRESET_CATEGORIES
    : [activeCategory];
  const symbolCount = filteredPresets.filter((preset) => symbolIdForPreset(preset.id) !== null).length;

  return (
    <aside className="library-panel symbol-library">
      <header className="library-header">
        <p className="library-kicker">STAGE MARKS / 実寸プリセット</p>
        <div className="library-title-row">
          <h2>シンボルライブラリ</h2>
          <span className="library-count" aria-label={`${filteredPresets.length}件表示`}>{filteredPresets.length}件</span>
          {onClose && <button type="button" className="panel-close" onClick={onClose} aria-label="ライブラリを閉じる">×</button>}
        </div>
        <p className="library-intro">小さな縮尺でも読める上面図記号。似た形の楽器は、名前と寸法を併記して取り違えを防ぎます。</p>
      </header>

      {!calibrated && <p className="hint library-warning">未校正のため配置できません。背景を読み込み、先に「校正」を実行してください。</p>}
      {calibrated && (!activeLayer?.visible || activeLayer.locked) && <p className="hint library-warning">配置先レイヤーが非表示またはロックされています。</p>}
      {calibrated && <p className="library-target">配置先 <strong>{activeLayer?.name ?? "—"}</strong></p>}

      <section className="placement-controls" aria-label="配置操作">
        <label className="row placement-mode-toggle">
          <input
            type="checkbox"
            checked={state.placementContinuous}
            onChange={(event) => dispatch({ type: "SET_PLACEMENT_CONTINUOUS", continuous: event.target.checked })}
          />
          <span>連続配置</span>
          <span className="placement-mode-caption">同じ記号を続けて置く</span>
        </label>
        <p className="hint placement-hint">
          {state.placementContinuous
            ? "同じプリセットを続けて配置します。終了はチェックを外すか「選択」を押します。"
            : "記号を選び、キャンバスをクリック／タップして配置します。Shiftを押している間だけ一時的に連続配置できます。"}
        </p>
        {state.pendingPresetId && (
          <p className="placement-status" role="status">
            配置待機中：キャンバスをクリック／タップして配置。取消は同じ記号をもう一度押すか「選択」。
          </p>
        )}
      </section>

      <label className="library-search">
        <span className="library-search-icon" aria-hidden="true">⌕</span>
        <span className="sr-only">記号を検索</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="楽器・備品を検索"
          aria-label="記号を検索"
        />
        {query && <button type="button" className="library-search-clear" onClick={() => setQuery("")} aria-label="検索をクリア">×</button>}
      </label>

      <div className="library-category-tabs" role="tablist" aria-label="記号カテゴリ">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === ALL_CATEGORIES}
          className={activeCategory === ALL_CATEGORIES ? "active" : ""}
          onClick={() => setActiveCategory(ALL_CATEGORIES)}
        >
          すべて
        </button>
        {PRESET_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={activeCategory === category}
            className={activeCategory === category ? "active" : ""}
            onClick={() => setActiveCategory(category)}
          >
            {CATEGORY_META[category]?.mark ?? category}
          </button>
        ))}
      </div>

      <div className="library-results-meta">
        <span>{symbolCount}種の図面記号</span>
        <span>クリックで配置</span>
      </div>

      {filteredPresets.length === 0 ? (
        <p className="library-empty">該当する記号がありません。検索語を短くするか、カテゴリを「すべて」に戻してください。</p>
      ) : (
        visibleCategories.map((category) => {
          const presets = filteredPresets.filter((preset) => preset.category === category);
          if (presets.length === 0) return null;
          const meta = CATEGORY_META[category] ?? { mark: "MARK", description: "図面記号" };
          return (
            <section key={category} className={`library-group category-${categoryClass(category)}`}>
              <div className="library-group-heading">
                <span className="library-group-mark">{meta.mark}</span>
                <div>
                  <h3>{category}</h3>
                  <p>{meta.description}</p>
                </div>
                <span className="library-group-count">{presets.length}</span>
              </div>
              <ul className="library-preset-list">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={`library-preset-card${state.pendingPresetId === preset.id ? " active" : ""}`}
                      disabled={!canPlace}
                      onClick={() => dispatch({ type: "SET_PENDING_PRESET", presetId: state.pendingPresetId === preset.id ? null : preset.id })}
                      aria-pressed={state.pendingPresetId === preset.id}
                      aria-label={`${preset.name}、${preset.widthMm}×${preset.depthMm}mmを配置`}
                      title={`${preset.name}　${preset.widthMm}×${preset.depthMm}mm`}
                    >
                      <PresetSymbol preset={preset} />
                      <span className="library-card-copy">
                        <strong>{preset.name}</strong>
                        <span>{preset.widthMm} × {preset.depthMm} mm</span>
                      </span>
                      <span className="library-card-action" aria-hidden="true">＋</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </aside>
  );
}
