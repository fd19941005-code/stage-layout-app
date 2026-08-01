import type {
  AnnotationKind,
  ObjectType,
  Project,
  SceneObject,
  ShapeKind,
} from "../types/project";
import {
  USER_TEMPLATE_BUNDLE_KIND,
  USER_TEMPLATE_KIND,
  USER_TEMPLATE_ORIGIN,
  USER_TEMPLATE_SCHEMA_VERSION,
  type UserTemplate,
  type UserTemplateBundle,
  type UserTemplateObject,
} from "../types/userTemplate";
import { selectionBoundsMm } from "./layout";
import { normalizeDeg, sceneObjectBoundsMm } from "./transform";
import { parseObjectStyle } from "./visualStyle";

export type UserTemplateIdFactory = (prefix: string) => string;

export interface TemplatePlacementPoint {
  xMm: number;
  yMm: number;
}

const OBJECT_TYPES: readonly ObjectType[] = ["chair", "musicStand", "podium", "riser", "instrument", "shape", "text"];
const ANNOTATION_KINDS: readonly AnnotationKind[] = ["text", "line", "arrow", "rect", "circle", "dimension"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectType(value: unknown): value is ObjectType {
  return typeof value === "string" && OBJECT_TYPES.includes(value as ObjectType);
}

function isAnnotationKind(value: unknown): value is AnnotationKind {
  return typeof value === "string" && ANNOTATION_KINDS.includes(value as AnnotationKind);
}

function isShapeKind(value: unknown): value is ShapeKind {
  return value === "rect" || value === "circle";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return finiteNumber(value) ? value : undefined;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function cloneTemplateObject(object: UserTemplateObject): UserTemplateObject {
  return {
    ...object,
    ...(object.style ? { style: { ...object.style } } : {}),
  };
}

export function cloneUserTemplate(template: UserTemplate): UserTemplate {
  return {
    ...template,
    objects: template.objects.map(cloneTemplateObject),
  };
}

/** テンプレート名を保存用に正規化する。空名や過剰な長さは受け付けない。 */
export function normalizeUserTemplateName(value: string): string | null {
  const name = value.trim().slice(0, 100);
  return name.length > 0 ? name : null;
}

function objectIsVisible(project: Project, object: SceneObject): boolean {
  const layer = project.layers.find((candidate) => candidate.id === object.layerId);
  return object.visible && (layer?.visible ?? true);
}

function boundsContainObject(
  bounds: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number },
  object: SceneObject,
): boolean {
  const objectBounds = sceneObjectBoundsMm(object);
  const epsilon = 0.000001;
  return objectBounds.minXMm >= bounds.minXMm - epsilon
    && objectBounds.minYMm >= bounds.minYMm - epsilon
    && objectBounds.maxXMm <= bounds.maxXMm + epsilon
    && objectBounds.maxYMm <= bounds.maxYMm + epsilon;
}

function addGroupMembers(project: Project, ids: Set<string>): void {
  const groupIds = new Set(
    project.objects
      .filter((object) => ids.has(object.id) && object.groupId)
      .map((object) => object.groupId as string),
  );
  project.objects.forEach((object) => {
    if (object.groupId && groupIds.has(object.groupId) && objectIsVisible(project, object)) ids.add(object.id);
  });
}

/**
 * 選択範囲からテンプレートを作る。背景・壁・Project設定・レイヤーは取り込まず、
 * 選択範囲の外接矩形中心を原点としたmm相対座標だけを保持する。
 */
export function createUserTemplate(
  project: Project,
  selectedIds: readonly string[],
  name: string,
  idFactory: UserTemplateIdFactory,
  now = new Date().toISOString(),
): UserTemplate | null {
  const normalizedName = normalizeUserTemplateName(name);
  if (!normalizedName) return null;

  const ids = new Set(
    project.objects
      .filter((object) => selectedIds.includes(object.id) && objectIsVisible(project, object))
      .map((object) => object.id),
  );
  if (ids.size === 0) return null;
  addGroupMembers(project, ids);

  const initialBounds = selectionBoundsMm(project.objects, [...ids]);
  if (!initialBounds) return null;

  // 山台が範囲内にある場合は、範囲内の載置物も同時に取り込む。
  // 選択物が山台を直接参照している場合は、関連を壊さないため山台自体も含める。
  const riserIds = new Set(
    project.objects
      .filter((object) => object.type === "riser" && objectIsVisible(project, object))
      .filter((object) => ids.has(object.id) || boundsContainObject(initialBounds, object))
      .map((object) => object.id),
  );
  project.objects.forEach((object) => {
    if (ids.has(object.id) && object.onRiserId) riserIds.add(object.onRiserId);
  });
  project.objects.forEach((object) => {
    if (!objectIsVisible(project, object)) return;
    if (riserIds.has(object.id) || (object.onRiserId && riserIds.has(object.onRiserId) && boundsContainObject(initialBounds, object))) {
      ids.add(object.id);
    }
  });
  addGroupMembers(project, ids);

  const objects = project.objects.filter((object) => ids.has(object.id) && objectIsVisible(project, object));
  const bounds = selectionBoundsMm(objects, objects.map((object) => object.id));
  if (!bounds) return null;
  const origin = {
    xMm: (bounds.minXMm + bounds.maxXMm) / 2,
    yMm: (bounds.minYMm + bounds.maxYMm) / 2,
  };
  const objectIds = new Set(objects.map((object) => object.id));
  const riserObjectIds = new Set(objects.filter((object) => object.type === "riser").map((object) => object.id));

  const templateObjects = objects.map((object): UserTemplateObject => ({
    id: object.id,
    type: object.type,
    presetId: object.presetId,
    ...(object.assetVariantId ? { assetVariantId: object.assetVariantId } : {}),
    name: object.name,
    xMm: object.xMm - origin.xMm,
    yMm: object.yMm - origin.yMm,
    widthMm: object.widthMm,
    depthMm: object.depthMm,
    heightMm: object.heightMm,
    rotationDeg: normalizeDeg(object.rotationDeg),
    label: object.label,
    onRiserId: object.onRiserId && objectIds.has(object.onRiserId) && riserObjectIds.has(object.onRiserId)
      ? object.onRiserId
      : null,
    avatar: object.avatar,
    visible: object.visible,
    groupId: object.groupId,
    zIndex: object.zIndex,
    shape: object.shape,
    ...(object.style ? { style: { ...object.style } } : {}),
    annotationKind: object.annotationKind ?? null,
    endXMm: typeof object.endXMm === "number" ? object.endXMm - origin.xMm : null,
    endYMm: typeof object.endYMm === "number" ? object.endYMm - origin.yMm : null,
  }));

  return {
    kind: USER_TEMPLATE_KIND,
    schemaVersion: USER_TEMPLATE_SCHEMA_VERSION,
    origin: USER_TEMPLATE_ORIGIN,
    id: idFactory("user-template"),
    name: normalizedName,
    objects: templateObjects,
    createdAt: now,
    updatedAt: now,
  };
}

function parseTemplateObject(value: unknown): UserTemplateObject | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.length > 0 ? value.id : null;
  const type = isObjectType(value.type) ? value.type : null;
  const presetId = value.presetId === null || typeof value.presetId === "string" ? value.presetId : undefined;
  const assetVariantId = value.assetVariantId === undefined
    ? undefined
    : typeof value.assetVariantId === "string" && value.assetVariantId.length > 0
      ? value.assetVariantId
      : null;
  const name = typeof value.name === "string" ? value.name : null;
  const xMm = value.xMm;
  const yMm = value.yMm;
  const widthMm = value.widthMm;
  const depthMm = value.depthMm;
  const heightMm = value.heightMm;
  const rotationDeg = value.rotationDeg;
  const label = typeof value.label === "string" ? value.label : null;
  const onRiserId = nullableString(value.onRiserId);
  const avatar = nullableString(value.avatar);
  const groupId = nullableString(value.groupId);
  const zIndex = value.zIndex;
  const shape = isShapeKind(value.shape) ? value.shape : null;
  const annotationKind = value.annotationKind === undefined || value.annotationKind === null
    ? null
    : isAnnotationKind(value.annotationKind) ? value.annotationKind : null;
  const endXMm = optionalNumber(value.endXMm);
  const endYMm = optionalNumber(value.endYMm);
  const styleValue = value.style;
  const style = styleValue === undefined || styleValue === null
    ? undefined
    : isRecord(styleValue) ? parseObjectStyle(styleValue) : null;

  if (!id || !type || !name || presetId === undefined || assetVariantId === null
    || !finiteNumber(xMm) || !finiteNumber(yMm)
    || !finiteNumber(widthMm) || widthMm <= 0 || !finiteNumber(depthMm) || depthMm <= 0
    || !finiteNumber(heightMm) || heightMm < 0 || !finiteNumber(rotationDeg)
    || label === null || onRiserId === undefined || avatar === undefined || groupId === undefined
    || !finiteNumber(zIndex) || !shape || annotationKind === null && value.annotationKind !== undefined && value.annotationKind !== null
    || endXMm === undefined || endYMm === undefined || style === null
    || typeof value.visible !== "boolean") {
    return null;
  }
  if ((annotationKind === "line" || annotationKind === "arrow" || annotationKind === "dimension")
    && (endXMm === null || endYMm === null)) return null;

  return {
    id,
    type,
    presetId,
    ...(assetVariantId ? { assetVariantId } : {}),
    name,
    xMm,
    yMm,
    widthMm,
    depthMm,
    heightMm,
    rotationDeg: normalizeDeg(rotationDeg),
    label,
    onRiserId,
    avatar,
    visible: value.visible,
    groupId,
    zIndex,
    shape,
    ...(style ? { style } : {}),
    annotationKind,
    endXMm,
    endYMm,
  };
}

function parseTemplate(value: unknown): UserTemplate | null {
  if (!isRecord(value)
    || value.kind !== USER_TEMPLATE_KIND
    || value.schemaVersion !== USER_TEMPLATE_SCHEMA_VERSION
    || value.origin !== USER_TEMPLATE_ORIGIN
    || typeof value.id !== "string" || value.id.length === 0
    || typeof value.name !== "string" || !normalizeUserTemplateName(value.name)
    || !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)
    || !Array.isArray(value.objects) || value.objects.length === 0 || value.objects.length > 10000) {
    return null;
  }
  const objects = value.objects.map(parseTemplateObject);
  if (objects.some((object) => object === null)) return null;
  const parsedObjects = objects as UserTemplateObject[];
  const ids = new Set<string>();
  for (const object of parsedObjects) {
    if (ids.has(object.id)) return null;
    ids.add(object.id);
  }
  for (const object of parsedObjects) {
    if (object.onRiserId !== null) {
      const riser = parsedObjects.find((candidate) => candidate.id === object.onRiserId);
      if (!riser || riser.type !== "riser") return null;
    }
  }
  return {
    kind: USER_TEMPLATE_KIND,
    schemaVersion: USER_TEMPLATE_SCHEMA_VERSION,
    origin: USER_TEMPLATE_ORIGIN,
    id: value.id,
    name: normalizeUserTemplateName(value.name) as string,
    objects: parsedObjects.map(cloneTemplateObject),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

/** IndexedDBレコードとJSON入力の両方を検証する。失敗時はnullを返して安全に拒否する。 */
export function validateUserTemplate(value: unknown): UserTemplate | null {
  return parseTemplate(value);
}

export function serializeUserTemplates(templates: readonly UserTemplate[]): string {
  const bundle: UserTemplateBundle = {
    kind: USER_TEMPLATE_BUNDLE_KIND,
    schemaVersion: USER_TEMPLATE_SCHEMA_VERSION,
    templates: templates.map(cloneUserTemplate),
  };
  return JSON.stringify(bundle, null, 2);
}

/** 単体形式と一括形式の両方を読み込む。1件でも不正なら全体を拒否する。 */
export function deserializeUserTemplates(json: string): UserTemplate[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.schemaVersion !== USER_TEMPLATE_SCHEMA_VERSION) return null;
  if (raw.kind === USER_TEMPLATE_KIND) {
    const template = parseTemplate(raw);
    return template ? [template] : null;
  }
  if (raw.kind !== USER_TEMPLATE_BUNDLE_KIND || !Array.isArray(raw.templates) || raw.templates.length > 1000) return null;
  const templates = raw.templates.map(parseTemplate);
  return templates.some((template) => template === null) ? null : templates as UserTemplate[];
}

export function duplicateUserTemplate(
  template: UserTemplate,
  idFactory: UserTemplateIdFactory,
  now = new Date().toISOString(),
): UserTemplate {
  return {
    ...cloneUserTemplate(template),
    id: idFactory("user-template"),
    name: normalizeUserTemplateName(`${template.name}（複製）`) ?? template.name,
    createdAt: now,
    updatedAt: now,
  };
}

export function reidentifyUserTemplate(
  template: UserTemplate,
  idFactory: UserTemplateIdFactory,
  now = new Date().toISOString(),
): UserTemplate {
  return {
    ...cloneUserTemplate(template),
    id: idFactory("user-template"),
    createdAt: now,
    updatedAt: now,
  };
}

function allocateUniqueId(
  prefix: string,
  usedIds: Set<string>,
  idFactory: UserTemplateIdFactory,
): string | null {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = idFactory(prefix);
    if (typeof id === "string" && id.length > 0 && !usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
  return null;
}

/**
 * テンプレートをクリック位置へ配置可能なSceneObjectへ変換する。
 * 原点以外の座標はすべて相対mmのまま平行移動し、幅・奥行・回転は変更しない。
 */
export function createPlacedObjectsFromUserTemplate(
  template: UserTemplate,
  project: Pick<Project, "objects">,
  activeLayerId: string,
  targetCenterMm: TemplatePlacementPoint,
  idFactory: UserTemplateIdFactory,
): SceneObject[] {
  if (!activeLayerId || !finiteNumber(targetCenterMm.xMm) || !finiteNumber(targetCenterMm.yMm)) return [];
  if (template.objects.length === 0) return [];

  const usedIds = new Set(project.objects.map((object) => object.id));
  project.objects.forEach((object) => { if (object.groupId) usedIds.add(object.groupId); });
  template.objects.forEach((object) => {
    usedIds.add(object.id);
    if (object.groupId) usedIds.add(object.groupId);
  });

  const ordered = [...template.objects].sort((a, b) => a.zIndex - b.zIndex);
  const idMap = new Map<string, string>();
  for (const source of ordered) {
    const id = allocateUniqueId("obj", usedIds, idFactory);
    if (!id) return [];
    idMap.set(source.id, id);
  }
  const groupIdMap = new Map<string, string>();
  for (const source of ordered) {
    if (source.groupId && !groupIdMap.has(source.groupId)) {
      const groupId = allocateUniqueId("group", usedIds, idFactory);
      if (!groupId) return [];
      groupIdMap.set(source.groupId, groupId);
    }
  }

  const maxZIndex = project.objects.reduce(
    (maximum, object) => Math.max(maximum, finiteNumber(object.zIndex) ? object.zIndex : -1),
    -1,
  );
  return ordered.map((source, index) => ({
    id: idMap.get(source.id) as string,
    type: source.type,
    presetId: source.presetId,
    ...(source.assetVariantId ? { assetVariantId: source.assetVariantId } : {}),
    name: source.name,
    xMm: targetCenterMm.xMm + source.xMm,
    yMm: targetCenterMm.yMm + source.yMm,
    widthMm: source.widthMm,
    depthMm: source.depthMm,
    heightMm: source.heightMm,
    rotationDeg: normalizeDeg(source.rotationDeg),
    label: source.label,
    onRiserId: source.onRiserId ? idMap.get(source.onRiserId) ?? null : null,
    avatar: source.avatar,
    // 保存時点のロックはテンプレートへ持ち込まず、配置直後から個別編集できるようにする。
    locked: false,
    visible: source.visible,
    groupId: source.groupId ? groupIdMap.get(source.groupId) ?? null : null,
    layerId: activeLayerId,
    zIndex: maxZIndex + 1 + index,
    shape: source.shape,
    ...(source.style ? { style: { ...source.style } } : {}),
    annotationKind: source.annotationKind ?? null,
    endXMm: typeof source.endXMm === "number" ? targetCenterMm.xMm + source.endXMm : null,
    endYMm: typeof source.endYMm === "number" ? targetCenterMm.yMm + source.endYMm : null,
  } satisfies SceneObject));
}

