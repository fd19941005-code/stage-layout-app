// 後方互換用の入口。PDFのブラウザ依存処理はservices/webへ移し、
// 既存のcore/pdf.ts利用者からも同じ関数を呼べるように薄く委譲する。

import { isPdfFile, isSupportedBackgroundFile } from "../services/fileTypes";
import { renderPdfPages as renderWebPdfPages, PDF_RENDER_SCALE } from "../services/web/pdfService";
import type { PdfPageImage } from "../services/contracts";

export type { PdfPageImage } from "../services/contracts";
export { isPdfFile, isSupportedBackgroundFile, PDF_RENDER_SCALE };

export async function renderPdfPages(file: Blob | Uint8Array): Promise<PdfPageImage[]> {
  const bytes = file instanceof Uint8Array
    ? file
    : new Uint8Array(await file.arrayBuffer());
  return renderWebPdfPages(bytes);
}
