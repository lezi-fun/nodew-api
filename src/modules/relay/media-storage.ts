import { randomUUID } from 'node:crypto';

import { isObjectStorageEnabled, putObject } from '../../lib/object-storage.js';

type ImageDataItem = {
  b64_json?: unknown;
  url?: unknown;
  [key: string]: unknown;
};

type ImageRelayBody = {
  data?: unknown;
  [key: string]: unknown;
};

const imageExtensionByMime = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

const detectImageMime = (buffer: Buffer) => {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }

  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return 'image/png';
};

const isImageRelayBody = (body: unknown): body is ImageRelayBody =>
  Boolean(body && typeof body === 'object' && !Array.isArray(body));

const isImageDataItem = (value: unknown): value is ImageDataItem =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const uploadBase64Image = async (params: {
  b64Json: string;
  endpoint: string;
  requestId: string;
  index: number;
}) => {
  const image = Buffer.from(params.b64Json, 'base64');
  const contentType = detectImageMime(image);
  const extension = imageExtensionByMime[contentType] ?? 'png';
  const endpointSlug = params.endpoint.replace(/^\/v1\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  const key = `relay/${endpointSlug}/${params.requestId}/${params.index}-${randomUUID()}.${extension}`;

  return putObject({
    key,
    body: image,
    contentType,
    cacheControl: 'public, max-age=31536000, immutable',
  });
};

const getStorageErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Object storage upload failed';

export const persistImageRelayResult = async (params: {
  body: unknown;
  endpoint: string;
  requestId: string;
}) => {
  if (!isObjectStorageEnabled() || !isImageRelayBody(params.body) || !Array.isArray(params.body.data)) {
    return params.body;
  }

  const data = await Promise.all(params.body.data.map(async (item, index) => {
    if (!isImageDataItem(item) || typeof item.b64_json !== 'string') {
      return item;
    }

    try {
      const stored = await uploadBase64Image({
        b64Json: item.b64_json,
        endpoint: params.endpoint,
        requestId: params.requestId,
        index,
      });

      return {
        ...item,
        ...(typeof item.url === 'string' ? { nodew_upstream_url: item.url } : {}),
        url: stored.url,
        nodew_storage_key: stored.key,
      };
    } catch (error) {
      return {
        ...item,
        nodew_storage_error: getStorageErrorMessage(error),
      };
    }
  }));

  return {
    ...params.body,
    data,
  };
};
