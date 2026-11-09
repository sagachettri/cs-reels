export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const RESOURCE_TYPES = ['docs', 'article', 'practice', 'video'];
export const REPORT_REASONS = [
  { value: 'inaccurate', label: 'Inaccurate information' },
  { value: 'copyright', label: 'Copyright problem' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'broken-media', label: 'Video or image is broken' },
  { value: 'other', label: 'Something else' },
];
