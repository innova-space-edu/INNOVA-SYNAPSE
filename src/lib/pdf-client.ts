/**
 * Turn the base64 PDF produced by the private compiler into a browser-managed
 * Blob. Data-URI PDF iframes may render blank in Chromium/Edge, especially for
 * large documents. Blob URLs are suitable for both preview and download.
 *
 * Never inject arbitrary HTML or URL content from the PDF response.
 */
export function pdfBlobFromBase64(base64: string): Blob {
  // Compiler has a 15 MiB output ceiling; reject unexpectedly large responses.
  if (typeof base64 !== 'string' || !base64 || base64.length > 22_000_000) {
    throw new Error('El PDF está vacío o excede el tamaño admitido.');
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error('El compilador devolvió un archivo PDF con codificación inválida.');
  }
  if (!binary.startsWith('%PDF-') || !binary.slice(-2048).includes('%%EOF')) {
    throw new Error('El archivo recibido no contiene un PDF completo. Revisa el registro de compilación.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}
