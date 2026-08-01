import type { SceneObject } from "./project";

/** ユーザーテンプレート専用のJSON形式。ProjectのschemaVersionとは別管理する。 */
export const USER_TEMPLATE_SCHEMA_VERSION = "1.0.0" as const;
export const USER_TEMPLATE_KIND = "stage-layout-user-template" as const;
export const USER_TEMPLATE_BUNDLE_KIND = "stage-layout-user-template-bundle" as const;
export const USER_TEMPLATE_ORIGIN = "selection-center" as const;

/** レイヤーとロック状態を除いた、テンプレート内の配置物。座標は原点からの相対mm。 */
export type UserTemplateObject = Omit<SceneObject, "layerId" | "locked">;

export interface UserTemplate {
  kind: typeof USER_TEMPLATE_KIND;
  schemaVersion: typeof USER_TEMPLATE_SCHEMA_VERSION;
  origin: typeof USER_TEMPLATE_ORIGIN;
  id: string;
  name: string;
  objects: UserTemplateObject[];
  createdAt: string;
  updatedAt: string;
}

export interface UserTemplateBundle {
  kind: typeof USER_TEMPLATE_BUNDLE_KIND;
  schemaVersion: typeof USER_TEMPLATE_SCHEMA_VERSION;
  templates: UserTemplate[];
}
