// 中央キャンバス(10.1)。SVG第一候補(第12章)。
// ポインター入力はPointer Events APIで統一し(12.1)。1本指の編集と
// 2本指のパン/ピンチを同じイベント列から判定する(iPad Safari対応)。

import { useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import type { AnnotationKind, PointMm, SceneObject, Wall } from "../types/project";
import { useEffect } from "react";
import {
  displayedPxToSourcePx,
  getBackgroundDisplaySizePx,
  getEffectiveCrop,
  imagePxToMm,
  mmDistance,
  mmToImagePx,
  normalizeDeg,
  screenToMm,
  sceneObjectBoundsMm,
  sourcePxToDisplayedPx,
  zoomAt,
  type ScreenPoint,
} from "../core/transform";
import { createPresetObject, effectiveMmPerPixel, type Action, type AppState, type ObjectMove } from "../state/appState";
import { lineArrangementGapFromPointer, lineArrangementGuide, marqueeBoundsMm, moveSelectionIds, selectionBoundsMm } from "../core/layout";
import { findAlignmentGuides, type AlignmentGuideLine } from "../core/alignmentGuides";
import type { RiserGroupSession } from "./RiserGroupDialog";
import type { LineArrangementSession } from "./LineArrangementDialog";
import type { ChairLineSession } from "./ChairLineDialog";
import {
  DEFAULT_CHAIR_FACING_ROTATION_DEG,
  CHAIR_ARC_MAX_ARC_DEG,
  CHAIR_ARC_MIN_ARC_DEG,
  chairArcChairRadiusMm,
  chairArcMusicStandPlacement,
  chairArcFirstGapFromRadiusMm,
  chairArcFirstRowRadiusMm,
  chairArcRowGapFromRadiusMm,
  chairArcRowRadiusMm,
  createChairArcRowPlacements,
  detectChairArcOverlaps,
  signedDeltaDeg,
  type ChairArcSession,
} from "../core/arrangement";
import {
  STAGE_DEPTH_DIRECTION,
  STAGE_RIGHT_DIRECTION,
  stageLocalPointMm,
  stringLayout12FirstRowRadiusFromRadiusMm,
  stringLayout12OffsetsFromPointMm,
  stringLayoutRowCount,
  stringLayout12RowGapFromRadiusMm,
  stringLayout12RowRadiusMm,
  type StringSectionTemplateSession,
} from "../core/stringSectionTemplate";
import { CHAIR_MUSIC_STAND_SET_PRESET_ID, findPreset, instrumentLabelForPreset } from "../core/presets";
import { defaultAssetVariantIdForPreset } from "../core/symbolAssets";
import { snapPointMm } from "../core/snap";
import { rotationDegTowardPoint } from "../core/orientation";

import { generateId } from "../core/project";
import { concertTomSetLabel, getSymbolLabelLayout, isConcertTomSetGroup, isSingleTimpaniPresetId, timpaniSizeLabelForPreset, SYMBOL_DEFINITIONS, SYMBOL_VIEW_BOX, symbolIdForObject, symbolLabelForPreset, symbolPaintProps, type SymbolNode } from "../core/symbols";
import { resolveObjectStyle, type ObjectStyle } from "../core/visualStyle";
import { createPlacedObjectsFromUserTemplate } from "../core/userTemplate";
import { GuideOverlay, guideBoundsForProject } from "./GuideOverlay";
import { resolveGuideAnchor } from "../core/guides";

import { SmartAlignmentGuideOverlay } from "./SmartAlignmentGuideOverlay";
interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onCursorMm: (p: PointMm | null) => void;
  onNotice: (message: string) => void;
  onContextMenu: (position: { x: number; y: number }) => void;
  onRegisterCanvasController?: (controller: CanvasStageController | null) => void;
  wallDraft: PointMm[];
  onWallDraftChange: (points: PointMm[]) => void;
  /** 確定前の椅子多列円弧配置。nullならプレビューを描画しない。 */
  chairArc?: ChairArcSession | null;
  onChairArcChange?: (session: ChairArcSession) => void;
  chairLine?: ChairLineSession | null;
  onChairLineChange?: (session: ChairLineSession) => void;
  /**
   * 確定前の弦楽器テンプレ配置。列の補助線をドラッグして間隔を変えるために受け取る。
   * nullなら補助線を描画せず、ドラッグ判定も行わない。
   */
  stringTemplate?: StringSectionTemplateSession | null;
  onStringTemplateChange?: (session: StringSectionTemplateSession) => void;
  riserGroup?: RiserGroupSession | null;
  onRiserGroupChange?: (session: RiserGroupSession) => void;
  lineArrangement?: LineArrangementSession | null;
  onLineArrangementChange?: (session: LineArrangementSession) => void;
  /**
   * 確定前の一括配置プレビュー(15.2)。描画専用データとして受け取るだけで、
   * project.objects・選択・ポインター判定へは一切含めない。
   */
  previewObjects?: readonly SceneObject[];
  riserPreviewObjects?: readonly SceneObject[];
  chairLinePreviewObjects?: readonly SceneObject[];
}


export interface CanvasStageController {
  focus: () => void;
  getViewport: () => { width: number; height: number };
}
type DragState =
  | { kind: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { kind: "point"; pointMode: "traceWall" | "calibrate" | "verifyCalibration" | "measure"; startScreen: ScreenPoint; startMm: PointMm }
  | { kind: "move"; startMm: PointMm; startPositions: ObjectMove[] }
  | { kind: "guide"; id: string; startMm: PointMm; startPosition: PointMm }
  | { kind: "rotate"; id: string; centerMm: PointMm }
  | { kind: "marquee"; startMm: PointMm; additive: boolean }
  | { kind: "marqueeCandidate"; startMm: PointMm; startScreen: ScreenPoint; clickObjectId: string | null }
  | { kind: "annotation"; annotationKind: AnnotationKind; startMm: PointMm }
  | { kind: "chairArc"; handle: ChairArcHandle; rowIndex: number; centerMm: PointMm }
  | { kind: "stringRow"; rowIndex: number; centerMm: PointMm }
  | { kind: "stringCenter"; centerMm: PointMm }
  | { kind: "riserAnchor" }
  | { kind: "lineSpacing"; axis: "x" | "y"; ids: string[]; startGapMm: number; startHadTransient: boolean }
  | { kind: "pinch"; startDistance: number; startCenter: ScreenPoint; anchorMm: PointMm; startView: { zoom: number; panX: number; panY: number } };

interface AnnotationPreview {
  annotationKind: AnnotationKind;
  startMm: PointMm;
  currentMm: PointMm;
}

// Shift+?????????????????????????????????????????px???
const MARQUEE_DRAG_THRESHOLD_PX = 8;
/** グリッド描画の本数上限。極端に細かい間隔でもDOMを増やしすぎない。 */
const SNAP_GRID_MAX_LINES = 400;

/** 円弧配置プレビューの操作対象。円弧補助線そのものを距離ドラッグの当たり判定にする。 */
type ChairArcHandle = "direction" | "arcEnd" | "firstGap" | "rowGap";

function chairArcHandleFrom(value: string | null | undefined): ChairArcHandle | null {
  return value === "direction" || value === "arcEnd" || value === "firstGap" || value === "rowGap" ? value : null;
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
  if (definition.rawSvg) {
    return <symbol key={definition.id} id={definition.id} viewBox={definition.viewBox ?? SYMBOL_VIEW_BOX} preserveAspectRatio={definition.preserveAspectRatio ?? "xMidYMid meet"} dangerouslySetInnerHTML={{ __html: definition.rawSvg }} />;
  }
  return (
    <symbol key={definition.id} id={definition.id} viewBox={definition.viewBox ?? SYMBOL_VIEW_BOX} preserveAspectRatio={definition.preserveAspectRatio ?? "xMidYMid meet"}>
      {definition.nodes.map((node, index) => renderSymbolNode(node, definition.id + "-" + index))}
    </symbol>
  );
}
export function CanvasStage({ state, dispatch, onCursorMm, onNotice, onContextMenu, onRegisterCanvasController, wallDraft, onWallDraftChange, chairArc = null, onChairArcChange, chairLine = null, onChairLineChange, stringTemplate = null, onStringTemplateChange, riserGroup = null, onRiserGroupChange, lineArrangement = null, onLineArrangementChange, previewObjects, riserPreviewObjects, chairLinePreviewObjects }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  useEffect(() => {
    if (!onRegisterCanvasController) return;
    const controller: CanvasStageController = {
      focus: () => {
        window.requestAnimationFrame(() => svgRef.current?.focus());
      },
      getViewport: () => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
        return {
          width: Math.max(320, window.innerWidth - 520),
          height: Math.max(240, window.innerHeight - 180),
        };
      },
    };
    onRegisterCanvasController(controller);
    return () => onRegisterCanvasController(null);
  }, [onRegisterCanvasController]);
  const pointersRef = useRef(new Map<number, ScreenPoint>());
  const [marquee, setMarquee] = useState<{ startMm: PointMm; currentMm: PointMm } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuideLine[]>([]);
  const [annotationPreview, setAnnotationPreview] = useState<AnnotationPreview | null>(null);
  const [aimPointPreview, setAimPointPreview] = useState<PointMm | null>(null);
  const { project, mode, selectedIds, pendingPresetId, pendingUserTemplateId, placementContinuous } = state;
  useEffect(() => {
    if (mode !== "aimPoint") setAimPointPreview(null);
  }, [mode]);
  const { view, background, calibration } = project;
  const mmpp = effectiveMmPerPixel(project);
  const calibrated = calibration.mmPerPixel !== null;
  const crop = getEffectiveCrop(background);
  const displaySize = getBackgroundDisplaySizePx(background);
  const cropWidthMm = crop.widthPx * mmpp;
  const cropHeightMm = crop.heightPx * mmpp;
  const stageWidthMm = displaySize.widthPx * mmpp;
  const guideBounds = guideBoundsForProject(project, stageWidthMm, cropHeightMm);
  const chairArcPodium = chairArc ? project.objects.find((object) => object.id === chairArc.options.podiumId) ?? null : null;
  // プレビュー椅子は標準chairプリセットの生成経路を通し、既存の円形シンボルをそのまま使う。
  const chairArcTemplate = chairArc ? createPresetObject("chair", chairArc.options.layerId, 0) : null;
  const chairArcStandTemplate = chairArc ? createPresetObject("music-stand", chairArc.options.layerId, 0) : null;
  // 弦楽器テンプレの列補助線は指揮者位置を中心に描く。基準指揮台があればその中心。
  const stringTemplatePodium = stringTemplate && stringTemplate.basis === "podium" && stringTemplate.podiumId
    ? project.objects.find((object) => object.id === stringTemplate.podiumId) ?? null
    : null;
  const stringTemplateCenterMm: PointMm | null = stringTemplate
    ? (stringTemplatePodium
      ? { xMm: stringTemplatePodium.xMm, yMm: stringTemplatePodium.yMm }
      : { ...stringTemplate.conductor })
    : null;

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
      guides: project.guides,
      guideAnchors: project.objects.filter((object) => object.type === "podium"),
    });
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextZoom = Math.min(2, Math.max(0.005, view.zoom * factor));
    dispatch({ type: "SET_VIEW", view: zoomAt(view, toScreen(e), nextZoom) });
  }

  function placeUserTemplate(pMm: PointMm) {
    if (!pendingUserTemplateId) return;
    if (!calibrated) {
      onNotice("縮尺未設定のため配置できません。先に「縮尺合わせ」で2点と実距離を指定してください。");
      return;
    }
    const layer = project.layers.find((candidate) => candidate.id === state.activeLayerId);
    if (!layer || layer.locked || !layer.visible) {
      onNotice("配置先レイヤーが非表示またはロックされています。");
      return;
    }
    const template = state.userTemplates.find((candidate) => candidate.id === pendingUserTemplateId);
    if (!template) {
      dispatch({ type: "SET_PENDING_USER_TEMPLATE", templateId: null });
      return;
    }
    const placed = createPlacedObjectsFromUserTemplate(
      template,
      project,
      state.activeLayerId,
      snapPoint(pMm),
      generateId,
    );
    if (placed.length === 0) {
      onNotice("ユーザーテンプレートを配置できませんでした。");
      return;
    }
    dispatch({ type: "ADD_OBJECTS", objects: placed });
  }

  /**
   * 配置直後の向き。「指揮台へ向ける」がオフ、または指揮台が1つもなければ従来どおり0度。
   * 指揮台が複数ある図面では配置位置から最も近いものを基準にする。
   */
  function placementRotationDegAt(pointMm: PointMm): number {
    if (!state.placementFacePodium) return 0;
    let nearest: SceneObject | null = null;
    let nearestDistanceMm = Number.POSITIVE_INFINITY;
    for (const object of project.objects) {
      if (object.type !== "podium") continue;
      const distanceMm = Math.hypot(object.xMm - pointMm.xMm, object.yMm - pointMm.yMm);
      if (distanceMm < nearestDistanceMm) {
        nearest = object;
        nearestDistanceMm = distanceMm;
      }
    }
    if (!nearest) return 0;
    return rotationDegTowardPoint(pointMm, { xMm: nearest.xMm, yMm: nearest.yMm }) ?? 0;
  }

  function placePreset(pMm: PointMm, keepPending: boolean) {
    if (!pendingPresetId) return;
    if (!calibrated) {
      onNotice("縮尺未設定のため配置できません。先に「縮尺合わせ」で2点と実距離を指定してください。");
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
    const rotationDeg = pendingPresetId === CHAIR_MUSIC_STAND_SET_PRESET_ID && !state.placementFacePodium
      ? DEFAULT_CHAIR_FACING_ROTATION_DEG
      : placementRotationDegAt(snapped);
    if (pendingPresetId === CHAIR_MUSIC_STAND_SET_PRESET_ID) {
      dispatch({
        type: "ADD_CHAIR_MUSIC_STAND_SET",
        centerXMm: Math.round(snapped.xMm),
        centerYMm: Math.round(snapped.yMm),
        layerId: state.activeLayerId,
        keepPending,
        rotationDeg,
      });
      return;
    }
    if (pendingPresetId === "timpani-set-4" || pendingPresetId === "concert-tom-set-4") {
      dispatch({
        type: "ADD_GROUP_PRESET",
        presetId: pendingPresetId,
        centerXMm: Math.round(snapped.xMm),
        centerYMm: Math.round(snapped.yMm),
        layerId: state.activeLayerId,
        keepPending,
        rotationDeg,
      });
      return;
    }
    const assetVariantId = defaultAssetVariantIdForPreset(preset.id);
    const object: SceneObject = {
      id: generateId("obj"),
      type: preset.type,
      presetId: preset.id,
      ...(assetVariantId ? { assetVariantId } : {}),
      name: preset.name,
      xMm: Math.round(snapped.xMm),
      yMm: Math.round(snapped.yMm),
      widthMm: preset.widthMm,
      depthMm: preset.depthMm,
      heightMm: preset.heightMm,
      rotationDeg,
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

  /** ポインター位置から中心方向を決める。円弧中心と近すぎる入力は拒否する(6.3)。 */
  function applyChairArcDirection(pMm: PointMm, centerMm: PointMm, finishPicking: boolean) {
    if (!chairArc || !onChairArcChange) return;
    const dx = pMm.xMm - centerMm.xMm;
    const dy = pMm.yMm - centerMm.yMm;
    if (Math.hypot(dx, dy) < 1) {
      if (finishPicking) onNotice("指揮台中心から離れた位置を指定してください。");
      return;
    }
    const directionDeg = normalizeDeg((Math.atan2(dy, dx) * 180) / Math.PI);
    onChairArcChange({
      ...chairArc,
      options: { ...chairArc.options, directionDeg },
      pickingDirection: finishPicking ? false : chairArc.pickingDirection,
    });
  }

  /** 端ハンドルは中心方向に対して常に左右対称。片側の変更が反対側へ鏡映される(FR-064-12)。 */
  function applyChairArcHalfSpan(pMm: PointMm, centerMm: PointMm) {
    if (!chairArc || !onChairArcChange) return;
    const dx = pMm.xMm - centerMm.xMm;
    const dy = pMm.yMm - centerMm.yMm;
    if (Math.hypot(dx, dy) < 1) return;
    const pointerDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const halfSpanDeg = Math.min(
      CHAIR_ARC_MAX_ARC_DEG / 2,
      Math.max(CHAIR_ARC_MIN_ARC_DEG / 2, Math.abs(signedDeltaDeg(chairArc.options.directionDeg, pointerDeg))),
    );
    onChairArcChange({ ...chairArc, options: { ...chairArc.options, halfSpanDeg } });
  }
  /**
   * 円弧補助線を半径方向へドラッグして距離を変える。1列目は指揮台からの空き距離、
   * 2列目以降は列間隔を更新する。座標→距離の換算はcoreの純粋関数へ委ねる。
   */
  function applyChairArcDistance(handle: "firstGap" | "rowGap", rowIndex: number, pMm: PointMm, centerMm: PointMm) {
    if (!chairArc || !onChairArcChange || !chairArcPodium || !chairArcTemplate) return;
    const radiusMm = Math.hypot(pMm.xMm - centerMm.xMm, pMm.yMm - centerMm.yMm);
    if (!Number.isFinite(radiusMm)) return;
    if (handle === "firstGap") {
      const firstGapMm = chairArcFirstGapFromRadiusMm(chairArcPodium, chairArcTemplate, chairArc.options.directionDeg, radiusMm);
      onChairArcChange({ ...chairArc, options: { ...chairArc.options, firstGapMm } });
      return;
    }
    const firstRowRadiusMm = chairArcFirstRowRadiusMm(chairArcPodium, chairArcTemplate, chairArc.options);
    const rowGapMm = chairArcRowGapFromRadiusMm(firstRowRadiusMm, radiusMm, rowIndex);
    onChairArcChange({ ...chairArc, options: { ...chairArc.options, rowGapMm } });
  }

  /**
   * 弦楽器テンプレの列補助線を半径方向へドラッグして間隔を変える。
   * 1列目は指揮台からの距離、2列目以降は列間隔を更新する。
   * 位置補正で全体がずれていても補助線と列は一致するよう、補正分を引いてから換算する。
   */
  function applyStringRowDistance(rowIndex: number, pMm: PointMm, centerMm: PointMm) {
    if (!stringTemplate || !onStringTemplateChange) return;
    const offset = stageLocalPointMm(centerMm, stringTemplate.lateralOffsetMm, stringTemplate.depthOffsetMm);
    const radiusMm = Math.hypot(pMm.xMm - offset.xMm, pMm.yMm - offset.yMm);
    if (!Number.isFinite(radiusMm)) return;
    if (rowIndex === 0) {
      onStringTemplateChange({
        ...stringTemplate,
        firstRowRadiusMm: stringLayout12FirstRowRadiusFromRadiusMm(radiusMm, stringTemplate.spreadScale),
      });
      return;
    }
    onStringTemplateChange({
      ...stringTemplate,
      rowGapMm: stringLayout12RowGapFromRadiusMm(
        stringTemplate.firstRowRadiusMm, radiusMm, rowIndex, stringTemplate.spreadScale),
    });
  }

  /**
   * 位置補正の中心ハンドルをドラッグして、左右・前後補正をまとめて変える。
   * 換算はcoreの純粋関数へ委ねるので、補助線中心と実際の配置中心は常に一致する。
   */
  function applyStringCenter(pMm: PointMm, centerMm: PointMm) {
    if (!stringTemplate || !onStringTemplateChange) return;
    onStringTemplateChange({ ...stringTemplate, ...stringLayout12OffsetsFromPointMm(centerMm, pMm) });
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
    if (e.button !== 0) return;
    e.preventDefault();
    setAlignmentGuides([]);
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
    if (chairLine?.pickingAnchor && onChairLineChange) {
      onChairLineChange({ ...chairLine, options: { ...chairLine.options, start: pMm }, pickingAnchor: false });
      return;
    }
    if (mode === "aimPoint") {
      setAimPointPreview(pMm);
      dispatch({ type: "ROTATE_SELECTED_TO_POINT", point: pMm });
      dispatch({ type: "SET_MODE", mode: "select" });
      setAimPointPreview(null);
      return;
    }
    // 円弧配置プレビュー中は、方向・端ハンドルの操作と方向指定クリックを優先し、
    // 既存オブジェクトの選択・移動を誤って開始しない。パンは従来どおり使える。
    if (chairArc && chairArcPodium) {
      const centerMm = { xMm: chairArcPodium.xMm, yMm: chairArcPodium.yMm };
      const handleElement = (e.target as Element).closest("[data-chair-arc-handle]");
      const handle = chairArcHandleFrom(handleElement?.getAttribute("data-chair-arc-handle"));
      if (handle) {
        const rowIndex = Number(handleElement?.getAttribute("data-chair-arc-row") ?? 0);
        dragRef.current = { kind: "chairArc", handle, rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0, centerMm };
        return;
      }
      if (chairArc.pickingDirection) {
        applyChairArcDirection(pMm, centerMm, true);
        return;
      }
      dragRef.current = { kind: "pan", startX: screen.x, startY: screen.y, startPanX: view.panX, startPanY: view.panY };
      return;
    }
    // 弦楽器テンプレのプレビュー中は列補助線のドラッグを優先する。補助線以外を
    // つかんだときは既存オブジェクトの選択・移動を邪魔せず通常どおり扱う。
    if (stringTemplate && stringTemplateCenterMm) {
      if ((e.target as Element).closest("[data-string-center]")) {
        dragRef.current = { kind: "stringCenter", centerMm: stringTemplateCenterMm };
        return;
      }
      const handleElement = (e.target as Element).closest("[data-string-row]");
      if (handleElement) {
        const rowIndex = Number(handleElement.getAttribute("data-string-row"));
        dragRef.current = {
          kind: "stringRow",
          rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0,
          centerMm: stringTemplateCenterMm,
        };
        return;
      }
    }
    if (lineArrangement && onLineArrangementChange) {
      const handleElement = (e.target as Element).closest("[data-line-arrangement-handle]");
      if (handleElement) {
        dragRef.current = { kind: "lineSpacing", axis: lineArrangement.axis, ids: lineArrangement.ids, startGapMm: lineArrangement.gapMm, startHadTransient: state.transientBaseProject !== null };
        return;
      }
    }
    if (riserGroup?.pickingAnchor && onRiserGroupChange) {
      onRiserGroupChange({ ...riserGroup, options: { ...riserGroup.options, center: pMm }, pickingAnchor: false });
      return;
    }    if (mode === "traceWall" || mode === "calibrate" || mode === "verifyCalibration" || mode === "measure") {
      if (mode === "traceWall" && !calibrated) {
        onNotice("縮尺未設定のため壁トレースできません。先に縮尺合わせをしてください。");
        pointersRef.current.delete(e.pointerId);
        return;
      }
      dragRef.current = { kind: "point", pointMode: mode, startScreen: screen, startMm: pMm };
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

    if (pendingUserTemplateId) {
      placeUserTemplate(pMm);
      return;
    }

    if (pendingPresetId) {
      placePreset(pMm, placementContinuous || e.shiftKey);
      return;
    }

    const guideTarget = (e.target as Element).closest("[data-guide-id]");
    if (mode === "select" && guideTarget) {
      const guideId = guideTarget.getAttribute("data-guide-id");
      const guide = guideId ? project.guides.find((candidate) => candidate.id === guideId) : undefined;
      if (!guide) return;
      if (guide.locked) {
        onNotice("\u30ed\u30c3\u30af\u4e2d\u306e\u30ac\u30a4\u30c9\u306f\u7de8\u96c6\u3067\u304d\u307e\u305b\u3093\u3002");
        return;
      }
      const resolvedGuide = resolveGuideAnchor(guide, project.objects);
      dragRef.current = { kind: "guide", id: guide.id, startMm: pMm, startPosition: { xMm: resolvedGuide.xMm, yMm: resolvedGuide.yMm } };
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
    if (mode === "select" && e.shiftKey) {
      dragRef.current = {
        kind: "marqueeCandidate",
        startMm: pMm,
        startScreen: screen,
        clickObjectId: objectId,
      };
      return;
    }
    if (objectId) {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const object = project.objects.find((item) => item.id === objectId);
      const layer = object && project.layers.find((candidate) => candidate.id === object.layerId);
      const shouldMove = Boolean(object && !object.locked && !object.backgroundFixed && !layer?.locked && !additive && (mode === "select" || (mode === "selectRect" && selectedIds.includes(objectId))));
      if (mode === "selectRect" && selectedIds.includes(objectId) && object && (object.locked || object.backgroundFixed || layer?.locked)) {
        onNotice(object.backgroundFixed ? "背景化したオブジェクトは移動できません。" : "ロック中のオブジェクトを含むため移動できません。");
        return;
      }
      if (shouldMove && object) {
        const ids = moveSelectionIds(project.objects, selectedIds, objectId);
        const editable = ids.every((id) => {
          const item = project.objects.find((candidate) => candidate.id === id);
          const itemLayer = item && project.layers.find((candidate) => candidate.id === item.layerId);
          return Boolean(item && !item.locked && !itemLayer?.locked);
        });
        if (!editable) {
          onNotice("ロック中のオブジェクトを含むため移動できません。");
          return;
        }
        if (mode === "select") {
          if (object.groupId) dispatch({ type: "SELECT_GROUP", id: objectId });
          else dispatch({ type: "SELECT", id: objectId });
        }
        dragRef.current = {
          kind: "move",
          startMm: pMm,
          startPositions: project.objects.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, xMm: item.xMm, yMm: item.yMm })),
        };
        return;
      }
      if (object?.groupId) dispatch({ type: "SELECT_GROUP", id: objectId, additive });
      else dispatch({ type: "SELECT", id: objectId, additive });
      return;
    }

    if (mode === "selectRect") {
      setMarquee({ startMm: pMm, currentMm: pMm });
      dragRef.current = { kind: "marquee", startMm: pMm, additive: e.shiftKey || e.ctrlKey || e.metaKey };
      return;
    }
    dispatch({ type: "SELECT", id: null });
    dragRef.current = { kind: "pan", startX: screen.x, startY: screen.y, startPanX: view.panX, startPanY: view.panY };
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    if (!pointersRef.current.has(e.pointerId) && e.buttons === 0) {
      if (mode === "aimPoint") setAimPointPreview(screenToMm(screen, view));
      onCursorMm(calibrated ? screenToMm(screen, view) : null);
      return;
    }
    pointersRef.current.set(e.pointerId, screen);
    if (mode === "aimPoint") setAimPointPreview(screenToMm(screen, view));
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
    if (drag.kind === "marqueeCandidate") {
      const distance = Math.hypot(screen.x - drag.startScreen.x, screen.y - drag.startScreen.y);
      if (distance <= MARQUEE_DRAG_THRESHOLD_PX) return;
      dragRef.current = { kind: "marquee", startMm: drag.startMm, additive: true };
      setMarquee({ startMm: drag.startMm, currentMm: pMm });
      return;
    }
    if (drag.kind === "point") {
      if (Math.hypot(screen.x - drag.startScreen.x, screen.y - drag.startScreen.y) > 8) {
        dragRef.current = { kind: "pan", startX: drag.startScreen.x, startY: drag.startScreen.y, startPanX: view.panX, startPanY: view.panY };
        dispatch({ type: "SET_VIEW", view: { ...view, panX: view.panX + screen.x - drag.startScreen.x, panY: view.panY + screen.y - drag.startScreen.y } });
      }
      return;
    }
    if (drag.kind === "lineSpacing") {
      if (!lineArrangement || !onLineArrangementChange) return;
      const baseProject = state.transientBaseProject ?? state.project;
      const gapMm = lineArrangementGapFromPointer(baseProject.objects, drag.ids, drag.axis, pMm);
      if (gapMm === null || !Number.isFinite(gapMm)) return;
      onLineArrangementChange({ ...lineArrangement, gapMm: Math.max(0, Math.round(gapMm)) });
      return;
    }
    if (drag.kind === "chairArc") {
      if (drag.handle === "direction") applyChairArcDirection(pMm, drag.centerMm, false);
      else if (drag.handle === "arcEnd") applyChairArcHalfSpan(pMm, drag.centerMm);
      else applyChairArcDistance(drag.handle, drag.rowIndex, pMm, drag.centerMm);
      return;
    }
    if (drag.kind === "stringRow") {
      applyStringRowDistance(drag.rowIndex, pMm, drag.centerMm);
      return;
    }
    if (drag.kind === "stringCenter") {
      applyStringCenter(pMm, drag.centerMm);
      return;
    }
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
      const baseProject = state.transientBaseProject ?? state.project;
      const alignmentObjects = baseProject.objects.filter((object) => {
        const layer = baseProject.layers.find((candidate) => candidate.id === object.layerId);
        return object.visible && (layer?.visible ?? true);
      });
      const alignment = findAlignmentGuides(
        alignmentObjects,
        drag.startPositions.map((position) => position.id),
        { xMm: snappedDeltaX, yMm: snappedDeltaY },
        baseProject.snapSettings.thresholdMm,
      );
      setAlignmentGuides(alignment.guides);
      dispatch({ type: "MOVE_OBJECTS", preview: true, moves: drag.startPositions.map((position) => ({ id: position.id, xMm: position.xMm + alignment.delta.xMm, yMm: position.yMm + alignment.delta.yMm })) });
    } else if (drag.kind === "guide") {
      const deltaX = pMm.xMm - drag.startMm.xMm;
      const deltaY = pMm.yMm - drag.startMm.yMm;
      dispatch({ type: "MOVE_GUIDE", id: drag.id, xMm: drag.startPosition.xMm + deltaX, yMm: drag.startPosition.yMm + deltaY, preview: true });
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
    setAlignmentGuides([]);
    if (drag.kind === "point") {
      const endScreen = toScreen(e);
      if (Math.hypot(endScreen.x - drag.startScreen.x, endScreen.y - drag.startScreen.y) <= 8) {
        if (drag.pointMode === "traceWall") onWallDraftChange([...wallDraft, snapPoint(drag.startMm)]);
        else if (drag.pointMode === "measure") dispatch({ type: "ADD_MEASURE_POINT", point: drag.startMm });
        else {
          const displayedPx = mmToImagePx(drag.startMm, mmpp);
          dispatch({ type: "ADD_CALIB_POINT", point: displayedPxToSourcePx(displayedPx, background) });
        }
      }
      dragRef.current = null;
      return;
    }
    if (drag.kind === "pinch") {
      if (pointersRef.current.size < 2) dragRef.current = null;
      return;
    }
    if (drag.kind === "marqueeCandidate") {
      if (drag.clickObjectId) {
        const object = project.objects.find((item) => item.id === drag.clickObjectId);
        if (object?.groupId) dispatch({ type: "SELECT_GROUP", id: object.id, additive: true });
        else if (object) dispatch({ type: "SELECT", id: object.id, additive: true });
      }
    } else if (drag.kind === "move" || drag.kind === "rotate" || drag.kind === "guide") {
      dispatch({ type: "COMMIT_TRANSIENT_EDIT" });
    } else if (drag.kind === "lineSpacing") {
    } else if (drag.kind === "annotation" && annotationPreview) {
      createAnnotation(drag.annotationKind, annotationPreview.startMm, annotationPreview.currentMm);
      setAnnotationPreview(null);
    } else if (drag.kind === "marquee" && marquee) {
      const bounds = marqueeBoundsMm(marquee.startMm, marquee.currentMm);
      dispatch({ type: "SELECT_RECT", bounds, additive: drag.additive });
      setMarquee(null);
    }
    dragRef.current = null;
  }

  function handlePointerCancel(e: PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    setAlignmentGuides([]);
    setAimPointPreview(null);
    if (drag?.kind === "lineSpacing") {
      if (lineArrangement && onLineArrangementChange) onLineArrangementChange({ ...lineArrangement, gapMm: drag.startGapMm });
      // Reapply the pre-drag preview; only a newly-created preview is then cancelled.
      if (!drag.startHadTransient) dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
    } else if (drag?.kind === "move" || drag?.kind === "rotate" || drag?.kind === "guide") {
      dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
    }
    dragRef.current = null;
    setMarquee(null);
    setAnnotationPreview(null);
  }

  function handlePointerLeave(e: PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    onCursorMm(null);
    if (pointersRef.current.size < 2 && dragRef.current?.kind === "pinch") dragRef.current = null;
  }

  function handleContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
    if (mode !== "select" || pendingPresetId || pendingUserTemplateId) return;
    const target = (event.target as Element).closest("[data-object-id]");
    const objectId = target?.getAttribute("data-object-id");
    const object = objectId ? project.objects.find((candidate) => candidate.id === objectId) : undefined;
    if (!object || !object.visible) return;

    event.preventDefault();
    if (object.groupId) dispatch({ type: "SELECT_GROUP", id: object.id });
    else dispatch({ type: "SELECT", id: object.id });
    onContextMenu({ x: event.clientX, y: event.clientY });
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    if (selectedIds.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    onContextMenu({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  const sortedObjects = visibleObjects().sort((a, b) => a.zIndex - b.zIndex);
  const [mA, mB] = state.measurePointsMm;
  const marqueeBounds = marquee ? marqueeBoundsMm(marquee.startMm, marquee.currentMm) : null;
  const marqueeRect = marqueeBounds
    ? {
        x: marqueeBounds.minXMm,
        y: marqueeBounds.minYMm,
        width: marqueeBounds.maxXMm - marqueeBounds.minXMm,
        height: marqueeBounds.maxYMm - marqueeBounds.minYMm,
      }
    : null;
  const selectionBounds = selectedIds.length > 1 ? selectionBoundsMm(project.objects, selectedIds) : null;

  /**
   * グリッドスナップが有効なときだけ、スナップ先の実寸グリッドを描く。
   * 線が潰れて見える倍率では描画しない(mm間隔が画面上2px未満)。
   */
  function renderSnapGrid() {
    const settings = project.snapSettings;
    const intervalMm = settings.gridIntervalMm;
    if (!settings.grid || !Number.isFinite(intervalMm) || intervalMm <= 0) return null;
    if (intervalMm * view.zoom < 2) return null;
    const startXMm = Math.ceil(guideBounds.minXMm / intervalMm) * intervalMm;
    const startYMm = Math.ceil(guideBounds.minYMm / intervalMm) * intervalMm;
    const columns: number[] = [];
    const rows: number[] = [];
    for (let xMm = startXMm; xMm <= guideBounds.maxXMm && columns.length < SNAP_GRID_MAX_LINES; xMm += intervalMm) columns.push(xMm);
    for (let yMm = startYMm; yMm <= guideBounds.maxYMm && rows.length < SNAP_GRID_MAX_LINES; yMm += intervalMm) rows.push(yMm);
    if (columns.length === 0 && rows.length === 0) return null;
    return (
      <g className="snap-grid" pointerEvents="none" aria-hidden="true" style={{ strokeWidth: Math.max(1, 1 / Math.max(0.005, view.zoom)) }}>
        {columns.map((xMm) => <line key={"snap-grid-x-" + xMm} x1={xMm} y1={guideBounds.minYMm} x2={xMm} y2={guideBounds.maxYMm} />)}
        {rows.map((yMm) => <line key={"snap-grid-y-" + yMm} x1={guideBounds.minXMm} y1={yMm} x2={guideBounds.maxXMm} y2={yMm} />)}
      </g>
    );
  }

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

  function symbolStyle(style: ObjectStyle, selected: boolean): CSSProperties {
    return {
      color: selected ? "#1f5b60" : style.color,
      "--symbol-body-opacity": String(style.fillOpacity),
      "--symbol-solid-opacity": String(Math.min(1, style.fillOpacity + 0.16)),
      "--symbol-stroke-width": String(style.strokeWidthMm),
      "--symbol-detail-stroke-width": String(Math.max(6, style.strokeWidthMm * 0.84)),
    } as CSSProperties;
  }

  function renderMultilineLabel(value: string, style: ObjectStyle, x: number, y: number, keyPrefix: string) {
    const lines = value.split(/\r?\n/);
    const lineHeight = style.labelFontSizeMm * 1.2;
    const firstY = y - ((lines.length - 1) * lineHeight) / 2;
    return (
      <text className="object-label" x={x} y={firstY} textAnchor="middle" style={{ fill: style.labelColor, fontSize: style.labelFontSizeMm }}>
        {lines.map((line, index) => <tspan key={keyPrefix + "-" + index} x={x} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
      </text>
    );
  }

  function renderSymbolLabel(value: string, style: ObjectStyle, widthMm: number, depthMm: number, keyPrefix: string, rotationDeg = 0) {
    const layout = getSymbolLabelLayout(value, widthMm, depthMm, style.labelFontSizeMm);
    if (!layout) return null;
    const firstY = -((layout.lines.length - 1) * layout.lineHeightMm) / 2;
    const lightLabel = style.labelColor.toLowerCase() === "#ffffff";
    const label = (
      <text className={"symbol-label" + (lightLabel ? " symbol-label-light" : "")} x={0} y={firstY} textAnchor="middle" style={{ fill: style.labelColor, fontSize: layout.fontSizeMm }}>
        {layout.lines.map((line, index) => <tspan key={keyPrefix + "-" + index} x={0} dy={index === 0 ? 0 : layout.lineHeightMm}>{line}</tspan>)}
      </text>
    );
    return rotationDeg === 0 ? label : <g transform={"rotate(" + (-rotationDeg) + ")"}>{label}</g>;
  }

  function keepLabelHorizontal(content: ReactNode, rotationDeg: number, key: string) {
    return rotationDeg === 0 ? content : <g key={key} transform={"rotate(" + (-rotationDeg) + ")"}>{content}</g>;
  }

  function renderAnnotation(object: SceneObject) {
    const kind = object.annotationKind;
    const style = resolveObjectStyle(object);
    const selected = selectedIds.includes(object.id);
    const lineStyle: CSSProperties = { fill: "none", stroke: selected ? "#1f5b60" : style.color, strokeWidth: style.strokeWidthMm };
    if (kind === "text") {
      return renderMultilineLabel(object.label || "注釈", style, 0, 0, object.id);
    }
    if (kind === "line" || kind === "arrow" || kind === "dimension") {
      const endX = (object.endXMm ?? object.xMm + object.widthMm) - object.xMm;
      const endY = (object.endYMm ?? object.yMm) - object.yMm;
      return (
        <>
          <line className={"annotation-line " + kind} style={lineStyle} x1={0} y1={0} x2={endX} y2={endY} markerEnd={kind === "arrow" ? "url(#canvas-arrow)" : undefined} />
          {kind === "dimension" && renderMultilineLabel(object.label || String(Math.round(Math.hypot(endX, endY))) + " mm", style, endX / 2, endY / 2 - 120, object.id + "-dimension")}
        </>
      );
    }
    const shapeStyle: CSSProperties = {
      fill: style.fillColor,
      fillOpacity: style.fillOpacity,
      stroke: selected ? "#1f5b60" : style.color,
      strokeWidth: style.strokeWidthMm,
      strokeDasharray: "none",
    };
    return (
      <>
        {object.shape === "circle"
          ? <ellipse className={"annotation-shape " + kind} style={shapeStyle} rx={object.widthMm / 2} ry={object.depthMm / 2} />
          : <rect className={"annotation-shape " + kind} style={shapeStyle} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
        {object.label && renderMultilineLabel(object.label, style, 0, 0, object.id + "-label")}
      </>
    );
  }

  function renderConcertTomSetLabels() {
    const groups = new Map<string, SceneObject[]>();
    for (const object of sortedObjects) {
      if (!object.groupId || object.annotationKind) continue;
      const group = groups.get(object.groupId) ?? [];
      group.push(object);
      groups.set(object.groupId, group);
    }

    return [...groups.entries()].flatMap(([groupId, group]) => {
      if (!isConcertTomSetGroup(group)) return [];
      const firstObject = group[0];
      if (!firstObject) return [];
      const bounds = group.reduce(
        (result, object) => {
          const objectBounds = sceneObjectBoundsMm(object);
          return {
            minXMm: Math.min(result.minXMm, objectBounds.minXMm),
            minYMm: Math.min(result.minYMm, objectBounds.minYMm),
            maxXMm: Math.max(result.maxXMm, objectBounds.maxXMm),
            maxYMm: Math.max(result.maxYMm, objectBounds.maxYMm),
          };
        },
        { minXMm: Number.POSITIVE_INFINITY, minYMm: Number.POSITIVE_INFINITY, maxXMm: Number.NEGATIVE_INFINITY, maxYMm: Number.NEGATIVE_INFINITY },
      );
      const style = resolveObjectStyle(firstObject);
      if (!style.labelVisible || !project.displaySettings.instrumentLabelsVisible) return [];
      const centerXMm = (bounds.minXMm + bounds.maxXMm) / 2;
      const centerYMm = (bounds.minYMm + bounds.maxYMm) / 2;
      const label = renderSymbolLabel(
        concertTomSetLabel(project.displaySettings.instrumentLabelLanguage),
        style,
        bounds.maxXMm - bounds.minXMm,
        bounds.maxYMm - bounds.minYMm,
        "concert-tom-set-label-" + groupId,
      );
      if (!label) return [];
      return [
        <g key={"concert-tom-set-label-" + groupId} className="concert-tom-set-label" transform={"translate(" + centerXMm + " " + centerYMm + ")"} pointerEvents="none">
          {label}
        </g>,
      ];
    });
  }

  function renderObject(object: SceneObject) {
    const layer = project.layers.find((candidate) => candidate.id === object.layerId);
    const editable = !object.locked && !object.backgroundFixed && !layer?.locked;
    const isAnnotation = object.annotationKind !== null && object.annotationKind !== undefined;
    const selected = selectedIds.includes(object.id);
    const symbolId = !isAnnotation ? symbolIdForObject(object) : null;
    const visualStyle = resolveObjectStyle(object);
    const customLabel = object.label.trim();
    const isInstrument = object.type === "instrument";
    const labelText = customLabel
      ? symbolId
        ? symbolLabelForPreset(object.presetId, customLabel, true, project.displaySettings.instrumentLabelLanguage)
        : customLabel
      : symbolId
        ? isSingleTimpaniPresetId(object.presetId) && !project.displaySettings.instrumentLabelsVisible
          ? timpaniSizeLabelForPreset(object.presetId) ?? symbolLabelForPreset(object.presetId, object.name, false, project.displaySettings.instrumentLabelLanguage)
          : symbolLabelForPreset(object.presetId, object.name, false, project.displaySettings.instrumentLabelLanguage)
        : isInstrument
          ? instrumentLabelForPreset(object.presetId, project.displaySettings.instrumentLabelLanguage) ?? object.name
          : object.name;
    const isTimpaniSizeLabel = isSingleTimpaniPresetId(object.presetId);
    const showCatalogLabel = isInstrument
      ? (project.displaySettings.instrumentLabelsVisible || isTimpaniSizeLabel) && visualStyle.labelVisible
      : visualStyle.labelVisible;
    const showLabel = Boolean(labelText && (customLabel || showCatalogLabel));
    const className = "scene-object"
      + (symbolId ? " symbol-object" : "")
      + (isAnnotation ? " annotation-object" : "")
      + (selected ? " selected" : "")
      + (object.locked || layer?.locked ? " locked" : "")
      + (object.backgroundFixed ? " background-fixed" : "");
    return (
      <g key={object.id} data-object-id={object.id} className={className} style={symbolId ? symbolStyle(visualStyle, selected) : undefined} transform={"translate(" + object.xMm + " " + object.yMm + ") rotate(" + object.rotationDeg + ")"}>
        {isAnnotation ? renderAnnotation(object) : (
          <>
            {symbolId && <rect className="symbol-footprint" pointerEvents="all" fill="transparent" x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
            {symbolId
              ? <use className="symbol-use" href={"#" + symbolId} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />
              : <>
                  {object.shape === "circle"
                    ? <ellipse style={{ fill: visualStyle.fillColor, fillOpacity: visualStyle.fillOpacity, stroke: selected ? "#1f5b60" : visualStyle.color, strokeWidth: visualStyle.strokeWidthMm }} rx={object.widthMm / 2} ry={object.depthMm / 2} />
                    : <rect style={{ fill: visualStyle.fillColor, fillOpacity: visualStyle.fillOpacity, stroke: selected ? "#1f5b60" : visualStyle.color, strokeWidth: visualStyle.strokeWidthMm }} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
                  {(object.type === "chair" || object.type === "musicStand") && <line className="facing" style={{ stroke: selected ? "#1f5b60" : visualStyle.color, strokeWidth: visualStyle.strokeWidthMm }} x1={0} y1={0} x2={0} y2={-object.depthMm / 2} />}
                </>}
            {showLabel && symbolId && (renderSymbolLabel(labelText, visualStyle, object.widthMm, object.depthMm, object.id + "-symbol", object.rotationDeg) ?? keepLabelHorizontal(renderMultilineLabel(labelText, visualStyle, 0, object.depthMm / 2 + 320, object.id + "-object"), object.rotationDeg, object.id + "-symbol-fallback"))}
            {showLabel && !symbolId && keepLabelHorizontal(renderMultilineLabel(labelText, visualStyle, 0, object.depthMm / 2 + 320, object.id + "-object"), object.rotationDeg, object.id + "-object-horizontal")}
          </>
        )}
        {selected && editable && !isAnnotation && mode === "select" && (
          <g className="rotate-handle" data-rotate-handle="true" data-object-id={object.id}>
            <line x1={0} y1={-object.depthMm / 2} x2={0} y2={-object.depthMm / 2 - 300} />
            <circle className="rotate-hit-area" pointerEvents="all" cx={0} cy={-object.depthMm / 2 - 300} r={28 / view.zoom} />
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
  /**
   * 一括配置テンプレートの確定前プレビュー(15)。座標計算はcoreの純粋関数が済ませた
   * SceneObjectをそのまま描画するだけで、ここでは配置計算を一切行わない(22)。
   * pointer-events: noneのため選択・移動・コンテキストメニューの対象にならない。
   */
  function renderPreviewObjects(objects: readonly SceneObject[] | undefined, className: string) {
    if (!objects || objects.length === 0) return null;
    return (
      <g className={className} pointerEvents="none" aria-hidden="true">
        {objects.map((object) => {
          const symbolId = symbolIdForObject(object);
          const style = resolveObjectStyle(object);
          return (
            <g key={object.id} className={className + "-object" + (symbolId ? " symbol-object" : "")} style={symbolId ? symbolStyle(style, false) : undefined} transform={"translate(" + object.xMm + " " + object.yMm + ") rotate(" + object.rotationDeg + ")"}>
              {symbolId
                ? <use className="symbol-use" href={"#" + symbolId} x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />
                : <rect x={-object.widthMm / 2} y={-object.depthMm / 2} width={object.widthMm} height={object.depthMm} />}
            </g>
          );
        })}
      </g>
    );
  }

  function renderTemplatePreview() {
    return renderPreviewObjects(previewObjects, "template-preview");
  }

  function renderRiserPreview() {
    return renderPreviewObjects(riserPreviewObjects, "riser-group-preview");
  }
  function renderChairLinePreview() {
    return renderPreviewObjects(chairLinePreviewObjects, "chair-line-preview");
  }
  function renderChairArcPreview() {
    if (!chairArc || !chairArcPodium || !chairArcTemplate) return null;
    const { options } = chairArc;
    const centerXMm = chairArcPodium.xMm;
    const centerYMm = chairArcPodium.yMm;
    const firstRowRadiusMm = chairArcFirstRowRadiusMm(chairArcPodium, chairArcTemplate, options);
    if (!Number.isFinite(firstRowRadiusMm) || firstRowRadiusMm <= 0) return null;

    const chairRadiusMm = chairArcChairRadiusMm(chairArcTemplate);
    const placements = createChairArcRowPlacements(chairArcPodium, chairArcTemplate, options);
    const overlapKeys = new Set(
      detectChairArcOverlaps(placements, chairRadiusMm)
        .flatMap((overlap) => [overlap.a, overlap.b])
        .map((ref) => ref.rowIndex + "-" + ref.chairIndex),
    );
    const symbolId = symbolIdForObject(chairArcTemplate);
    const standSymbolId = chairArcStandTemplate ? symbolIdForObject(chairArcStandTemplate) : null;
    const templateStyle = resolveObjectStyle(chairArcTemplate);
    const startDeg = options.directionDeg - options.halfSpanDeg;
    const endDeg = options.directionDeg + options.halfSpanDeg;
    const rowRadii = options.rows.map((_, rowIndex) => chairArcRowRadiusMm(firstRowRadiusMm, rowIndex, options.rowGapMm));
    const lastRowRadiusMm = rowRadii[rowRadii.length - 1] ?? firstRowRadiusMm;
    const directionRadiusMm = lastRowRadiusMm + Math.max(1200, chairRadiusMm * 4);
    const hitRadiusMm = Math.max(22 / view.zoom, 150);

    function polar(radiusMm: number, deg: number) {
      const rad = (deg * Math.PI) / 180;
      return { x: centerXMm + Math.cos(rad) * radiusMm, y: centerYMm + Math.sin(rad) * radiusMm };
    }

    function arcPath(radiusMm: number): string {
      const from = polar(radiusMm, startDeg);
      const to = polar(radiusMm, endDeg);
      const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
      return `M ${from.x} ${from.y} A ${radiusMm} ${radiusMm} 0 ${largeArc} 1 ${to.x} ${to.y}`;
    }

    const directionHandle = polar(directionRadiusMm, options.directionDeg);
    const startHandle = polar(firstRowRadiusMm, startDeg);
    const endHandle = polar(firstRowRadiusMm, endDeg);

    return (
      <>
        <g className="chair-arc-preview" pointerEvents="none" style={symbolStyle(templateStyle, false)}>
          <circle className="chair-arc-center" cx={centerXMm} cy={centerYMm} r={Math.max(60, chairRadiusMm / 3)} />
          <line className="chair-arc-direction-line" x1={centerXMm} y1={centerYMm} x2={directionHandle.x} y2={directionHandle.y} />
          {rowRadii.map((radiusMm, rowIndex) => {
            const grip = polar(radiusMm, options.directionDeg);
            return (
              <g key={"chair-arc-guide-" + rowIndex}>
                <path className="chair-arc-guide" d={arcPath(radiusMm)} />
                <circle className="chair-arc-distance-grip" cx={grip.x} cy={grip.y} r={90} />
              </g>
            );
          })}
          {placements.map((placement) => {
            const key = placement.rowIndex + "-" + placement.chairIndex;
            const overlapping = overlapKeys.has(key);
            const standPlacement = options.includeMusicStands && chairArcStandTemplate
              ? chairArcMusicStandPlacement(placement, chairArcTemplate, chairArcStandTemplate)
              : null;
            return (
              <g key={"chair-arc-placement-" + key}>
                <g
                  className={"chair-arc-chair symbol-object" + (overlapping ? " overlapping" : "")}
                  transform={"translate(" + placement.xMm + " " + placement.yMm + ") rotate(" + placement.rotationDeg + ")"}
                >
                  {symbolId
                    ? <use className="symbol-use" href={"#" + symbolId} x={-chairArcTemplate.widthMm / 2} y={-chairArcTemplate.depthMm / 2} width={chairArcTemplate.widthMm} height={chairArcTemplate.depthMm} />
                    : <ellipse rx={chairArcTemplate.widthMm / 2} ry={chairArcTemplate.depthMm / 2} />}
                  {overlapping && <circle className="chair-arc-chair-warning" cx={0} cy={0} r={chairRadiusMm} />}
                </g>
                {standPlacement && chairArcStandTemplate && (
                  <g
                    className="chair-arc-stand symbol-object"
                    transform={"translate(" + standPlacement.xMm + " " + standPlacement.yMm + ") rotate(" + standPlacement.rotationDeg + ")"}
                  >
                    {standSymbolId
                      ? <use className="symbol-use" href={"#" + standSymbolId} x={-chairArcStandTemplate.widthMm / 2} y={-chairArcStandTemplate.depthMm / 2} width={chairArcStandTemplate.widthMm} height={chairArcStandTemplate.depthMm} />
                      : <rect x={-chairArcStandTemplate.widthMm / 2} y={-chairArcStandTemplate.depthMm / 2} width={chairArcStandTemplate.widthMm} height={chairArcStandTemplate.depthMm} />}
                  </g>
                )}
              </g>
            );
          })}
        </g>
        <g className="chair-arc-handles">
          {/* 円弧補助線自体を距離ドラッグの当たり判定にする。線に沿った44px幅の帯なので、
              ハンドル同士が重ならず、列間隔が狭くてもタップ領域を確保できる。 */}
          {rowRadii.map((radiusMm, rowIndex) => (
            <path
              key={"chair-arc-guide-hit-" + rowIndex}
              className="chair-arc-guide-hit"
              data-chair-arc-handle={rowIndex === 0 ? "firstGap" : "rowGap"}
              data-chair-arc-row={rowIndex}
              d={arcPath(radiusMm)}
              pointerEvents="stroke"
              strokeWidth={Math.max(44 / view.zoom, 300)}
            />
          ))}
          <g data-chair-arc-handle="direction">
            <circle className="chair-arc-hit" pointerEvents="all" cx={directionHandle.x} cy={directionHandle.y} r={hitRadiusMm} />
            <circle className="chair-arc-handle" pointerEvents="none" cx={directionHandle.x} cy={directionHandle.y} r={150} />
          </g>
          <g data-chair-arc-handle="arcEnd">
            <circle className="chair-arc-hit" pointerEvents="all" cx={startHandle.x} cy={startHandle.y} r={hitRadiusMm} />
            <circle className="chair-arc-handle" pointerEvents="none" cx={startHandle.x} cy={startHandle.y} r={150} />
          </g>
          <g data-chair-arc-handle="arcEnd">
            <circle className="chair-arc-hit" pointerEvents="all" cx={endHandle.x} cy={endHandle.y} r={hitRadiusMm} />
            <circle className="chair-arc-handle" pointerEvents="none" cx={endHandle.x} cy={endHandle.y} r={150} />
          </g>
        </g>
      </>
    );
  }

  /**
   * 弦楽器テンプレの列補助線。指揮者位置を中心とした同心円で、
   * 円そのものをドラッグの当たり判定にする(椅子円弧配置と同じ操作)。
   */
  function renderStringRowGuides() {
    if (!stringTemplate || !stringTemplateCenterMm) return null;
    // 位置補正で全体をずらしていても、補助線と実際の列は重なる必要がある。
    const center = stageLocalPointMm(
      stringTemplateCenterMm, stringTemplate.lateralOffsetMm, stringTemplate.depthOffsetMm);
    const scale = stringTemplate.spreadScale > 0 ? stringTemplate.spreadScale : 1;
    const radii = Array.from({ length: stringLayoutRowCount(stringTemplate.seatingVariantId, stringTemplate.ensembleTypeId) }, (_, rowIndex) =>
      stringLayout12RowRadiusMm(stringTemplate, rowIndex) * scale);
    if (!radii.every((radiusMm) => Number.isFinite(radiusMm) && radiusMm > 0)) return null;
    // 全プルトの方位角は-90〜+90度なので、客席側の半分は使わない。舞台奥側の半円だけ描く。
    const semicircle = (radiusMm: number) => {
      const left = { x: center.xMm - STAGE_RIGHT_DIRECTION.xMm * radiusMm, y: center.yMm - STAGE_RIGHT_DIRECTION.yMm * radiusMm };
      const right = { x: center.xMm + STAGE_RIGHT_DIRECTION.xMm * radiusMm, y: center.yMm + STAGE_RIGHT_DIRECTION.yMm * radiusMm };
      // 舞台奥(STAGE_DEPTH_DIRECTION)側を通る側の半円を選ぶ
      const sweep = STAGE_RIGHT_DIRECTION.xMm * STAGE_DEPTH_DIRECTION.yMm
        - STAGE_RIGHT_DIRECTION.yMm * STAGE_DEPTH_DIRECTION.xMm > 0 ? 0 : 1;
      return `M ${left.x} ${left.y} A ${radiusMm} ${radiusMm} 0 0 ${sweep} ${right.x} ${right.y}`;
    };
    return (
      <g className="string-row-guides">
        {/* 中心ハンドル。ドラッグで左右・前後の位置補正をまとめて変える。 */}
        <g data-string-center="1">
          <circle
            className="string-center-hit"
            pointerEvents="all"
            cx={center.xMm}
            cy={center.yMm}
            r={Math.max(22 / view.zoom, 260)}
          />
          <circle className="string-row-center" pointerEvents="none" cx={center.xMm} cy={center.yMm} r={140} />
          <line className="string-center-cross" pointerEvents="none"
            x1={center.xMm - 420} y1={center.yMm} x2={center.xMm + 420} y2={center.yMm} />
          <line className="string-center-cross" pointerEvents="none"
            x1={center.xMm} y1={center.yMm - 420} x2={center.xMm} y2={center.yMm + 420} />
        </g>
        {radii.map((radiusMm, rowIndex) => (
          <g key={"string-row-" + rowIndex}>
            <path className="string-row-guide" pointerEvents="none" d={semicircle(radiusMm)} />
            <path
              className="string-row-guide-hit"
              data-string-row={rowIndex}
              pointerEvents="stroke"
              d={semicircle(radiusMm)}
              strokeWidth={Math.max(44 / view.zoom, 300)}
            />
          </g>
        ))}
      </g>
    );
  }

  function renderAimPointPreview() {
    if (mode !== "aimPoint" || !aimPointPreview) return null;
    const radiusMm = Math.max(120, 14 / view.zoom);
    const armMm = radiusMm * 2.2;
    const labelSizeMm = Math.max(120, 16 / view.zoom);
    return (
      <g className="aim-point-preview" pointerEvents="none" aria-hidden="true">
        <circle cx={aimPointPreview.xMm} cy={aimPointPreview.yMm} r={radiusMm} />
        <line x1={aimPointPreview.xMm - armMm} y1={aimPointPreview.yMm} x2={aimPointPreview.xMm + armMm} y2={aimPointPreview.yMm} />
        <line x1={aimPointPreview.xMm} y1={aimPointPreview.yMm - armMm} x2={aimPointPreview.xMm} y2={aimPointPreview.yMm + armMm} />
        <text x={aimPointPreview.xMm + armMm} y={aimPointPreview.yMm - armMm} fontSize={labelSizeMm}>{"\u6307\u5b9a\u70b9"}</text>
      </g>
    );
  }
  function renderSelectionBounds() {
    if (!selectionBounds) return null;
    const widthMm = Math.max(1, selectionBounds.maxXMm - selectionBounds.minXMm);
    const heightMm = Math.max(1, selectionBounds.maxYMm - selectionBounds.minYMm);
    return (
      <g className="selection-bounds-overlay" pointerEvents="none" role="status" aria-live="polite" aria-label={selectedIds.length + "\u500b\u3092\u9078\u629e\u4e2d"}>
        <rect className="selection-bounds" x={selectionBounds.minXMm} y={selectionBounds.minYMm} width={widthMm} height={heightMm} />

      </g>
    );
  }

  function renderLineArrangementGuide() {
    if (!lineArrangement) return null;
    const session = lineArrangement;
    const guide = lineArrangementGuide(project.objects, session.ids, session.axis);
    if (!guide) return null;
    const hitRadiusMm = Math.max(120, 34 / view.zoom);
    function handleLineArrangementKeyDown(event: ReactKeyboardEvent<SVGGElement>) {
      if (!onLineArrangementChange) return;
      const positiveKey = session.axis === "x" ? "ArrowRight" : "ArrowDown";
      const negativeKey = session.axis === "x" ? "ArrowLeft" : "ArrowUp";
      if (event.key !== positiveKey && event.key !== negativeKey && event.key !== "Home") return;
      event.preventDefault();
      const stepMm = event.shiftKey ? 100 : 10;
      const nextGapMm = event.key === "Home"
        ? 0
        : Math.max(0, Math.round(session.gapMm + (event.key === positiveKey ? stepMm : -stepMm)));
      onLineArrangementChange({ ...session, gapMm: nextGapMm });
    }
    const handleProps = {
      role: "slider" as const,
      tabIndex: 0,
      "aria-label": "\u4e00\u76f4\u7dda\u914d\u7f6e\u306e\u9593\u9694\u30cf\u30f3\u30c9\u30eb",
      "aria-valuemin": 0,
      "aria-valuenow": Math.max(0, Number.isFinite(session.gapMm) ? session.gapMm : 0),
      "aria-orientation": session.axis === "x" ? "horizontal" as const : "vertical" as const,
      onKeyDown: handleLineArrangementKeyDown,
    };
    return session.axis === "x"
      ? <g className="line-arrangement-guide horizontal"><line className="line-arrangement-axis" x1={guide.startXMm} y1={guide.lineYMm} x2={guide.endXMm} y2={guide.lineYMm} /><g data-line-arrangement-handle="true" {...handleProps}><circle className="line-arrangement-hit" pointerEvents="all" cx={guide.handleXMm} cy={guide.handleYMm} r={hitRadiusMm} /><circle className="line-arrangement-handle" pointerEvents="none" cx={guide.handleXMm} cy={guide.handleYMm} r={120} /></g></g>
      : <g className="line-arrangement-guide vertical"><line className="line-arrangement-axis" x1={guide.lineXMm} y1={guide.startYMm} x2={guide.lineXMm} y2={guide.endYMm} /><g data-line-arrangement-handle="true" {...handleProps}><circle className="line-arrangement-hit" pointerEvents="all" cx={guide.handleXMm} cy={guide.handleYMm} r={hitRadiusMm} /><circle className="line-arrangement-handle" pointerEvents="none" cx={guide.handleXMm} cy={guide.handleYMm} r={120} /></g></g>;
  }


  return (
    <svg
      ref={svgRef}
      className="canvas-stage"
      tabIndex={0}
      role="application"
      aria-label="舞台配置キャンバス。選択中は矢印キーで10mm移動、Shift+矢印で100mm移動"
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onKeyDown={handleCanvasKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
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

        {renderSnapGrid()}
        <GuideOverlay project={project} bounds={guideBounds} zoom={view.zoom} />
        {sortedObjects.map(renderObject)}
        {renderSelectionBounds()}
        <SmartAlignmentGuideOverlay guides={alignmentGuides} zoom={view.zoom} />
        {renderAimPointPreview()}
        {renderConcertTomSetLabels()}
        {project.walls.map(renderWall)}
        {renderWallDraft()}
        {renderAnnotationPreview()}
        {renderTemplatePreview()}
        {renderRiserPreview()}
        {renderChairLinePreview()}
        {renderStringRowGuides()}
        {renderLineArrangementGuide()}
        {renderChairArcPreview()}

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
