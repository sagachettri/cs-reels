import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function authHeader() {
  return 'Basic ' + Buffer.from(`${env.imagekit.privateKey}:`).toString('base64');
}

function assertConfigured() {
  if (!env.imagekit.privateKey) {
    throw new ApiError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'Video storage is not configured on the server (missing IMAGEKIT_PRIVATE_KEY).'
    );
  }
}

// Uploads one file to ImageKit using its REST API. The private key never leaves the server.
export async function uploadFile({ buffer, mimetype, fileName, tags = [] }) {
  assertConfigured();

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), fileName);
  form.append('fileName', fileName);
  form.append('folder', env.imagekit.folder);
  form.append('useUniqueFileName', 'true');
  if (tags.length > 0) form.append('tags', tags.join(','));

  let response;
  try {
    response = await fetch(env.imagekit.uploadUrl, {
      method: 'POST',
      headers: { Authorization: authHeader() },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    console.error('ImageKit upload request failed:', error.message);
    throw new ApiError(502, 'STORAGE_UNAVAILABLE', 'Could not reach the video storage service. Please try again.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`ImageKit upload failed (${response.status}):`, text.slice(0, 300));
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, 'STORAGE_AUTH_FAILED', 'Video storage rejected the server credentials. Check IMAGEKIT_PRIVATE_KEY.');
    }
    throw new ApiError(502, 'STORAGE_ERROR', 'The video storage service could not save the file.');
  }

  const data = await response.json();
  if (!data.fileId || !data.url) {
    throw new ApiError(502, 'STORAGE_ERROR', 'The video storage service returned an unexpected response.');
  }
  return { fileId: data.fileId, url: data.url };
}

// Best effort: used for cleanup, so it never throws.
export async function deleteFile(fileId) {
  if (!fileId || !env.imagekit.privateKey) return false;
  try {
    const response = await fetch(`${env.imagekit.apiUrl}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(30000),
    });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('ImageKit delete failed:', error.message);
    return false;
  }
}

// ImageKit can generate a thumbnail from a video URL.
export function autoThumbnailUrl(videoUrl) {
  return `${videoUrl}/ik-thumbnail.jpg`;
}
