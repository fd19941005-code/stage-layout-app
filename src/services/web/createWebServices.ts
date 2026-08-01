import type { AppServices } from "../contracts";
import { WebAutosaveService } from "./autosaveService";
import { WebExportService } from "./exportService";
import { WebFileService } from "./fileService";
import { WebImageService } from "./imageService";
import { WebPdfService } from "./pdfService";
import { WebProjectService } from "./projectService";
import { WebSettingsService } from "./settingsService";
import { WebUserTemplateService } from "./userTemplateService";

/** Web版の実装を一箇所で組み立てる。Tauri版ではこの関数を別実装へ置き換える。 */
export function createWebServices(): AppServices {
  const file = new WebFileService();
  return {
    file,
    image: new WebImageService(),
    pdf: new WebPdfService(),
    exporter: new WebExportService(),
    autosave: new WebAutosaveService(),
    settings: new WebSettingsService(),
    project: new WebProjectService(file),
    templates: new WebUserTemplateService(),
  };
}
