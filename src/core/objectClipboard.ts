// オブジェクトのアプリ内クリップボード。Projectには保存せず、貼り付け時だけ
// 現在のプロジェクトへ解決することで、保存形式とUndo履歴を汚染しない。

import type { PointMm, Project, SceneObject } from "../types/project";
import { selectionBoundsMm } from "./layout";

export interface ObjectClipboard {
  readonly sourceProjectId: string;
  readonly objects: readonly SceneObject[];
}

export interface PasteObjectsOptions {
  readonly cursorMm: PointMm | null;
  readonly preservePosition: boolean;
}

export type ClipboardIdFactory = (prefix: string) => string;

function layerIsLocked(project: Project, layerId: string): boolean {
  return project.layers.find((layer) => layer.id === layerId)?.locked ?? false;
}

function layerIsVisible(project: Project, layerId: string): boolean {
  return project.layers.find((layer) => layer.id === layerId)?.visible ?? true;
}

function layerIsEditable(project: Project, layerId: string): boolean {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  return Boolean(layer && layer.visible && !layer.locked);
}

function cloneObject(object: SceneObject): SceneObject {
  return {
    ...object,
    ...(object.style ? { style: { ...object.style } } : {}),
  };
}

/** 選択中の可視かつ通常編集対象のオブジェクトだけを、保存・履歴とは独立した値へ取り込む。 */
export function createObjectClipboard(project: Project, selectedIds: readonly string[]): ObjectClipboard | null {
  const selected = new Set(selectedIds);
  const objects = project.objects
    .filter((object) => selected.has(object.id) && object.visible && layerIsVisible(project, object.layerId) && !object.backgroundFixed)
    .map(cloneObject);
  if (objects.length === 0) return null;
  return { sourceProjectId: project.id, objects };
}

export function hasLockedObjectInSelection(project: Project, selectedIds: readonly string[]): boolean {
  return selectedIds.some((id) => {
    const object = project.objects.find((candidate) => candidate.id === id);
    return Boolean(object && (object.locked || layerIsLocked(project, object.layerId)));
  });
}

export function hasProtectedObjectInSelection(project: Project, selectedIds: readonly string[]): boolean {
  return selectedIds.some((id) => {
    const object = project.objects.find((candidate) => candidate.id === id);
    return Boolean(object && (object.locked || object.backgroundFixed || layerIsLocked(project, object.layerId)));
  });
}


/** 切り取りはロック物を含む選択を部分処理しない。 */
export function isCuttableSelection(project: Project, selectedIds: readonly string[]): boolean {
  if (selectedIds.length === 0) return false;
  return selectedIds.every((id) => {
    const object = project.objects.find((candidate) => candidate.id === id);
    return Boolean(object && !object.locked && !object.backgroundFixed && !layerIsLocked(project, object.layerId));
  });
}

function editableActiveLayerId(project: Project, activeLayerId: string): string | null {
  if (layerIsEditable(project, activeLayerId)) return activeLayerId;
  return project.layers.find((layer) => layer.visible && !layer.locked)?.id ?? null;
}

function pasteLayerId(
  object: SceneObject,
  clipboard: ObjectClipboard,
  project: Project,
  activeLayerId: string,
): string | null {
  if (clipboard.sourceProjectId === project.id && layerIsEditable(project, object.layerId)) {
    return object.layerId;
  }
  return editableActiveLayerId(project, activeLayerId);
}

function translateNumber(value: number | null | undefined, delta: number): number | null | undefined {
  return typeof value === "number" ? value + delta : value;
}

/** クリップボード内容を現在のプロジェクトへ貼り付け可能なオブジェクトへ変換する。 */
export function createPastedObjects(
  clipboard: ObjectClipboard,
  project: Project,
  activeLayerId: string,
  options: PasteObjectsOptions,
  idFactory: ClipboardIdFactory,
): SceneObject[] {
  if (clipboard.objects.length === 0) return [];

  const sourceObjects = clipboard.objects.filter((object) => !object.backgroundFixed);
  if (sourceObjects.length === 0) return [];
  const sourceIds = sourceObjects.map((object) => object.id);
  const idMap = new Map<string, string>(sourceIds.map((id) => [id, idFactory("obj")]));
  const groupIdMap = new Map<string, string>();
  for (const object of sourceObjects) {
    if (object.groupId && !groupIdMap.has(object.groupId)) {
      groupIdMap.set(object.groupId, idFactory("group"));
    }
  }

  const bounds = selectionBoundsMm(clipboard.objects, sourceIds);
  if (!bounds) return [];
  const sourceCenter = {
    xMm: (bounds.minXMm + bounds.maxXMm) / 2,
    yMm: (bounds.minYMm + bounds.maxYMm) / 2,
  };
  const cursor = options.cursorMm
    && Number.isFinite(options.cursorMm.xMm)
    && Number.isFinite(options.cursorMm.yMm)
    ? options.cursorMm
    : null;
  const delta = options.preservePosition
    ? { xMm: 0, yMm: 0 }
    : cursor
      ? { xMm: cursor.xMm - sourceCenter.xMm, yMm: cursor.yMm - sourceCenter.yMm }
      : { xMm: 500, yMm: 500 };
  const sourceProjectObjectIds = new Set(project.objects.map((object) => object.id));
  const sameProject = clipboard.sourceProjectId === project.id;
  const maxZIndex = project.objects.reduce(
    (maximum, object) => Math.max(maximum, Number.isFinite(object.zIndex) ? object.zIndex : -1),
    -1,
  );

  return sourceObjects.flatMap((source, index) => {
    const id = idMap.get(source.id);
    const layerId = pasteLayerId(source, clipboard, project, activeLayerId);
    if (!id || !layerId) return [];

    const onRiserId = typeof source.onRiserId === "string"
      ? idMap.get(source.onRiserId)
        ?? (sameProject && sourceProjectObjectIds.has(source.onRiserId) ? source.onRiserId : null)
      : null;
    const groupId = source.groupId ? groupIdMap.get(source.groupId) ?? null : null;
    return [{
      ...cloneObject(source),
      id,
      xMm: source.xMm + delta.xMm,
      yMm: source.yMm + delta.yMm,
      endXMm: translateNumber(source.endXMm, delta.xMm),
      endYMm: translateNumber(source.endYMm, delta.yMm),
      onRiserId,
      groupId,
      layerId,
      locked: false,
      zIndex: maxZIndex + 1 + index,
    } satisfies SceneObject];
  });
}
