import { createHash, createHmac } from 'node:crypto';

import { env } from '../config/env.js';

type ObjectStorageConfig = {
  driver: 'disabled' | 's3';
  endpoint?: string;
  region: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
  prefix: string;
};

type ObjectStorageBody = string | Uint8Array | Blob;

export type StoredObject = {
  key: string;
  url: string;
  etag?: string;
};

export type PutObjectParams = {
  key: string;
  body: ObjectStorageBody;
  contentType?: string;
  cacheControl?: string;
};

const normalizeStoragePrefix = (prefix: string) => {
  const cleaned = prefix.replace(/^\/+|\/+$/g, '');

  if (!cleaned || cleaned === 'nodew') {
    return 'nodew';
  }

  return cleaned.startsWith('nodew/') ? cleaned : `nodew/${cleaned}`;
};

const objectStorageConfig: ObjectStorageConfig = {
  driver: env.STORAGE_DRIVER,
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  bucket: env.STORAGE_BUCKET,
  accessKeyId: env.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  prefix: normalizeStoragePrefix(env.STORAGE_PREFIX),
};

const normalizeObjectKey = (key: string) => {
  const cleaned = key.replace(/^\/+/, '').replace(/\.\./g, '').replace(/\/{2,}/g, '/');
  return objectStorageConfig.prefix ? `${objectStorageConfig.prefix}/${cleaned}` : cleaned;
};

export const isObjectStorageEnabled = () => objectStorageConfig.driver !== 'disabled';

const sha256Hex = async (body: ObjectStorageBody) => {
  if (typeof body === 'string' || body instanceof Uint8Array) {
    return createHash('sha256').update(body).digest('hex');
  }

  if (body instanceof Blob) {
    return createHash('sha256').update(new Uint8Array(await body.arrayBuffer())).digest('hex');
  }

  return 'UNSIGNED-PAYLOAD';
};

const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
const hmacHex = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest('hex');

const getSigningKey = (secret: string, date: string, region: string) => {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
};

const encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');

const getObjectUrl = (key: string) => {
  if (!objectStorageConfig.endpoint || !objectStorageConfig.bucket) {
    throw new Error('Object storage is not configured');
  }

  const endpoint = new URL(objectStorageConfig.endpoint);
  const encodedKey = encodePath(key);

  if (objectStorageConfig.forcePathStyle) {
    return new URL(`/${objectStorageConfig.bucket}/${encodedKey}`, endpoint);
  }

  endpoint.hostname = `${objectStorageConfig.bucket}.${endpoint.hostname}`;
  endpoint.pathname = `/${encodedKey}`;
  return endpoint;
};

const getPublicUrl = (key: string) => {
  if (objectStorageConfig.publicBaseUrl) {
    return new URL(encodePath(key), `${objectStorageConfig.publicBaseUrl.replace(/\/+$/g, '')}/`).toString();
  }

  return getObjectUrl(key).toString();
};

const signS3Request = async (method: string, url: URL, body: ObjectStorageBody | undefined, headers: Headers) => {
  if (!objectStorageConfig.accessKeyId || !objectStorageConfig.secretAccessKey) {
    throw new Error('Object storage credentials are not configured');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body === undefined ? createHash('sha256').update('').digest('hex') : await sha256Hex(body);
  const host = url.host;

  headers.set('host', host);
  headers.set('x-amz-content-sha256', payloadHash);
  headers.set('x-amz-date', amzDate);

  const signedHeaderKeys = [...headers.keys()].map((key) => key.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys.map((key) => `${key}:${headers.get(key)?.trim() ?? ''}\n`).join('');
  const canonicalRequest = [
    method,
    encodePath(decodeURIComponent(url.pathname)),
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderKeys.join(';'),
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${objectStorageConfig.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = hmacHex(getSigningKey(objectStorageConfig.secretAccessKey, dateStamp, objectStorageConfig.region), stringToSign);

  headers.set(
    'authorization',
    `AWS4-HMAC-SHA256 Credential=${objectStorageConfig.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderKeys.join(';')}, Signature=${signature}`,
  );
};

export const putObject = async (params: PutObjectParams): Promise<StoredObject> => {
  if (!isObjectStorageEnabled()) {
    throw new Error('Object storage is disabled');
  }

  const key = normalizeObjectKey(params.key);
  const url = getObjectUrl(key);
  const headers = new Headers();

  if (params.contentType) {
    headers.set('content-type', params.contentType);
  }

  if (params.cacheControl) {
    headers.set('cache-control', params.cacheControl);
  }

  await signS3Request('PUT', url, params.body, headers);

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: params.body,
  });

  if (!response.ok) {
    throw new Error(`Object storage upload failed with HTTP ${response.status}`);
  }

  return {
    key,
    url: getPublicUrl(key),
    etag: response.headers.get('etag') ?? undefined,
  };
};

export const deleteObject = async (key: string) => {
  if (!isObjectStorageEnabled()) {
    return false;
  }

  const normalizedKey = normalizeObjectKey(key);
  const url = getObjectUrl(normalizedKey);
  const headers = new Headers();

  await signS3Request('DELETE', url, undefined, headers);

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  return response.ok || response.status === 404;
};

export const getObjectStorageConfig = () => ({
  driver: objectStorageConfig.driver,
  bucket: objectStorageConfig.bucket ?? null,
  region: objectStorageConfig.region,
  publicBaseUrl: objectStorageConfig.publicBaseUrl ?? null,
  forcePathStyle: objectStorageConfig.forcePathStyle,
  prefix: objectStorageConfig.prefix,
  enabled: isObjectStorageEnabled(),
});
