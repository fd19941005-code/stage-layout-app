import type { AppFile } from "./contracts";

export function isSupportedBackgroundFile(file: Pick<AppFile, "name" | "type">): boolean {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" ||
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    /\.(pdf|png|jpe?g)$/.test(lowerName);
}

export function isPdfFile(file: Pick<AppFile, "name" | "type">): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
