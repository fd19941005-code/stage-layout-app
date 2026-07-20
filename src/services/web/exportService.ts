import type {
  ExportArtifact,
  ExportService,
  PdfExportOptions,
  PngExportOptions,
} from "../contracts";
import type { Project } from "../../types/project";
import { createProjectPdf, renderProjectToPng } from "../../core/export";

async function artifactFromBlob(blob: Blob, extension: ExportArtifact["extension"]): Promise<ExportArtifact> {
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    mimeType: blob.type,
    extension,
  };
}

/** Web版のCanvas/pdf-lib出力を、ダウンロードから切り離して公開する。 */
export class WebExportService implements ExportService {
  async exportPng(project: Project, options: PngExportOptions): Promise<ExportArtifact> {
    return artifactFromBlob(await renderProjectToPng(project, options), "png");
  }

  async exportPdf(project: Project, options: PdfExportOptions): Promise<ExportArtifact> {
    return artifactFromBlob(await createProjectPdf(project, options), "pdf");
  }
}
