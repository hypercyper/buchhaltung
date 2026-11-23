// Hand a generated file to the user: Web Share API (phone share sheet) or plain download.

/** Thrown when sharing needs a fresh tap (iOS: the generation took too long after the click). */
export class NeedsTapError extends Error {}

export async function shareOrDownload(data: BlobPart, fileName: string, mimeType: string): Promise<void> {
  const file = new File([data], fileName, { type: mimeType });
  // Share sheet only on phones/tablets; on a computer a normal download is what people expect.
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (touchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // user closed the sheet
      if (error instanceof DOMException && error.name === 'NotAllowedError') throw new NeedsTapError();
      // Other failure: fall back to download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const PDF_MIME = 'application/pdf';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const JSON_MIME = 'application/json';
