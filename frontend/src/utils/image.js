/**
 * Reduce la foto en el navegador antes de subirla (máx. 1600 px, JPEG),
 * así las 5+ fotos por vehículo se suben rápido incluso desde el celular.
 */
export async function compressImage(file, maxSize = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} no es una imagen.`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`No se pudo leer ${file.name}. Usa JPG, PNG o WEBP.`);
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error(`No se pudo procesar ${file.name}.`);
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
