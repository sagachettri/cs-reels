export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}

export function sendSuccess(res, data, statusCode = 200, message) {
  const body = { success: true, data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
}
