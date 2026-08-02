// 左パネル: 実寸プリセットを図面記号として探して配置するギャラリー。
// シンボルはCanvasStage/exportと同じcore/symbols.tsを参照し、ここでは表示用にだけ描画する。

import { useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from "react";
import type { Action, AppState } from "../state/appState";
import type { UserTemplate } from "../types/userTemplate";
import { UserTemplateNameDialog } from "./UserTemplateNameDialog";
import { LibraryPresetCard } from "./LibraryPresetCard";
import { canPlaceObjects } from "../state/appState";
import { OBJECT_PRESETS, PRESET_CATEGORIES, type ObjectPreset } from "../core/presets";
import { favoritePresets as getFavoritePresets, filterLibraryPresets, normalizeLibraryQuery, orderLibraryPresets, recentPresets as getRecentPresets } from "../core/library";
import { getSymbolDefinition, SYMBOL_VIEW_BOX, symbolIdForPreset, symbolPaintProps, type SymbolNode } from "../core/symbols";
import "../symbol-library.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onClose?: () => void;
  onNotice?: (message: string) => void;
  onExportUserTemplates?: () => void;
  onImportUserTemplates?: () => void;
}

const ALL_CATEGORIES = "すべて";
const USER_TEMPLATE_CATEGORY = "ユーザーテンプレート";

const CATEGORY_META: Record<string, { mark: string; description: string }> = {
  "座席・譜面": { mark: "SEAT", description: "椅子・譜面台" },
  "指揮・平台": { mark: "STAGE", description: "平台・舞台備品" },
  "鍵盤": { mark: "KEY", description: "ピアノ・鍵盤" },
  "打楽器": { mark: "PERC", description: "打楽器・セット" },
  "大型弦・他": { mark: "BASS", description: "大型楽器・音響" },
  "汎用": { mark: "FORM", description: "任意形状" },
  [USER_TEMPLATE_CATEGORY]: { mark: "USER", description: "保存した配置セット" },
};

function categoryClass(category: string): string {
  if (category === "座席・譜面") return "seat";
  if (category === "指揮・平台") return "stage";
  if (category === "鍵盤") return "keys";
  if (category === "打楽器") return "percussion";
  if (category === "大型弦・他") return "strings";
  if (category === USER_TEMPLATE_CATEGORY) return "user";
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

export function PresetSymbol({ preset }: { preset: ObjectPreset }) {
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
      <svg className="library-symbol-svg" viewBox={definition?.viewBox ?? SYMBOL_VIEW_BOX} preserveAspectRatio={definition?.preserveAspectRatio ?? "xMidYMid meet"} style={style}>
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


export function LibraryPanel({ state, dispatch, onClose, onNotice, onExportUserTemplates, onImportUserTemplates }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [templateNameDialog, setTemplateNameDialog] = useState<UserTemplate | null>(null);
  const calibrated = canPlaceObjects(state.project);
  const activeLayer = state.project.layers.find((layer) => layer.id === state.activeLayerId);
  const canPlace = calibrated && Boolean(activeLayer?.visible) && !activeLayer?.locked;
  const hasPodium = state.project.objects.some((object) => object.type === "podium");
  const normalizedQuery = normalizeLibraryQuery(query);
  const filteredPresets = useMemo(
    () => filterLibraryPresets(OBJECT_PRESETS, normalizedQuery, activeCategory, ALL_CATEGORIES),
    [activeCategory, normalizedQuery],
  );
  const orderedPresets = useMemo(() => orderLibraryPresets(filteredPresets, state.libraryPreferences), [filteredPresets, state.libraryPreferences]);
  const favoriteItems = useMemo(() => getFavoritePresets(filteredPresets, state.libraryPreferences), [filteredPresets, state.libraryPreferences]);
  const recentItems = useMemo(() => getRecentPresets(filteredPresets, state.libraryPreferences).filter((preset) => !state.libraryPreferences.favoritePresetIds.includes(preset.id)), [filteredPresets, state.libraryPreferences]);
  const pinnedPresetIds = new Set(favoriteItems.map((preset) => preset.id));
  const filteredTemplates = useMemo(
    () => state.userTemplates.filter((template) =>
      (activeCategory === ALL_CATEGORIES || activeCategory === USER_TEMPLATE_CATEGORY)
      && template.name.toLocaleLowerCase().includes(normalizedQuery),
    ),
    [activeCategory, normalizedQuery, state.userTemplates],
  );

  const visibleCategories = activeCategory === ALL_CATEGORIES
    ? [...PRESET_CATEGORIES, USER_TEMPLATE_CATEGORY]
    : [activeCategory];
  const resultCount = filteredPresets.length + filteredTemplates.length;
  const renderPresetList = (items: readonly ObjectPreset[]) => (
    <ul className="library-preset-list">
      {items.map((preset) => <LibraryPresetCard key={preset.id} preset={preset} state={state} dispatch={dispatch} canPlace={canPlace} />)}
    </ul>
  );

  return (
    <aside className="library-panel symbol-library">
      <header className="library-header">
        <p className="library-kicker">STAGE MARKS / 実寸プリセット</p>
        <div className="library-title-row">
          <h2>シンボルライブラリ</h2>
          <span className="library-count" aria-label={`${resultCount}件表示`}>{resultCount}件</span>
          {onClose && <button type="button" className="panel-close" onClick={onClose} aria-label="キャンバスへ戻る">
            <span aria-hidden="true">×</span>
            <span className="panel-close-label">キャンバスへ戻る</span>
          </button>}
        </div>
        <p className="library-intro">小さな縮尺でも読める上面図記号。似た形の楽器は、名前と寸法を併記して取り違えを防ぎます。</p>
      </header>

      {!calibrated && <p className="hint library-warning">縮尺未設定のため配置できません。背景を読み込み、先に「縮尺合わせ」を実行してください。</p>}
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
        <label className="row placement-mode-toggle">
          <input
            type="checkbox"
            checked={state.placementFacePodium}
            disabled={!hasPodium}
            onChange={(event) => dispatch({ type: "SET_PLACEMENT_FACE_PODIUM", facePodium: event.target.checked })}
          />
          <span>指揮台へ向ける</span>
          <span className="placement-mode-caption">置いた瞬間に正面を合わせる</span>
        </label>
        <p className="hint placement-hint">
          {state.placementContinuous
            ? "同じプリセットを続けて配置します。終了はチェックを外すか「選択」を押します。"
            : "記号を選び、キャンバスをクリック／タップして配置します。Shiftを押している間だけ一時的に連続配置できます。"}
        </p>
        {!hasPodium && <p className="hint placement-hint">指揮台を1つ置くと「指揮台へ向ける」を使えます。</p>}
        {hasPodium && state.placementFacePodium && <p className="hint placement-hint">配置位置から最も近い指揮台へ正面を向けます。置いたあとの角度は個別に変更できます。</p>}
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
        {[...PRESET_CATEGORIES, USER_TEMPLATE_CATEGORY].map((category) => (
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

      {(activeCategory === ALL_CATEGORIES || activeCategory === USER_TEMPLATE_CATEGORY) && (
        <div className="user-template-file-actions" aria-label="ユーザーテンプレートのファイル操作">
          <button type="button" onClick={onExportUserTemplates} disabled={state.userTemplates.length === 0}>JSON書き出し</button>
          <button type="button" onClick={onImportUserTemplates}>JSON読み込み</button>
        </div>
      )}
      <div className="library-results-meta">
        <span>{resultCount}件表示</span>
        <span>クリックで配置</span>
      </div>
      {favoriteItems.length > 0 && (
        <section className="library-pinned-section category-favorite">
          <div className="library-group-heading">
            <span className="library-group-mark">FAV</span>
            <div><h3>お気に入り</h3><p>いつでも使えるプリセット</p></div>
            <span className="library-group-count">{favoriteItems.length}</span>
          </div>
          <ul className="library-preset-list">
            {favoriteItems.map((preset) => <LibraryPresetCard key={preset.id} preset={preset} state={state} dispatch={dispatch} favoriteNumber={state.libraryPreferences.favoritePresetIds.indexOf(preset.id) < 9 ? state.libraryPreferences.favoritePresetIds.indexOf(preset.id) + 1 : undefined} canPlace={canPlace} />)}
          </ul>
        </section>
      )}
      {recentItems.length > 0 && (
        <details className="library-pinned-section library-collapsible-section category-recent" open>
          <summary className="library-group-heading">
            <span className="library-group-mark">REC</span>
            <span className="library-group-copy"><strong>最近使用</strong><small>直近に配置したプリセット</small></span>
            <span className="library-group-count">{recentItems.length}</span>
          </summary>
          <ul className="library-preset-list">
            {recentItems.map((preset) => <LibraryPresetCard key={preset.id} preset={preset} state={state} dispatch={dispatch} canPlace={canPlace} />)}
          </ul>
        </details>
      )}

      {filteredPresets.length === 0 && filteredTemplates.length === 0 ? (
        <p className="library-empty">該当する記号がありません。検索語を短くするか、カテゴリを「すべて」に戻してください。</p>
      ) : (
        visibleCategories.map((category) => {
          const presets = orderedPresets.filter((preset) => preset.category === category && !pinnedPresetIds.has(preset.id));
          const templates = category === USER_TEMPLATE_CATEGORY ? filteredTemplates : [];
          if (presets.length === 0 && templates.length === 0) return null;
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
              {renderPresetList(presets)}
              {templates.length > 0 && (
                <ul className="library-preset-list user-template-list">
                  {templates.map((template) => (
                    <li key={template.id}>
                      <div className="user-template-card">
                        <button
                          type="button"
                          className={"library-preset-card user-template-placement-card" + (state.pendingUserTemplateId === template.id ? " active" : "")}
                          disabled={!canPlace}
                          onClick={() => dispatch({ type: "SET_PENDING_USER_TEMPLATE", templateId: state.pendingUserTemplateId === template.id ? null : template.id })}
                          aria-pressed={state.pendingUserTemplateId === template.id}
                          aria-label={template.name + "、" + template.objects.length + "個を一括配置"}
                        >
                          <span className="user-template-glyph" aria-hidden="true">▦</span>
                          <span className="library-card-copy">
                            <strong>{template.name}</strong>
                            <span>{template.objects.length}個 · 相対配置</span>
                          </span>
                          <span className="library-card-action" aria-hidden="true">＋</span>
                        </button>
                        <div className="user-template-actions">
                          <button type="button" onClick={() => setTemplateNameDialog(template)}>名前変更</button>
                          <button type="button" onClick={() => dispatch({ type: "DUPLICATE_USER_TEMPLATE", id: template.id })}>複製</button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              if (!window.confirm("このユーザーテンプレートを削除しますか？")) return;
                              dispatch({ type: "DELETE_USER_TEMPLATE", id: template.id });
                              onNotice?.("ユーザーテンプレートを削除しました");
                            }}
                          >削除</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
      {templateNameDialog && (
        <UserTemplateNameDialog
          title="ユーザーテンプレートの名前変更"
          initialName={templateNameDialog.name}
          onClose={() => setTemplateNameDialog(null)}
          onSubmit={(name) => {
            dispatch({ type: "RENAME_USER_TEMPLATE", id: templateNameDialog.id, name });
            setTemplateNameDialog(null);
            onNotice?.("ユーザーテンプレートの名前を変更しました");
          }}
        />
      )}
    </aside>
  );
}
