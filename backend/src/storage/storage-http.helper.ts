export function createContentDisposition(
  disposition: 'attachment' | 'inline',
  fileName: string,
) {
  const fallbackFileName = fileName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}
