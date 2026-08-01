import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import { CHAIR_MUSIC_STAND_SET_PRESET_ID, type ObjectPreset } from "../core/presets";
import { PresetSymbol } from "./LibraryPanel";

interface Props {
  preset: ObjectPreset;
  state: AppState;
  dispatch: Dispatch<Action>;
  canPlace: boolean;
}

function ChairMusicStandSetSymbol() {
  return (
    <span className="symbol-preview" aria-hidden="true">
      <svg className="library-symbol-svg" viewBox="0 0 480 1000" preserveAspectRatio="xMidYMid meet">
        <path d="M45 50 L435 50 L360 240 L120 240 Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="18" strokeLinejoin="round" />
        <line x1="240" y1="240" x2="240" y2="400" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
        <line x1="170" y1="425" x2="310" y2="425" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
        <circle cx="240" cy="775" r="225" fill="#fff" stroke="currentColor" strokeWidth="18" />
      </svg>
    </span>
  );
}

export function LibraryPresetCard({ preset, state, dispatch, canPlace }: Props) {
  const active = state.pendingPresetId === preset.id;
  const favorite = state.libraryPreferences.favoritePresetIds.includes(preset.id);
  const isChairMusicStandSet = preset.id === CHAIR_MUSIC_STAND_SET_PRESET_ID;
  return (
    <li>
      <div className="library-preset-row">
        <button
          type="button"
          className={`library-preset-card${active ? " active" : ""}`}
          disabled={!canPlace}
          onClick={() => dispatch({ type: "SET_PENDING_PRESET", presetId: active ? null : preset.id })}
          aria-pressed={active}
          aria-label={`${preset.name}、${preset.isGroupPreset ? "構成物をまとめて" : `${preset.widthMm}×${preset.depthMm}mmを`}配置`}
          title={`${preset.name}　${preset.widthMm}×${preset.depthMm}mm${preset.isGroupPreset ? "・一括配置" : ""}`}
        >
          {isChairMusicStandSet ? <ChairMusicStandSetSymbol /> : <PresetSymbol preset={preset} />}
          <span className="library-card-copy">
            <strong>{preset.name}</strong>
            <span>{preset.isGroupPreset ? "構成物をまとめて配置" : `${preset.widthMm} × ${preset.depthMm} mm`}</span>
          </span>
          <span className="library-card-action" aria-hidden="true">＋</span>
        </button>
        <button
          type="button"
          className={`library-favorite-toggle${favorite ? " active" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_LIBRARY_FAVORITE", presetId: preset.id })}
          aria-pressed={favorite}
          aria-label={favorite ? `${preset.name}をお気に入りから解除` : `${preset.name}をお気に入りに登録`}
          title={favorite ? "お気に入りから解除" : "お気に入りに登録"}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
    </li>
  );
}
