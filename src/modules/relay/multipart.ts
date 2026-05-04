const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getMultipartBoundary = (contentType: string) => {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  return match?.[1] ?? match?.[2]?.trim() ?? null;
};

export const readMultipartField = (body: Buffer, contentType: string, fieldName: string) => {
  const boundary = getMultipartBoundary(contentType);

  if (!boundary) {
    return null;
  }

  const serialized = body.toString('latin1');
  const fieldPattern = new RegExp(
    `(?:^|\\r?\\n)--${escapeRegExp(boundary)}\\r?\\n` +
    `Content-Disposition:[^\\r\\n]*name="${escapeRegExp(fieldName)}"[^\\r\\n]*\\r?\\n` +
    `(?:[^\\r\\n]+\\r?\\n)*\\r?\\n` +
    `([\\s\\S]*?)(?=\\r?\\n--${escapeRegExp(boundary)}(?:--)?\\r?\\n?)`,
    'i',
  );
  const match = serialized.match(fieldPattern);

  return match?.[1]?.trim() ?? null;
};

export const writeMultipartField = (
  body: Buffer,
  contentType: string,
  fieldName: string,
  fieldValue: string,
) => {
  const boundary = getMultipartBoundary(contentType);

  if (!boundary) {
    return body;
  }

  const serialized = body.toString('latin1');
  const escapedBoundary = escapeRegExp(boundary);
  const replacePattern = new RegExp(
    `((?:^|\\r?\\n)--${escapedBoundary}\\r?\\n` +
    `Content-Disposition:[^\\r\\n]*name="${escapeRegExp(fieldName)}"[^\\r\\n]*\\r?\\n` +
    `(?:[^\\r\\n]+\\r?\\n)*\\r?\\n)` +
    `[\\s\\S]*?` +
    `(?=(\\r?\\n--${escapedBoundary}(?:--)?\\r?\\n?))`,
    'i',
  );

  if (replacePattern.test(serialized)) {
    return Buffer.from(serialized.replace(replacePattern, `$1${fieldValue}`), 'latin1');
  }

  const closingBoundary = `--${boundary}--`;
  const fieldPart = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"\r\n\r\n${fieldValue}\r\n`;
  const closingIndex = serialized.lastIndexOf(closingBoundary);

  if (closingIndex === -1) {
    return body;
  }

  return Buffer.from(`${serialized.slice(0, closingIndex)}${fieldPart}${serialized.slice(closingIndex)}`, 'latin1');
};
