const MAX_EDGE = 1568;
const MAX_BYTES = 8 * 1024 * 1024;

export async function fileToPayload(file: File): Promise<{ image: string; mimeType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件，例如 JPG、PNG 或 WebP");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("图片不能超过 8MB");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器无法处理这张图片");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, 0.86);
  const image = dataUrl.split(",")[1];
  if (!image) {
    throw new Error("图片读取失败");
  }
  return { image, mimeType };
}
