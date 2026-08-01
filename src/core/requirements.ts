import type { Layer, Project, SceneObject } from "../types/project";
import { findPreset, instrumentLabelForPreset, OBJECT_PRESETS } from "./presets";

export type RequirementScope = "visible" | "all";

export interface RequirementCount {
  key: string;
  presetId: string | null;
  label: string;
  category: string;
  count: number;
}

export interface RequirementCountOptions {
  scope: RequirementScope;
}

const RISER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "riser-3x6": "山台(3×6)",
  "riser-4x6": "山台(4×6)",
  "riser-6x6": "山台(6×6)",
};

const TYPE_CATEGORIES: Readonly<Record<SceneObject["type"], string>> = {
  chair: "座席・譜面",
  musicStand: "座席・譜面",
  podium: "指揮・平台",
  riser: "指揮・平台",
  instrument: "楽器",
  shape: "汎用",
  text: "その他",
};

const PRESET_ORDER = new Map(OBJECT_PRESETS.map((preset, index) => [preset.id, index]));

function layerIsVisible(layers: readonly Layer[], layerId: string): boolean {
  // Visible-only scope requires both the object and its owning layer to be visible.
  return layers.find((layer) => layer.id === layerId)?.visible === true;
}

function isCountableObject(project: Pick<Project, "objects" | "layers">, object: SceneObject, scope: RequirementScope): boolean {
  // Annotation SceneObjects are drawing aids, not physical items to procure.
  if (object.annotationKind) return false;
  // "all" includes hidden objects/layers; lock state is intentionally irrelevant.
  if (scope === "all") return true;
  return object.visible && layerIsVisible(project.layers, object.layerId);
}

export function requirementDisplayName(object: SceneObject): string {
  if (object.presetId && RISER_DISPLAY_NAMES[object.presetId]) {
    return RISER_DISPLAY_NAMES[object.presetId];
  }
  if (object.presetId) {
    const preset = findPreset(object.presetId);
    if (preset) {
      return instrumentLabelForPreset(object.presetId, "ja") ?? preset.name;
    }
  }
  if (object.name.trim()) return object.name;
  return TYPE_CATEGORIES[object.type] ?? "その他";
}

export function requirementKey(object: SceneObject): string {
  // Known presets stay together even when a user changes the label or dimensions.
  if (object.presetId) return `preset:${object.presetId}`;
  // label is intentionally excluded: it is an annotation/display field and
  // must not split otherwise identical custom physical objects into rows.
  return `custom:${JSON.stringify([object.type, object.name, object.widthMm, object.depthMm])}`;
}

function categoryForObject(object: SceneObject): string {
  return findPreset(object.presetId ?? "")?.category ?? TYPE_CATEGORIES[object.type] ?? "その他";
}

function presetOrderForPresetId(presetId: string | null): number {
  if (!presetId) return Number.MAX_SAFE_INTEGER;
  return PRESET_ORDER.get(presetId) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * project.objectsだけを正本として数量を導出する表示用集計。
 * Canvas上の一時プレビューや保存されていない描画要素は入力に含めず、
 * groupIdも展開せず各子SceneObjectを1枚ずつ数える。
 */
export function countRequiredItems(
  project: Pick<Project, "objects" | "layers">,
  options: RequirementCountOptions,
): RequirementCount[] {
  const rows = new Map<string, RequirementCount>();

  for (const object of project.objects) {
    if (!isCountableObject(project, object, options.scope)) continue;
    const key = requirementKey(object);
    const current = rows.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    rows.set(key, {
      key,
      presetId: object.presetId,
      label: requirementDisplayName(object),
      category: categoryForObject(object),
      count: 1,
    });
  }

  return [...rows.values()].sort((a, b) => {
    const orderDiff = presetOrderForPresetId(a.presetId) - presetOrderForPresetId(b.presetId);
    if (orderDiff !== 0) return orderDiff;
    const categoryDiff = a.category.localeCompare(b.category, "ja");
    if (categoryDiff !== 0) return categoryDiff;
    const labelDiff = a.label.localeCompare(b.label, "ja");
    return labelDiff !== 0 ? labelDiff : a.key.localeCompare(b.key);
  });
}
