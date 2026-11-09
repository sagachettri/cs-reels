import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

// A file can lie about its type, so we also check the first bytes (the "magic number").
function isMp4(buf) {
  return buf.length > 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
}
function isWebm(buf) {
  return buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}
function isJpeg(buf) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function isPng(buf) {
  return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}
function isWebp(buf) {
  return (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export function validateVideoFile(file) {
  if (!file) {
    throw new ApiError(400, 'VIDEO_REQUIRED', 'Please choose a video file to upload.');
  }
  const okType = ['video/mp4', 'video/webm'].includes(file.mimetype);
  if (!okType || !(isMp4(file.buffer) || isWebm(file.buffer))) {
    throw new ApiError(415, 'INVALID_VIDEO', 'Only MP4 or WebM videos are allowed.');
  }
  if (file.size > env.upload.maxVideoBytes) {
    throw new ApiError(413, 'FILE_TOO_LARGE', 'The video is too large.');
  }
  return file.mimetype === 'video/webm' ? 'webm' : 'mp4';
}

export function validateThumbnailFile(file) {
  if (!file) return null;
  const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  if (!okType || !(isJpeg(file.buffer) || isPng(file.buffer) || isWebp(file.buffer))) {
    throw new ApiError(415, 'INVALID_THUMBNAIL', 'Thumbnail must be a JPG, PNG or WebP image.');
  }
  if (file.size > env.upload.maxThumbnailBytes) {
    throw new ApiError(413, 'THUMBNAIL_TOO_LARGE', 'Thumbnail must be 5 MB or smaller.');
  }
  return { jpeg: 'jpg', png: 'png', webp: 'webp' }[
    isJpeg(file.buffer) ? 'jpeg' : isPng(file.buffer) ? 'png' : 'webp'
  ];
}
