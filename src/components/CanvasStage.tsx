// 中央キャンバス(10.1)。SVG第一候補(第12章)。
// ポインター入力はPointer Events APIで統一し(12.1)、
// 取得したpx座標は直ちにmmへ逆変換して扱う(9.4)。

import { useRef, type Dispatch, type PointerEvent, type WheelEvent } from "react";
import type { PointMm, SceneObject } from "../types/project";
import {
  displayedPxToSourcePx,
  getBackgroundDisplaySizePx,
  getEffectiveCrop,
  imagePxToMm,
  mmDistance,
  mmToImagePx,
  screenToMm,
  sourcePxToDisplayedPx,
  zoomAt,
  type ScreenPoint,
} from "../core/transform";
import { effectiveMmPerPixel, type Action, type AppState } from "../state/appState";
import { findPreset } from "../core/presets";
import { generateId, DEFAULT_LAYER_ID } from "../core/project";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onCursorMm: (p: PointMm | null) => void;
  onNotice: (message: string) => void;
}

type DragState =
  | { kind: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { kind: "move"; id: string; offsetXMm: number; offsetYMm: number };

function backgroundRotationTransform(
  rotationDeg: 0 | 90 | 180 | 270,
  cropWidthMm: number,
  cropHeightMm: number,
): string {
  switch (rotationDeg) {
    case 90:
      return `translate(${cropHeightMm} 0) rotate(90)`;
    case 180:
      return `translate(${cropWidthMm} ${cropHeightMm}) rotate(180)`;
    case 270:
      return `translate(0 ${cropWidthMm}) rotate(270)`;
    default:
      return "";
  }
}

export function CanvasStage({ state, dispatch, onCursorMm, onNotice }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const { project, mode, selectedId, pendingPresetId } = state;
  const { view, background, calibration } = project;
  const mmpp = effectiveMmPerPixel(project);
  const calibrated = calibration.mmPerPixel !== null;
  const crop = getEffectiveCrop(background);
  const displaySize = getBackgroundDisplaySizePx(background);
  const cropWidthMm = crop.widthPx * mmpp;
  const cropHeightMm = crop.heightPx * mmpp;

  function toScreen(e: PointerEvent | WheelEvent): ScreenPoint {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextZoom = Math.min(2, Math.max(0.005, view.zoom * factor));
    dispatch({ type: "SET_VIEW", view: zoomAt(view, toScreen(e), nextZoom) });
  }

  function placePreset(pMm: PointMm) {
    if (!pendingPresetId) return;
    if (!calibrated) {
      // 未校正状態では実寸配置を禁止する(6.1、AC-013)
      onNotice("未校正のため配置できません。先に「校正」で2点と実距離を指定してください。");
      return;
    }
    const preset = findPreset(pendingPresetId);
    if (!preset) return;
    const object: SceneObject = {
      id: generateId("obj"),
      type: preset.type,
      presetId: preset.id,
      name: preset.name,
      xMm: Math.round(pMm.xMm),
      yMm: Math.round(pMm.yMm),
      widthMm: preset.widthMm,
      depthMm: preset.depthMm,
      heightMm: preset.heightMm,
      rotationDeg: 0,
      label: preset.type === "riser" ? `段高${preset.heightMm}mm` : "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: DEFAULT_LAYER_ID,
      zIndex: project.objects.length,
      shape: preset.shape,
    };
    dispatch({ type: "ADD_OBJECT", object });
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    const pMm = screenToMm(screen, view);
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // 既に解放済みのポインター等では失敗しうるが、操作自体は続行できる
    }

    if (mode === "calibrate" || mode === "verifyCalibration") {
      const displayedPx = mmToImagePx(pMm, mmpp);
      // 校正点は元画像pxで保存し、切り抜き・90度回転後も同一点を再利用する。
      dispatch({
        type: "ADD_CALIB_POINT",
        point: displayedPxToSourcePx(displayedPx, background),
      });
      return;
    }
    if (mode === "measure") {
      dispatch({ type: "ADD_MEASURE_POINT", point: pMm });
      return;
    }
    if (pendingPresetId) {
      placePreset(pMm);
      return;
    }
    // 対象オブジェクトの探索はイベント委譲(data-object-id)で行う
    const target = (e.target as Element).closest("[data-object-id]");
    const objectId = target?.getAttribute("data-object-id") ?? null;
    if (objectId) {
      dispatch({ type: "SELECT", id: objectId });
      const obj = project.objects.find((o) => o.id === objectId);
      if (obj && !obj.locked) {
        dragRef.current = {
          kind: "move",
          id: objectId,
          offsetXMm: pMm.xMm - obj.xMm,
          offsetYMm: pMm.yMm - obj.yMm,
        };
      }
      return;
    }
    dispatch({ type: "SELECT", id: null });
    dragRef.current = {
      kind: "pan",
      startX: screen.x,
      startY: screen.y,
      startPanX: view.panX,
      startPanY: view.panY,
    };
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    onCursorMm(calibrated ? screenToMm(screen, view) : null);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      dispatch({
        type: "SET_VIEW",
        view: {
          ...view,
          panX: drag.startPanX + (screen.x - drag.startX),
          panY: drag.startPanY + (screen.y - drag.startY),
        },
      });
    } else {
      const pMm = screenToMm(screen, view);
      dispatch({
        type: "MOVE_OBJECT",
        id: drag.id,
        xMm: Math.round(pMm.xMm - drag.offsetXMm),
        yMm: Math.round(pMm.yMm - drag.offsetYMm),
      });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  const sortedObjects = [...project.objects]
    .filter((o) => o.visible)
    .sort((a, b) => a.zIndex - b.zIndex);
  const [mA, mB] = state.measurePointsMm;

  return (
    <svg
      ref={svgRef}
      className="canvas-stage"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => onCursorMm(null)}
    >
      <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
        {background.imageDataUrl && background.visible && (
          <g
            transform={backgroundRotationTransform(background.rotationDeg, cropWidthMm, cropHeightMm)}
            data-background-size={`${displaySize.widthPx}x${displaySize.heightPx}`}
          >
            <svg
              x={0}
              y={0}
              width={cropWidthMm}
              height={cropHeightMm}
              viewBox={`${crop.xPx} ${crop.yPx} ${crop.widthPx} ${crop.heightPx}`}
              preserveAspectRatio="none"
              overflow="visible"
              pointerEvents="none"
            >
              <image
                href={background.imageDataUrl}
                x={0}
                y={0}
                width={background.naturalWidthPx}
                height={background.naturalHeightPx}
                opacity={background.opacity}
                preserveAspectRatio="none"
              />
            </svg>
          </g>
        )}

        {sortedObjects.map((o) => (
          <g
            key={o.id}
            data-object-id={o.id}
            className={`scene-object${o.id === selectedId ? " selected" : ""}${o.locked ? " locked" : ""}`}
            transform={`translate(${o.xMm} ${o.yMm}) rotate(${o.rotationDeg})`}
          >
            {o.shape === "circle" ? (
              <ellipse rx={o.widthMm / 2} ry={o.depthMm / 2} />
            ) : (
              <rect
                x={-o.widthMm / 2}
                y={-o.depthMm / 2}
                width={o.widthMm}
                height={o.depthMm}
              />
            )}
            {/* 向きあり形状の前方向インジケータ */}
            {(o.type === "chair" || o.type === "musicStand") && (
              <line x1={0} y1={0} x2={0} y2={-o.depthMm / 2} className="facing" />
            )}
            <text y={o.depthMm / 2 + 320} textAnchor="middle">
              {o.label || o.name}
            </text>
          </g>
        ))}

        {/* 校正打点の表示。保存点は元画像px、描画時だけ表示画像pxへ変換する。 */}
        {state.calibPointsPx.map((p, i) => {
          const displayed = sourcePxToDisplayedPx(p, background);
          const pm = imagePxToMm(displayed, mmpp);
          return (
            <circle
              key={i}
              className="calib-point"
              cx={pm.xMm}
              cy={pm.yMm}
              r={8 / view.zoom}
            />
          );
        })}
        {state.calibPointsPx.length === 2 &&
          (() => {
            const a = imagePxToMm(sourcePxToDisplayedPx(state.calibPointsPx[0], background), mmpp);
            const b = imagePxToMm(sourcePxToDisplayedPx(state.calibPointsPx[1], background), mmpp);
            return (
              <line
                className="calib-line"
                x1={a.xMm}
                y1={a.yMm}
                x2={b.xMm}
                y2={b.yMm}
              />
            );
          })()}

        {/* 測定(FR-031) */}
        {mA && (
          <circle className="measure-point" cx={mA.xMm} cy={mA.yMm} r={6 / view.zoom} />
        )}
        {mA && mB && (
          <>
            <line
              className="measure-line"
              x1={mA.xMm}
              y1={mA.yMm}
              x2={mB.xMm}
              y2={mB.yMm}
            />
            <circle className="measure-point" cx={mB.xMm} cy={mB.yMm} r={6 / view.zoom} />
            <text
              className="measure-text"
              x={(mA.xMm + mB.xMm) / 2}
              y={(mA.yMm + mB.yMm) / 2 - 200}
              textAnchor="middle"
            >
              {`${Math.round(mmDistance(mA, mB))} mm`}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
