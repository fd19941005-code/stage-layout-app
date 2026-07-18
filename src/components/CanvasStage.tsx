// 中央キャンバス(10.1)。SVG第一候補(第12章)。
// ポインター入力はPointer Events APIで統一し(12.1)。1本指の編集と
// 2本指のパン/ピンチを同じイベント列から判定する(iPad Safari対応)。

import { useRef, useState, type Dispatch, type PointerEvent, type WheelEvent } from "react";
import type { PointMm, SceneObject, ViewState } from "../types/project";
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
import { effectiveMmPerPixel, type Action, type AppState, type ObjectMove } from "../state/appState";
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
  | { kind: "move"; startMm: PointMm; startPositions: ObjectMove[] }
  | { kind: "rotate"; id: string; centerMm: PointMm }
  | { kind: "marquee"; startMm: PointMm }
  | { kind: "pinch"; startDistance: number; startCenter: ScreenPoint; anchorMm: PointMm; startView: ViewState };

interface MarqueeMm {
  startMm: PointMm;
  currentMm: PointMm;
}

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

function pointerMetrics(points: ReadonlyMap<number, ScreenPoint>) {
  const entries = [...points.values()];
  const first = entries[0];
  const second = entries[1];
  if (!first || !second) return null;
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
  };
}

function snapRotation(deg: number): number {
  return Math.round(deg / 15) * 15;
}

export function CanvasStage({ state, dispatch, onCursorMm, onNotice }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, ScreenPoint>());
  const [marquee, setMarquee] = useState<MarqueeMm | null>(null);

  const { project, mode, selectedIds, pendingPresetId } = state;
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

  function beginPinch() {
    const metrics = pointerMetrics(pointersRef.current);
    if (!metrics) return;
    dragRef.current = {
      kind: "pinch",
      startDistance: metrics.distance,
      startCenter: metrics.center,
      anchorMm: screenToMm(metrics.center, view),
      startView: view,
    };
    setMarquee(null);
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    const screen = toScreen(e);
    pointersRef.current.set(e.pointerId, screen);
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // 既に解放済みのポインター等では失敗しうるが、操作自体は続行できる
    }
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    const pMm = screenToMm(screen, view);
    if (mode === "calibrate" || mode === "verifyCalibration") {
      const displayedPx = mmToImagePx(pMm, mmpp);
      dispatch({ type: "ADD_CALIB_POINT", point: displayedPxToSourcePx(displayedPx, background) });
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

    const target = (e.target as Element).closest("[data-object-id]");
    const rotateTarget = (e.target as Element).closest("[data-rotate-handle]");
    if (rotateTarget) {
      const id = rotateTarget.getAttribute("data-object-id");
      const object = project.objects.find((item) => item.id === id);
      if (object && !object.locked) {
        dispatch({ type: "SELECT", id });
        dragRef.current = { kind: "rotate", id: object.id, centerMm: { xMm: object.xMm, yMm: object.yMm } };
      }
      return;
    }
    const objectId = target?.getAttribute("data-object-id") ?? null;
    if (objectId) {
      dispatch({ type: "SELECT", id: objectId, additive: e.shiftKey || e.ctrlKey || e.metaKey });
      const object = project.objects.find((item) => item.id === objectId);
      if (object && !object.locked && mode === "select") {
        const ids = (selectedIds.includes(objectId) ? selectedIds : [objectId]).filter((id) =>
          project.objects.some((item) => item.id === id && !item.locked),
        );
        dragRef.current = {
          kind: "move",
          startMm: pMm,
          startPositions: project.objects.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, xMm: item.xMm, yMm: item.yMm })),
        };
      }
      return;
    }

    if (mode === "selectRect") {
      setMarquee({ startMm: pMm, currentMm: pMm });
      dragRef.current = { kind: "marquee", startMm: pMm };
      return;
    }
    dispatch({ type: "SELECT", id: null });
    dragRef.current = { kind: "pan", startX: screen.x, startY: screen.y, startPanX: view.panX, startPanY: view.panY };
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    pointersRef.current.set(e.pointerId, screen);
    onCursorMm(calibrated ? screenToMm(screen, view) : null);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pinch") {
      const metrics = pointerMetrics(pointersRef.current);
      if (!metrics) return;
      const nextZoom = Math.min(2, Math.max(0.005, drag.startView.zoom * metrics.distance / drag.startDistance));
      dispatch({
        type: "SET_VIEW",
        view: {
          zoom: nextZoom,
          panX: metrics.center.x - drag.anchorMm.xMm * nextZoom,
          panY: metrics.center.y - drag.anchorMm.yMm * nextZoom,
        },
      });
      return;
    }
    const pMm = screenToMm(screen, view);
    if (drag.kind === "pan") {
      dispatch({ type: "SET_VIEW", view: { ...view, panX: drag.startPanX + screen.x - drag.startX, panY: drag.startPanY + screen.y - drag.startY } });
    } else if (drag.kind === "move") {
      const deltaX = pMm.xMm - drag.startMm.xMm;
      const deltaY = pMm.yMm - drag.startMm.yMm;
      dispatch({ type: "MOVE_OBJECTS", preview: true, moves: drag.startPositions.map((position) => ({ id: position.id, xMm: position.xMm + deltaX, yMm: position.yMm + deltaY })) });
    } else if (drag.kind === "rotate") {
      const angle = (Math.atan2(pMm.yMm - drag.centerMm.yMm, pMm.xMm - drag.centerMm.xMm) * 180) / Math.PI + 90;
      dispatch({ type: "ROTATE_OBJECT", id: drag.id, rotationDeg: snapRotation(angle), preview: true });
    } else if (drag.kind === "marquee") {
      setMarquee({ startMm: drag.startMm, currentMm: pMm });
    }
  }

  function handlePointerUp(e: PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pinch") {
      if (pointersRef.current.size < 2) dragRef.current = null;
      return;
    }
    if (drag.kind === "move" || drag.kind === "rotate") {
      dispatch({ type: "COMMIT_TRANSIENT_EDIT" });
    } else if (drag.kind === "marquee" && marquee) {
      const minXMm = Math.min(marquee.startMm.xMm, marquee.currentMm.xMm);
      const maxXMm = Math.max(marquee.startMm.xMm, marquee.currentMm.xMm);
      const minYMm = Math.min(marquee.startMm.yMm, marquee.currentMm.yMm);
      const maxYMm = Math.max(marquee.startMm.yMm, marquee.currentMm.yMm);
      dispatch({ type: "SELECT_RECT", bounds: { minXMm, minYMm, maxXMm, maxYMm }, additive: e.shiftKey || e.ctrlKey || e.metaKey });
      setMarquee(null);
    }
    dragRef.current = null;
  }

  function handlePointerCancel(e: PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    if (dragRef.current?.kind === "move" || dragRef.current?.kind === "rotate") dispatch({ type: "COMMIT_TRANSIENT_EDIT" });
    dragRef.current = null;
    setMarquee(null);
  }

  const sortedObjects = [...project.objects].filter((object) => object.visible).sort((a, b) => a.zIndex - b.zIndex);
  const [mA, mB] = state.measurePointsMm;
  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.startMm.xMm, marquee.currentMm.xMm),
        y: Math.min(marquee.startMm.yMm, marquee.currentMm.yMm),
        width: Math.abs(marquee.currentMm.xMm - marquee.startMm.xMm),
        height: Math.abs(marquee.currentMm.yMm - marquee.startMm.yMm),
      }
    : null;

  return (
    <svg ref={svgRef} className="canvas-stage" onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onPointerLeave={() => onCursorMm(null)}>
      <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
        {background.imageDataUrl && background.visible && (
          <g transform={backgroundRotationTransform(background.rotationDeg, cropWidthMm, cropHeightMm)} data-background-size={`${displaySize.widthPx}x${displaySize.heightPx}`}>
            <svg x={0} y={0} width={cropWidthMm} height={cropHeightMm} viewBox={`${crop.xPx} ${crop.yPx} ${crop.widthPx} ${crop.heightPx}`} preserveAspectRatio="none" overflow="visible" pointerEvents="none">
              <image href={background.imageDataUrl} x={0} y={0} width={background.naturalWidthPx} height={background.naturalHeightPx} opacity={background.opacity} preserveAspectRatio="none" />
            </svg>
          </g>
        )}

        {sortedObjects.map((object) => (
          <g key={object.id} data-object-id={object.id} className={`scene-object${selectedIds.includes(object.id) ? " selected" : ""}${object.locked ? " locked" : ""}`} transform={`translate(${object.xMm} ${object.yMm}) rotate(${object.rotationDeg})`}>
            {object.shape === "circle" ? <ellipse rx={object.widthMm / 2} ry={object.depthMm / 2} /> : <rect x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
            {(object.type === "chair" || object.type === "musicStand") && <line x1={0} y1={0} x2={0} y2={-object.depthMm / 2} className="facing" />}
            <text y={object.depthMm / 2 + 320} textAnchor="middle">{object.label || object.name}</text>
            {selectedIds.includes(object.id) && !object.locked && mode === "select" && (
              <g className="rotate-handle" data-rotate-handle="true" data-object-id={object.id}>
                <line x1={0} y1={-object.depthMm / 2} x2={0} y2={-object.depthMm / 2 - 300} />
                <circle cx={0} cy={-object.depthMm / 2 - 300} r={110} />
              </g>
            )}
          </g>
        ))}

        {marqueeRect && <rect className="selection-marquee" x={marqueeRect.x} y={marqueeRect.y} width={marqueeRect.width} height={marqueeRect.height} />}

        {state.calibPointsPx.map((point, index) => {
          const displayed = sourcePxToDisplayedPx(point, background);
          const pm = imagePxToMm(displayed, mmpp);
          return <circle key={index} className="calib-point" cx={pm.xMm} cy={pm.yMm} r={8 / view.zoom} />;
        })}
        {state.calibPointsPx.length === 2 && (() => {
          const a = imagePxToMm(sourcePxToDisplayedPx(state.calibPointsPx[0], background), mmpp);
          const b = imagePxToMm(sourcePxToDisplayedPx(state.calibPointsPx[1], background), mmpp);
          return <line className="calib-line" x1={a.xMm} y1={a.yMm} x2={b.xMm} y2={b.yMm} />;
        })()}
        {mA && <circle className="measure-point" cx={mA.xMm} cy={mA.yMm} r={6 / view.zoom} />}
        {mA && mB && (
          <>
            <line className="measure-line" x1={mA.xMm} y1={mA.yMm} x2={mB.xMm} y2={mB.yMm} />
            <circle className="measure-point" cx={mB.xMm} cy={mB.yMm} r={6 / view.zoom} />
            <text className="measure-text" x={(mA.xMm + mB.xMm) / 2} y={(mA.yMm + mB.yMm) / 2 - 200} textAnchor="middle">{`${Math.round(mmDistance(mA, mB))} mm`}</text>
          </>
        )}
      </g>
    </svg>
  );
}
