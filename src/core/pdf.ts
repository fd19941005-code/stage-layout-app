// PDF入力(FR-011)はPDF.jsをアプリへ同梱してブラウザ内だけで処理する。
// CDNや外部サーバーへPDFデータを送信しない(NFR-008、NFR-015)。

import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfPageImage {
  pageNumber: number;
  imageDataUrl: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

export const PDF_RENDER_SCALE = 1.5;

export function isSupportedBackgroundFile(file: Pick<File, "name" | "type">): boolean {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" ||
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    /\.(pdf|png|jpe?g)$/.test(lowerName);
}

export function isPdfFile(file: Pick<File, "name" | "type">): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** PDFの全ページをPNGへ描画し、ページ選択に使える自己完結データを返す */
export async function renderPdfPages(file: Blob): Promise<PdfPageImage[]> {
  if (file.size <= 0) {
    throw new Error("PDFファイルが空です");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | undefined;
  try {
    loadingTask = pdfjsLib.getDocument({ data });
    const document = await loadingTask.promise;
    const pages: PdfPageImage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = window.document.createElement("canvas");
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
    await document.destroy();
    return pages;
  } catch (error) {
    await loadingTask?.destroy();
    if (error instanceof Error && error.message.startsWith("PDF")) {
      throw error;
    }
    throw new Error("PDFを読み込めません。破損しているか、対応していない形式です");
  }
}
