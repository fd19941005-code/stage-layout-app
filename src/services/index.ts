import { createWebServices } from "./web/createWebServices";

export type {
  AppFile,
  AppServices,
  AutosaveService,
  ExportArtifact,
  ExportService,
  FileOpenOptions,
  FileSaveRequest,
  FileService,
  ImageService,
  LoadedImage,
  PdfPageImage,
  PdfService,
  ProjectService,
  SettingsService,
  UserTemplateService,
} from "./contracts";
export { isPdfFile, isSupportedBackgroundFile } from "./fileTypes";
export { DEFAULT_EXPORT_LAYERS } from "../core/export";
export type { ExportLayerOptions, PdfExportOptions, PngExportOptions } from "./contracts";
export { createWebServices } from "./web/createWebServices";

/** UIが利用する現在の実行環境のサービス集合。 */
export const appServices = createWebServices();
