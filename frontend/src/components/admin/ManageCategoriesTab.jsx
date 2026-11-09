import { useState } from 'react';
import { createCategory, deleteCategory, updateCategory } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errors';

export default function ManageCategoriesTab({ categories, onChanged }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    try {
      await createCategory({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      showToast('Category created.', 'success');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the category.'));
    }
  }

  async function handleRename(category) {
    try {
      await updateCategory(category.id, { name: editName.trim() });
      setEditingId('');
      showToast('Category renamed.', 'success');
      onChanged();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not rename the category.'), 'error');
    }
  }

  async function handleDelete(category) {
    if (!window.confirm(`Delete the category "${category.name}"?`)) return;
    try {
      await deleteCategory(category.id);
      showToast('Category deleted.', 'success');
      onChanged();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not delete the category.'), 'error');
    }
  }

  return (
    <>
      <form className="card" onSubmit={handleCreate}>
        <h2>Add a category</h2>
        <label htmlFor="cat-name">Name</label>
        <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        <label htmlFor="cat-desc">Description (optional)</label>
        <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={name.trim().length < 2}>
          Add category
        </button>
      </form>

      <ul className="admin-list">
        {categories.map((category) => (
          <li key={category.id} className="card admin-row">
            <div className="admin-row-main">
              {editingId === category.id ? (
                <>
                  <label htmlFor={`rename-${category.id}`} className="sr-only">
                    New name
                  </label>
                  <input id={`rename-${category.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                </>
              ) : (
                <>
                  <strong>{category.name}</strong>
                  <span className="muted small">
                    {category.reelCount} {category.reelCount === 1 ? 'reel' : 'reels'}
                  </span>
                </>
              )}
            </div>
            <div className="admin-row-actions">
              {editingId === category.id ? (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRename(category)}>
                    Save
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId('')}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(category.id);
                      setEditName(category.name);
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(category)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
