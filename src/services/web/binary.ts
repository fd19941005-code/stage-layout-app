/** Uint8Arrayの共有バッファをそのままBlobへ渡さないための安全なコピー。 */
export function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
