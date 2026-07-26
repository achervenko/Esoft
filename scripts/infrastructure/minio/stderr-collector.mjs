import { redactSensitiveText } from '../security/redaction.mjs';

const DEFAULT_MAX_BYTES = 64 * 1024;
const UTF8_BOUNDARY_BYTES = 3;

export function createStderrCollector(
  child,
  {
    maxBytes = DEFAULT_MAX_BYTES,
    sensitiveValues = [],
  } = {},
) {
  validateMaxBytes(maxBytes);
  validateSensitiveValues(sensitiveValues);

  const redactions = normalizeSensitiveValues(sensitiveValues);
  const longestSensitiveValueBytes = redactions.reduce(
    (maximum, value) =>
      Math.max(maximum, Buffer.byteLength(value, 'utf8')),
    0,
  );

  /*
   * Keep enough additional raw data to preserve:
   * - a sensitive value crossing the truncation boundary;
   * - a UTF-8 character crossing that boundary.
   */
  const bufferMaxBytes = addSafeIntegers(
    maxBytes,
    longestSensitiveValueBytes,
    UTF8_BOUNDARY_BYTES,
  );

  let stderr = Buffer.alloc(0);

  child.stderr?.on('data', (chunk) => {
    const incoming = toBuffer(chunk);
    stderr = appendBoundedBuffer(stderr, incoming, bufferMaxBytes);
  });

  return {
    value() {
      let value = stderr.toString('utf8');

      for (const sensitiveValue of redactions) {
        value = value.replaceAll(sensitiveValue, '[redacted]');
      }

      value = redactSensitiveText(value).trim();

      return tailStringByBytes(value, maxBytes);
    },
  };
}

function validateMaxBytes(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }
}

function validateSensitiveValues(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('sensitiveValues must be an array');
  }
}

function normalizeSensitiveValues(values) {
  return [
    ...new Set(
      values.filter(
        (value) => typeof value === 'string' && value.length > 0,
      ),
    ),
  ].sort((left, right) => {
    const byteDifference =
      Buffer.byteLength(right, 'utf8') -
      Buffer.byteLength(left, 'utf8');

    return byteDifference || right.length - left.length;
  });
}

function addSafeIntegers(...values) {
  let total = 0;

  for (const value of values) {
    total += value;

    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Combined stderr buffer limit is too large');
    }
  }

  return total;
}

function toBuffer(chunk) {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return Buffer.from(
      chunk.buffer,
      chunk.byteOffset,
      chunk.byteLength,
    );
  }

  return Buffer.from(String(chunk), 'utf8');
}

function appendBoundedBuffer(current, incoming, maxBytes) {
  if (incoming.length >= maxBytes) {
    return tailUtf8Buffer(incoming, maxBytes);
  }

  if (current.length + incoming.length <= maxBytes) {
    return Buffer.concat([current, incoming]);
  }

  const requiredCurrentBytes = maxBytes - incoming.length;
  const currentTail = tailUtf8Buffer(current, requiredCurrentBytes);

  return Buffer.concat([currentTail, incoming]);
}

function tailStringByBytes(value, maxBytes) {
  const buffer = Buffer.from(value, 'utf8');

  if (buffer.length <= maxBytes) {
    return value;
  }

  return tailUtf8Buffer(buffer, maxBytes).toString('utf8');
}

function tailUtf8Buffer(buffer, maxBytes) {
  if (maxBytes <= 0) {
    return Buffer.alloc(0);
  }

  if (buffer.length <= maxBytes) {
    return buffer;
  }

  let start = buffer.length - maxBytes;

  while (
    start < buffer.length &&
    isUtf8ContinuationByte(buffer[start])
  ) {
    start += 1;
  }

  return buffer.subarray(start);
}

function isUtf8ContinuationByte(byte) {
  return (byte & 0b1100_0000) === 0b1000_0000;
}