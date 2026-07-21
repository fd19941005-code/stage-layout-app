import type { AppFile, ImageService, LoadedImage } from "../contracts";
import { copyToArrayBuffer } from "./binary";

function imageMimeType(file: AppFile): string {
  if (file.type === "image/png" || file.type === "image/jpeg") return file.type;
  return file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

function readAsDataUrl(file: AppFile): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("画像データを読み込めません"));
        return;
      }
      resolve(reader.result);
    };
    const blob = new Blob([copyToArrayBuffer(file.bytes)], { type: imageMimeType(file) });
    reader.readAsDataURL(blob);
  });
}

/** Web版の画像Data URL化と自然寸法の取得。 */
export class WebImageService implements ImageService {
  async loadImage(file: AppFile): Promise<LoadedImage> {
    const imageDataUrl = await readAsDataUrl(file);
    return new Promise<LoadedImage>((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("画像を解析できません。別のファイルを試してください"));
      image.onload = () => resolve({
        imageDataUrl,
        naturalWidthPx: image.naturalWidth,
        naturalHeightPx: image.naturalHeight,
      });
      image.src = imageDataUrl;
    });
  }
}
