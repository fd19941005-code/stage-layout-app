// 中央キャンバス(10.1)。SVG第一候補(第12章)。
// ポインター入力はPointer Events APIで統一し(12.1)。1本指の編集と
// 2本指のパン/ピンチを同じイベント列から判定する(iPad Safari対応)。

import { useRef, useState, type Dispatch, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import type { AnnotationKind, PointMm, SceneObject, Wall } from "../types/project";
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
import { snapPointMm } from "../core/snap";
import { generateId } from "../core/project";
import { SYMBOL_DEFINITIONS, SYMBOL_VIEW_BOX, symbolIdForPreset, symbolPaintProps, type SymbolNode } from "../core/symbols";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onCursorMm: (p: PointMm | null) => void;
  onNotice: (message: string) => void;
  wallDraft: PointMm[];
  onWallDraftChange: (points: PointMm[]) => void;
}

type DragState =
  | { kind: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { kind: "move"; startMm: PointMm; startPositions: ObjectMove[] }
  | { kind: "rotate"; id: string; centerMm: PointMm }
  | { kind: "marquee"; startMm: PointMm }
  | { kind: "annotation"; annotationKind: AnnotationKind; startMm: PointMm }
  | { kind: "pinch"; startDistance: number; startCenter: ScreenPoint; anchorMm: PointMm; startView: { zoom: number; panX: number; panY: number } };

interface AnnotationPreview {
  annotationKind: AnnotationKind;
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

function annotationKindForMode(mode: AppState["mode"]): AnnotationKind | null {
  switch (mode) {
    case "annotationText": return "text";
    case "annotationLine": return "line";
    case "annotationArrow": return "arrow";
    case "annotationRect": return "rect";
    case "annotationCircle": return "circle";
    case "annotationDimension": return "dimension";
    default: return null;
  }
}

function annotationName(kind: AnnotationKind): string {
  switch (kind) {
    case "text": return "文字注釈";
    case "line": return "線";
    case "arrow": return "矢印";
    case "rect": return "矩形注釈";
    case "circle": return "円注釈";
    case "dimension": return "寸法線";
  }
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
      return <polyline key={key} {...paint} points={node.points.map((point) => String(point.x) + "," + String(point.y)).join(" ")} />;
    case "path":
      return <path key={key} {...paint} d={node.d} />;
  }
}

function renderSymbolDefinition(definition: (typeof SYMBOL_DEFINITIONS)[number]) {
  return (
    <symbol key={definition.id} id={definition.id} viewBox={SYMBOL_VIEW_BOX} preserveAspectRatio="none">
      {definition.nodes.map((node, index) => renderSymbolNode(node, definition.id + "-" + index))}
    </symbol>
  );
}
export function CanvasStage({ state, dispatch, onCursorMm, onNotice, wallDraft, onWallDraftChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, ScreenPoint>());
  const [marquee, setMarquee] = useState<{ startMm: PointMm; currentMm: PointMm } | null>(null);
  const [annotationPreview, setAnnotationPreview] = useState<AnnotationPreview | null>(null);

  const { project, mode, selectedIds, pendingPresetId, placementContinuous } = state;
  const { view, background, calibration } = project;
  const mmpp = effectiveMmPerPixel(project);
  const calibrated = calibration.mmPerPixel !== null;
  const crop = getEffectiveCrop(background);
  const displaySize = getBackgroundDisplaySizePx(background);
  const cropWidthMm = crop.widthPx * mmpp;
  const cropHeightMm = crop.heightPx * mmpp;
  const stageWidthMm = displaySize.widthPx * mmpp;

  function toScreen(e: PointerEvent | WheelEvent): ScreenPoint {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function visibleObjects(excludeIds: readonly string[] = []): SceneObject[] {
    const excluded = new Set(excludeIds);
    return project.objects.filter((object) => {
      const layer = project.layers.find((candidate) => candidate.id === object.layerId);
      return object.visible && (layer?.visible ?? true) && !excluded.has(object.id);
    });
  }

  function snapPoint(point: PointMm, excludeIds: readonly string[] = []): PointMm {
    return snapPointMm(point, {
      settings: project.snapSettings,
      otherObjects: visibleObjects(excludeIds),
      stageWidthMm,
    });
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextZoom = Math.min(2, Math.max(0.005, view.zoom * factor));
    dispatch({ type: "SET_VIEW", view: zoomAt(view, toScreen(e), nextZoom) });
  }

  function placePreset(pMm: PointMm, keepPending: boolean) {
    if (!pendingPresetId) return;
    if (!calibrated) {
      onNotice("未校正のため配置できません。先に「校正」で2点と実距離を指定してください。");
      return;
    }
    const layer = project.layers.find((candidate) => candidate.id === state.activeLayerId);
    if (!layer || layer.locked || !layer.visible) {
      onNotice("配置先レイヤーが非表示またはロックされています。");
      return;
    }
    const preset = findPreset(pendingPresetId);
    if (!preset) return;
    const snapped = snapPoint(pMm);
    const object: SceneObject = {
      id: generateId("obj"),
      type: preset.type,
      presetId: preset.id,
      name: preset.name,
      xMm: Math.round(snapped.xMm),
      yMm: Math.round(snapped.yMm),
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
      layerId: state.activeLayerId,
      zIndex: project.objects.length,
      shape: preset.shape,
    };
    dispatch({ type: "ADD_OBJECT", object, keepPending });
  }

  function createAnnotation(annotationKind: AnnotationKind, start: PointMm, current: PointMm) {
    const startMm = snapPoint(start);
    const endMm = snapPoint(current);
    const deltaX = endMm.xMm - startMm.xMm;
    const deltaY = endMm.yMm - startMm.yMm;
    const isSegment = annotationKind === "line" || annotationKind === "arrow" || annotationKind === "dimension";
    const isText = annotationKind === "text";
    const annotationLayer = project.layers.find((layer) => layer.id === "layer-annotations")
      ?? project.layers.find((layer) => layer.id === state.activeLayerId);
    if (!annotationLayer) return;
    const object: SceneObject = {
      id: generateId("annotation"),
      type: isText ? "text" : "shape",
      presetId: null,
      name: annotationName(annotationKind),
      xMm: isSegment ? Math.round(startMm.xMm) : Math.round((startMm.xMm + endMm.xMm) / 2),
      yMm: isSegment ? Math.round(startMm.yMm) : Math.round((startMm.yMm + endMm.yMm) / 2),
      widthMm: isSegment ? 1 : isText ? 1000 : Math.max(1, Math.round(Math.abs(deltaX))),
      depthMm: isSegment ? 1 : isText ? 300 : Math.max(1, Math.round(Math.abs(deltaY))),
      heightMm: 0,
      rotationDeg: 0,
      label: annotationKind === "dimension" ? `${Math.round(mmDistance(startMm, endMm))} mm` : isText ? "注釈" : "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: annotationLayer.id,
      zIndex: project.objects.length,
      shape: annotationKind === "circle" ? "circle" : "rect",
      annotationKind,
      endXMm: isSegment ? Math.round(endMm.xMm) : null,
      endYMm: isSegment ? Math.round(endMm.yMm) : null,
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
    setAnnotationPreview(null);
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
    if (mode === "traceWall") {
      if (!calibrated) {
        onNotice("未校正のため壁トレースできません。先に校正してください。");
        return;
      }
      onWallDraftChange([...wallDraft, snapPoint(pMm)]);
      return;
    }
    if (mode === "calibrate" || mode === "verifyCalibration") {
      const displayedPx = mmToImagePx(pMm, mmpp);
      dispatch({ type: "ADD_CALIB_POINT", point: displayedPxToSourcePx(displayedPx, background) });
      return;
    }
    if (mode === "measure") {
      dispatch({ type: "ADD_MEASURE_POINT", point: pMm });
      return;
    }

    const annotationKind = annotationKindForMode(mode);
    if (annotationKind) {
      const annotationLayer = project.layers.find((candidate) => candidate.id === "layer-annotations")
        ?? project.layers.find((candidate) => candidate.id === state.activeLayerId);
      if (!annotationLayer || annotationLayer.locked || !annotationLayer.visible) {
        onNotice("注釈レイヤーが非表示またはロックされています。");
        return;
      }
      if (annotationKind === "text") {
        createAnnotation(annotationKind, pMm, pMm);
        dragRef.current = null;
        return;
      }
      const startMm = snapPoint(pMm);
      dragRef.current = { kind: "annotation", annotationKind, startMm };
      setAnnotationPreview({ annotationKind, startMm, currentMm: startMm });
      return;
    }

    if (pendingPresetId) {
      placePreset(pMm, placementContinuous || e.shiftKey);
      return;
    }

    const target = (e.target as Element).closest("[data-object-id]");
    const rotateTarget = (e.target as Element).closest("[data-rotate-handle]");
    if (rotateTarget) {
      const id = rotateTarget.getAttribute("data-object-id");
      const object = project.objects.find((item) => item.id === id);
      const layer = object && project.layers.find((candidate) => candidate.id === object.layerId);
      if (object && !object.locked && !layer?.locked) {
        dispatch({ type: "SELECT", id });
        dragRef.current = { kind: "rotate", id: object.id, centerMm: { xMm: object.xMm, yMm: object.yMm } };
      }
      return;
    }
    const objectId = target?.getAttribute("data-object-id") ?? null;
    if (objectId) {
      dispatch({ type: "SELECT", id: objectId, additive: e.shiftKey || e.ctrlKey || e.metaKey });
      const object = project.objects.find((item) => item.id === objectId);
      const layer = object && project.layers.find((candidate) => candidate.id === object.layerId);
      if (object && !object.locked && !layer?.locked && mode === "select") {
        const ids = (selectedIds.includes(objectId) ? selectedIds : [objectId]).filter((id) =>
          project.objects.some((item) => {
            const itemLayer = project.layers.find((candidate) => candidate.id === item.layerId);
            return item.id === id && !item.locked && !itemLayer?.locked;
          }),
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
      const primary = drag.startPositions[0];
      if (!primary) return;
      const deltaX = pMm.xMm - drag.startMm.xMm;
      const deltaY = pMm.yMm - drag.startMm.yMm;
      const snapped = snapPoint(
        { xMm: primary.xMm + deltaX, yMm: primary.yMm + deltaY },
        drag.startPositions.map((position) => position.id),
      );
      const snappedDeltaX = snapped.xMm - primary.xMm;
      const snappedDeltaY = snapped.yMm - primary.yMm;
      dispatch({ type: "MOVE_OBJECTS", preview: true, moves: drag.startPositions.map((position) => ({ id: position.id, xMm: position.xMm + snappedDeltaX, yMm: position.yMm + snappedDeltaY })) });
    } else if (drag.kind === "rotate") {
      const angle = (Math.atan2(pMm.yMm - drag.centerMm.yMm, pMm.xMm - drag.centerMm.xMm) * 180) / Math.PI + 90;
      dispatch({ type: "ROTATE_OBJECT", id: drag.id, rotationDeg: snapRotation(angle), preview: true });
    } else if (drag.kind === "marquee") {
      setMarquee({ startMm: drag.startMm, currentMm: pMm });
    } else if (drag.kind === "annotation") {
      const currentMm = snapPoint(pMm);
      setAnnotationPreview({ annotationKind: drag.annotationKind, startMm: drag.startMm, currentMm });
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
    } else if (drag.kind === "annotation" && annotationPreview) {
      createAnnotation(drag.annotationKind, annotationPreview.startMm, annotationPreview.currentMm);
      setAnnotationPreview(null);
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
    setAnnotationPreview(null);
  }

  const sortedObjects = visibleObjects().sort((a, b) => a.zIndex - b.zIndex);
  const [mA, mB] = state.measurePointsMm;
  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.startMm.xMm, marquee.currentMm.xMm),
        y: Math.min(marquee.startMm.yMm, marquee.currentMm.yMm),
        width: Math.abs(marquee.currentMm.xMm - marquee.startMm.xMm),
        height: Math.abs(marquee.currentMm.yMm - marquee.currentMm.yMm),
      }
    : null;

  function renderWall(wall: Wall) {
    const pointString = wall.points.map((point) => String(point.xMm) + "," + String(point.yMm)).join(" ");
    return (
      <g key={wall.id} className="wall-trace" pointerEvents="none">
        <polyline points={pointString} />
        {wall.closed && wall.points[0] && <line x1={wall.points[wall.points.length - 1].xMm} y1={wall.points[wall.points.length - 1].yMm} x2={wall.points[0].xMm} y2={wall.points[0].yMm} />}
        {wall.points.map((point, index) => <circle key={wall.id + "-" + index} cx={point.xMm} cy={point.yMm} r={55} />)}
      </g>
    );
  }

  function renderWallDraft() {
    if (wallDraft.length === 0) return null;
    const pointString = wallDraft.map((point) => String(point.xMm) + "," + String(point.yMm)).join(" ");
    return (
      <g className="wall-trace draft" pointerEvents="none">
        <polyline points={pointString} />
        {wallDraft.map((point, index) => <circle key={"draft-" + index} cx={point.xMm} cy={point.yMm} r={70} />)}
      </g>
    );
  }

  function renderAnnotation(object: SceneObject) {
    const kind = object.annotationKind;
    if (kind === "text") return <text className="annotation-text" x={0} y={0}>{object.label || "注釈"}</text>;
    if (kind === "line" || kind === "arrow" || kind === "dimension") {
      const endX = (object.endXMm ?? object.xMm + object.widthMm) - object.xMm;
      const endY = (object.endYMm ?? object.yMm) - object.yMm;
      return (
        <>
          <line className={`annotation-line ${kind}`} x1={0} y1={0} x2={endX} y2={endY} markerEnd={kind === "arrow" ? "url(#canvas-arrow)" : undefined} />
          {kind === "dimension" && <text className="annotation-dimension-label" x={endX / 2} y={endY / 2 - 120} textAnchor="middle">{object.label || `${Math.round(Math.hypot(endX, endY))} mm`}</text>}
        </>
      );
    }
    return object.shape === "circle"
      ? <ellipse className={`annotation-shape ${kind}`} rx={object.widthMm / 2} ry={object.depthMm / 2} />
      : <rect className={`annotation-shape ${kind}`} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />;
  }

  function renderObject(object: SceneObject) {
    const layer = project.layers.find((candidate) => candidate.id === object.layerId);
    const editable = !object.locked && !layer?.locked;
    const isAnnotation = object.annotationKind !== null && object.annotationKind !== undefined;
    const symbolId = !isAnnotation ? symbolIdForPreset(object.presetId) : null;
    const displayLabel = object.label || (symbolId ? "" : object.name);
    return (
      <g key={object.id} data-object-id={object.id} className={`scene-object${symbolId ? " symbol-object" : ""}${isAnnotation ? " annotation-object" : ""}${selectedIds.includes(object.id) ? " selected" : ""}${object.locked || layer?.locked ? " locked" : ""}`} transform={`translate(${object.xMm} ${object.yMm}) rotate(${object.rotationDeg})`}>
        {isAnnotation ? renderAnnotation(object) : (
          <>
            {symbolId
              ? <use className="symbol-use" href={"#" + symbolId} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />
              : <>
                  {object.shape === "circle" ? <ellipse rx={object.widthMm / 2} ry={object.depthMm / 2} /> : <rect x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
                  {(object.type === "chair" || object.type === "musicStand") && <line x1={0} y1={0} x2={0} y2={-object.depthMm / 2} className="facing" />}
                </>}
            {displayLabel && <text y={object.depthMm / 2 + 320} textAnchor="middle">{displayLabel}</text>}
          </>
        )}
        {selectedIds.includes(object.id) && editable && !isAnnotation && mode === "select" && (
          <g className="rotate-handle" data-rotate-handle="true" data-object-id={object.id}>
            <line x1={0} y1={-object.depthMm / 2} x2={0} y2={-object.depthMm / 2 - 300} />
            <circle cx={0} cy={-object.depthMm / 2 - 300} r={110} />
          </g>
        )}
      </g>
    );
  }

  function renderAnnotationPreview() {
    if (!annotationPreview) return null;
    const { annotationKind, startMm, currentMm } = annotationPreview;
    if (annotationKind === "line" || annotationKind === "arrow" || annotationKind === "dimension") {
      return <line className="annotation-preview" x1={startMm.xMm} y1={startMm.yMm} x2={currentMm.xMm} y2={currentMm.yMm} markerEnd={annotationKind === "arrow" ? "url(#canvas-arrow)" : undefined} />;
    }
    const x = Math.min(startMm.xMm, currentMm.xMm);
    const y = Math.min(startMm.yMm, currentMm.yMm);
    const width = Math.max(1, Math.abs(currentMm.xMm - startMm.xMm));
    const height = Math.max(1, Math.abs(currentMm.yMm - startMm.yMm));
    return annotationKind === "circle"
      ? <ellipse className="annotation-preview" cx={(startMm.xMm + currentMm.xMm) / 2} cy={(startMm.yMm + currentMm.yMm) / 2} rx={width / 2} ry={height / 2} />
      : <rect className="annotation-preview" x={x} y={y} width={width} height={height} />;
  }

  return (
    <svg
      ref={svgRef}
      className="canvas-stage"
      tabIndex={0}
      role="application"
      aria-label="舞台配置キャンバス。選択中は矢印キーで10mm移動、Shift+矢印で100mm移動"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => onCursorMm(null)}
    >
      <defs>
        <marker id="canvas-arrow" markerWidth="160" markerHeight="160" refX="120" refY="60" orient="auto">
          <path d="M0,0 L120,60 L0,120 z" fill="#d12f2f" />
        </marker>
        {SYMBOL_DEFINITIONS.map(renderSymbolDefinition)}
      </defs>
      <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
        {background.imageDataUrl && background.visible && project.layers.find((layer) => layer.id === "layer-background")?.visible !== false && (
          <g transform={backgroundRotationTransform(background.rotationDeg, cropWidthMm, cropHeightMm)} data-background-size={`${displaySize.widthPx}x${displaySize.heightPx}`}>
            <svg x={0} y={0} width={cropWidthMm} height={cropHeightMm} viewBox={`${crop.xPx} ${crop.yPx} ${crop.widthPx} ${crop.heightPx}`} preserveAspectRatio="none" overflow="visible" pointerEvents="none">
              <image href={background.imageDataUrl} x={0} y={0} width={background.naturalWidthPx} height={background.naturalHeightPx} opacity={background.opacity} preserveAspectRatio="none" />
            </svg>
          </g>
        )}

        {sortedObjects.map(renderObject)}
        {project.walls.map(renderWall)}
        {renderWallDraft()}
        {renderAnnotationPreview()}

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

