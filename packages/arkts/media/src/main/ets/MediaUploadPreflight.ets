export const IMAGE_UPLOAD_CONTENT_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

export const VIDEO_UPLOAD_CONTENT_TYPES: string[] = [
  'video/mp4',
  'video/quicktime',
  'video/webm'
];

export const AUDIO_UPLOAD_CONTENT_TYPES: string[] = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/ogg'
];

export const DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES: string[] =
  IMAGE_UPLOAD_CONTENT_TYPES
    .concat(VIDEO_UPLOAD_CONTENT_TYPES)
    .concat(AUDIO_UPLOAD_CONTENT_TYPES);

export class AppFoundryMediaError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AppFoundryMediaError';
    this.code = code;
  }
}

export class MediaUploadPolicy {
  maxBytes: number = 10 * 1024 * 1024;
  allowedContentTypes: string[] = DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES;
  maxVideoBytes: number | undefined = undefined;
  requireDetectedContentType: boolean = true;
  inferDeclaredContentType: boolean = true;
  preferDeclaredContentType: boolean = false;
  allowUnsupportedDeclaredContentTypeFallback: boolean = false;
}

export class PreparedMediaUpload {
  bytes: Uint8Array = new Uint8Array();
  mimeType: string = '';
  detectedMimeType: string | undefined = undefined;
  declaredMimeType: string | undefined = undefined;
  extension: string = '';
  byteSize: number = 0;
}

export class MediaUploadPolicies {
  static image(
    maxBytes: number = 10 * 1024 * 1024,
    allowUnsupportedDeclaredContentTypeFallback: boolean = true
  ): MediaUploadPolicy {
    const policy = new MediaUploadPolicy();
    policy.maxBytes = maxBytes;
    policy.allowedContentTypes = IMAGE_UPLOAD_CONTENT_TYPES;
    policy.preferDeclaredContentType = true;
    policy.allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback;
    return policy;
  }

  static imageOrVideo(
    maxBytes: number = 200 * 1024 * 1024,
    maxVideoBytes: number | undefined = undefined,
    allowUnsupportedDeclaredContentTypeFallback: boolean = true
  ): MediaUploadPolicy {
    const policy = new MediaUploadPolicy();
    policy.maxBytes = maxBytes;
    policy.allowedContentTypes = IMAGE_UPLOAD_CONTENT_TYPES.concat(VIDEO_UPLOAD_CONTENT_TYPES);
    policy.maxVideoBytes = maxVideoBytes;
    policy.preferDeclaredContentType = true;
    policy.allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback;
    return policy;
  }

  static audio(
    maxBytes: number = 25 * 1024 * 1024,
    allowUnsupportedDeclaredContentTypeFallback: boolean = true
  ): MediaUploadPolicy {
    const policy = new MediaUploadPolicy();
    policy.maxBytes = maxBytes;
    policy.allowedContentTypes = AUDIO_UPLOAD_CONTENT_TYPES;
    policy.preferDeclaredContentType = true;
    policy.allowUnsupportedDeclaredContentTypeFallback = allowUnsupportedDeclaredContentTypeFallback;
    return policy;
  }
}

export function prepareMediaUpload(
  bytes: Uint8Array,
  declaredMimeType?: string,
  policy: MediaUploadPolicy = new MediaUploadPolicy()
): PreparedMediaUpload {
  if (bytes.length === 0) {
    throw new AppFoundryMediaError('media_empty', 'Media data is required.');
  }
  if (bytes.length > policy.maxBytes) {
    throw new AppFoundryMediaError('file_too_large', 'Media file is too large.');
  }

  const detected = detectUploadContentType(bytes);
  const normalizedDeclared = normalizeMimeType(declaredMimeType);
  const declared = knownContentType(normalizedDeclared);
  if (
    normalizedDeclared !== undefined &&
    declared === undefined &&
    !policy.allowUnsupportedDeclaredContentTypeFallback
  ) {
    throw new AppFoundryMediaError(
      'declared_content_type_not_allowed',
      'Declared media content type is not allowed.'
    );
  }

  let effectiveDeclared: string | undefined = declared;
  if (
    effectiveDeclared === undefined &&
    policy.inferDeclaredContentType &&
    (normalizedDeclared === undefined || policy.allowUnsupportedDeclaredContentTypeFallback)
  ) {
    effectiveDeclared = detected;
  }

  if (policy.requireDetectedContentType && detected === undefined) {
    throw new AppFoundryMediaError(
      'missing_detected_content_type',
      'Media content type could not be detected.'
    );
  }

  if (effectiveDeclared !== undefined && !contains(policy.allowedContentTypes, effectiveDeclared)) {
    throw new AppFoundryMediaError(
      'declared_content_type_not_allowed',
      'Declared media content type is not allowed.'
    );
  }

  if (
    detected !== undefined &&
    !contains(policy.allowedContentTypes, detected) &&
    !(
      effectiveDeclared !== undefined &&
      contains(policy.allowedContentTypes, effectiveDeclared) &&
      contentTypesAreCompatible(effectiveDeclared, detected)
    )
  ) {
    throw new AppFoundryMediaError(
      'detected_content_type_not_allowed',
      'Detected media content type is not allowed.'
    );
  }

  if (
    effectiveDeclared !== undefined &&
    detected !== undefined &&
    !contentTypesAreCompatible(effectiveDeclared, detected)
  ) {
    throw new AppFoundryMediaError(
      'content_type_mismatch',
      'Declared media content type does not match detected bytes.'
    );
  }

  if (
    policy.maxVideoBytes !== undefined &&
    detected !== undefined &&
    contains(VIDEO_UPLOAD_CONTENT_TYPES, detected) &&
    bytes.length > policy.maxVideoBytes
  ) {
    throw new AppFoundryMediaError('video_file_too_large', 'Video file is too large.');
  }

  let contentType: string | undefined = undefined;
  if (policy.preferDeclaredContentType) {
    contentType = effectiveDeclared !== undefined ? effectiveDeclared : detected;
  } else {
    contentType = detected !== undefined ? detected : effectiveDeclared;
  }
  if (contentType === undefined) {
    throw new AppFoundryMediaError('missing_content_type', 'Media content type is required.');
  }

  const prepared = new PreparedMediaUpload();
  prepared.bytes = bytes;
  prepared.mimeType = contentType;
  prepared.detectedMimeType = detected;
  prepared.declaredMimeType = effectiveDeclared;
  prepared.extension = extensionForMimeType(contentType);
  prepared.byteSize = bytes.length;
  return prepared;
}

export function detectUploadContentType(bytes: Uint8Array): string | undefined {
  if (bytes.length < 4) return undefined;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    ascii(bytes, 0, 4) === 'GIF8' &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') {
    return 'audio/wav';
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'm4a ' || brand === 'm4b ' || brand === 'm4p ') return 'audio/mp4';
    return 'video/mp4';
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (ascii(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(bytes, 0, 3) === 'ID3') return 'audio/mpeg';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return undefined;
}

export function normalizeMimeType(mimeType?: string): string | undefined {
  if (mimeType === undefined || mimeType === null) return undefined;
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'audio/mp4' || mimeType === 'audio/m4a') return 'm4a';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/webm') return 'webm';
  return 'jpg';
}

function knownContentType(mimeType?: string): string | undefined {
  if (mimeType === undefined) return undefined;
  return contains(DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES, mimeType) ? mimeType : undefined;
}

function contentTypesAreCompatible(declared: string, detected: string): boolean {
  if (declared === detected) return true;

  const isoBmff = ['video/mp4', 'video/quicktime', 'audio/mp4', 'audio/m4a'];
  if (contains(isoBmff, declared) && contains(isoBmff, detected)) return true;

  const webm = ['video/webm', 'audio/webm'];
  if (contains(webm, declared) && contains(webm, detected)) return true;

  const wav = ['audio/wav', 'audio/x-wav'];
  return contains(wav, declared) && contains(wav, detected);
}

function contains(values: string[], value: string): boolean {
  return values.indexOf(value) >= 0;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (bytes.length < start + length) return '';
  let value = '';
  for (let index = start; index < start + length; index++) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}
