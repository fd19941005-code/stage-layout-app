// PDF.jsはアプリへ同梱し、Web版でもPDFデータを外部へ送信しない。
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { AppFile, PdfPageImage, PdfService } from "../contracts";
import { isPdfFile } from "../fileTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export const PDF_RENDER_SCALE = 1.5;

export { isPdfFile };

/** PDFの全ページをPNGへ描画し、ページ選択に使える自己完結データを返す。 */
export async function renderPdfPages(bytes: Uint8Array): Promise<PdfPageImage[]> {
  if (bytes.byteLength <= 0) {
    throw new Error("PDFファイルが空です");
  }

  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | undefined;
  try {
    loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdfDocument = await loadingTask.promise;
    const pages: PdfPageImage[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("PDFページの描画領域を作成できません");
      }
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push({
        pageNumber,
        imageDataUrl: canvas.toDataURL("image/png"),
        naturalWidthPx: canvas.width,
        naturalHeightPx: canvas.height,
      });
      page.cleanup();
    }
    await pdfDocument.destroy();
    return pages;
  } catch (error) {
    await loadingTask?.destroy();
    if (error instanceof Error && error.message.startsWith("PDF")) {
      throw error;
    }
    throw new Error("PDFを読み込めません。破損しているか、対応していない形式です");
  }
}

export class WebPdfService implements PdfService {
  loadPages(file: AppFile): Promise<PdfPageImage[]> {
    return renderPdfPages(file.bytes);
  }
}
