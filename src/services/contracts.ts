import type {
  ExportLayerOptions,
  PdfExportOptions,
  PngExportOptions,
} from "../core/export";
import type { Project } from "../types/project";
import type { UserTemplate } from "../types/userTemplate";

/**
 * 実行環境に依存しないファイル表現。
 * WebのFileやTauriのパスをUIへ漏らさず、サービス境界ではバイト列だけを扱う。
 */
export interface AppFile {
  name: string;
  type: string;
  size: number;
  lastModified: number | null;
  bytes: Uint8Array;
}

export interface FileOpenOptions {
  accept: readonly string[];
}

export interface FileSaveRequest {
  filename: string;
  mimeType: string;
  data: string | Uint8Array;
}

/** ファイル選択とファイル保存の実行環境差を吸収する。 */
export interface FileService {
  openFile(options: FileOpenOptions): Promise<AppFile | null>;
  saveFile(request: FileSaveRequest): Promise<void>;
}

export interface LoadedImage {
  imageDataUrl: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

/** 画像デコードとData URL化を担当する。 */
export interface ImageService {
  loadImage(file: AppFile): Promise<LoadedImage>;
}

export interface PdfPageImage {
  pageNumber: number;
  imageDataUrl: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

/** PDFページの読み込み・プレビュー描画を担当する。 */
export interface PdfService {
  loadPages(file: AppFile): Promise<PdfPageImage[]>;
}

/** IndexedDBやTauriのローカル領域へプロジェクトを自動保存する。 */
export interface AutosaveService {
  loadProject(): Promise<Project | undefined>;
  saveProject(project: Project): Promise<void>;
}

/** OSやブラウザに依存しないアプリ設定の保存契約。 */
export interface SettingsService {
  read<T>(key: string): Promise<T | undefined>;
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

/** プロジェクトJSONのシリアライズと、名前付きファイル入出力を担当する。 */
export interface ProjectService {
  openProject(): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
}

/** プロジェクトとは独立したユーザーテンプレートのローカル保存契約。 */
export interface UserTemplateService {
  loadTemplates(): Promise<UserTemplate[]>;
  saveTemplates(templates: readonly UserTemplate[]): Promise<void>;
}

export interface ExportArtifact {
  data: Uint8Array;
  mimeType: string;
  extension: "png" | "pdf";
}

/** mm正本からPNG/PDFを生成する。ダウンロード自体はFileServiceへ委譲する。 */
export interface ExportService {
  exportPng(project: Project, options: PngExportOptions): Promise<ExportArtifact>;
  exportPdf(project: Project, options: PdfExportOptions): Promise<ExportArtifact>;
}

export interface AppServices {
  file: FileService;
  image: ImageService;
  pdf: PdfService;
  exporter: ExportService;
  autosave: AutosaveService;
  settings: SettingsService;
  project: ProjectService;
  templates: UserTemplateService;
}

// UIが出力実装(core/export)へ直接依存しないよう、型と既定値をサービス入口から公開する。
export type { ExportLayerOptions, PdfExportOptions, PngExportOptions };
