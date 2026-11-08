/**
 * Opens a native File Save Dialog / Explorer to let user choose destination folder & filename,
 * writes the content, and provides graceful fallbacks.
 */
export async function saveFileWithDialog(
  suggestedName: string,
  content: string,
  mimeType: string,
  extension: string,
  fileDescription: string
): Promise<boolean> {
  // 1. Try modern File System Access API (Supported in Chrome, Edge, and modern WebViews)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: fileDescription,
            accept: {
              [mimeType]: [`.${extension}`]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled the file explorer dialog
        return false;
      }
      console.warn('showSaveFilePicker failed, trying fallback:', err);
    }
  }

  // 2. Fallback: Trigger standard browser/webview download
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('File export download failed:', err);
    return false;
  }
}

