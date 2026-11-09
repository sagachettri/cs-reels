import { LEVELS, RESOURCE_TYPES, capitalize } from '../../utils/format';

export const EMPTY_RESOURCE = { title: '', url: '', type: 'article' };

// Form fields shared by the upload page and the edit dialog. `values` is controlled by the parent.
export default function ReelFields({ values, onChange, categories, idPrefix = 'reel' }) {
  const set = (field) => (event) => onChange({ ...values, [field]: event.target.value });

  function setResource(index, field, value) {
    const resources = values.resources.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onChange({ ...values, resources });
  }

  return (
    <>
      <label htmlFor={`${idPrefix}-title`}>Title</label>
      <input id={`${idPrefix}-title`} value={values.title} onChange={set('title')} maxLength={120} required />

      <label htmlFor={`${idPrefix}-description`}>Description</label>
      <textarea
        id={`${idPrefix}-description`}
        rows={3}
        value={values.description}
        onChange={set('description')}
        maxLength={500}
        required
      />

      <div className="form-row">
        <div>
          <label htmlFor={`${idPrefix}-category`}>Category</label>
          <select id={`${idPrefix}-category`} value={values.category} onChange={set('category')} required>
            <option value="">Choose a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-level`}>Level</label>
          <select id={`${idPrefix}-level`} value={values.level} onChange={set('level')}>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {capitalize(level)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-status`}>Status</label>
          <select id={`${idPrefix}-status`} value={values.status} onChange={set('status')}>
            <option value="published">Published (visible to everyone)</option>
            <option value="draft">Draft (hidden)</option>
          </select>
        </div>
      </div>

      <label htmlFor={`${idPrefix}-tags`}>Tags (comma separated, up to 8)</label>
      <input id={`${idPrefix}-tags`} value={values.tags} onChange={set('tags')} placeholder="arrays, search, big-o" />

      <label htmlFor={`${idPrefix}-takeaway`}>Key takeaway (one sentence, helps the AI)</label>
      <input id={`${idPrefix}-takeaway`} value={values.keyTakeaway} onChange={set('keyTakeaway')} maxLength={300} />

      <label htmlFor={`${idPrefix}-credit`}>Creator or source credit (optional)</label>
      <input id={`${idPrefix}-credit`} value={values.creditName} onChange={set('creditName')} maxLength={80} />

      <fieldset className="resource-fieldset">
        <legend>Related resources (up to 5)</legend>
        {values.resources.map((resource, index) => (
          <div className="resource-row" key={index}>
            <input
              aria-label={`Resource ${index + 1} title`}
              placeholder="Title"
              value={resource.title}
              onChange={(e) => setResource(index, 'title', e.target.value)}
            />
            <input
              aria-label={`Resource ${index + 1} link`}
              placeholder="https://…"
              value={resource.url}
              onChange={(e) => setResource(index, 'url', e.target.value)}
            />
            <select
              aria-label={`Resource ${index + 1} type`}
              value={resource.type}
              onChange={(e) => setResource(index, 'type', e.target.value)}
            >
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {capitalize(type)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange({ ...values, resources: values.resources.filter((_, i) => i !== index) })}
            >
              Remove
            </button>
          </div>
        ))}
        {values.resources.length < 5 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange({ ...values, resources: [...values.resources, { ...EMPTY_RESOURCE }] })}
          >
            + Add resource
          </button>
        )}
      </fieldset>
    </>
  );
}

// Converts the form state to the shape the API expects.
export function toApiFields(values) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    level: values.level,
    status: values.status,
    keyTakeaway: values.keyTakeaway.trim(),
    creditName: values.creditName.trim(),
    tags: values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    resources: values.resources
      .filter((r) => r.title.trim() || r.url.trim())
      .map((r) => ({ title: r.title.trim(), url: r.url.trim(), type: r.type })),
  };
}

export function fromReel(reel) {
  return {
    title: reel.title,
    description: reel.description,
    category: reel.category?.id || '',
    level: reel.level,
    status: reel.status === 'published' ? 'published' : 'draft',
    tags: reel.tags.join(', '),
    keyTakeaway: reel.keyTakeaway || '',
    creditName: reel.creditName || '',
    resources: reel.resources.map((r) => ({ ...r })),
  };
}
