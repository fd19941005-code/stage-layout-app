import type { FileOpenOptions, FileSaveRequest, FileService, AppFile } from "../contracts";
import { copyToArrayBuffer } from "./binary";

function readFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

/** Web版のファイル選択とBlobダウンロード実装。UIはこのDOM処理を直接扱わない。 */
export class WebFileService implements FileService {
  openFile(options: FileOpenOptions): Promise<AppFile | null> {
    if (typeof document === "undefined") {
      return Promise.reject(new Error("ファイル選択を利用できる環境ではありません"));
    }

    return new Promise<AppFile | null>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = options.accept.join(",");
      input.hidden = true;
      let settled = false;

      const cleanup = () => {
        input.removeEventListener("change", handleChange);
        input.removeEventListener("cancel", handleCancel);
        input.remove();
      };
      const finish = (result: AppFile | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error("ファイルを読み込めません"));
      };
      const handleCancel = () => finish(null);
      const handleChange = () => {
        const selected = input.files?.[0];
        if (!selected) {
          finish(null);
          return;
        }
        void readFileBytes(selected)
          .then((bytes) => finish({
            name: selected.name,
            type: selected.type,
            size: selected.size,
            lastModified: selected.lastModified,
            bytes,
          }))
          .catch(fail);
      };

      input.addEventListener("change", handleChange);
      input.addEventListener("cancel", handleCancel);
      document.body.appendChild(input);
      input.click();
    });
  }

  async saveFile(request: FileSaveRequest): Promise<void> {
    if (typeof document === "undefined") {
      throw new Error("ファイル保存を利用できる環境ではありません");
    }
    const body = typeof request.data === "string" ? request.data : copyToArrayBuffer(request.data);
    const blob = new Blob([body], { type: request.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = request.filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  }
}
