/**
 * Human-readable byte sizes for the UI ("82.1 MB").
 */

export function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return 'unknown';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
