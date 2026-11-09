import { useCallback, useEffect, useState } from 'react';
import { getCategories } from '../../services/reelService';
import { usePageTitle } from '../../hooks/usePageTitle';
import ManageReelsTab from '../../components/admin/ManageReelsTab';
import ManageCategoriesTab from '../../components/admin/ManageCategoriesTab';
import ManageReportsTab from '../../components/admin/ManageReportsTab';

const TABS = [
  { id: 'reels', label: 'Reels' },
  { id: 'categories', label: 'Categories' },
  { id: 'reports', label: 'Reports' },
];

export default function ManageContent() {
  usePageTitle('Manage content');
  const [tab, setTab] = useState('reels');
  const [categories, setCategories] = useState([]);

  const loadCategories = useCallback(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(loadCategories, [loadCategories]);

  return (
    <>
      <h1>Manage content</h1>
      <div className="tabs" role="tablist" aria-label="Content sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab ${tab === item.id ? 'tab-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'reels' && <ManageReelsTab categories={categories} />}
      {tab === 'categories' && <ManageCategoriesTab categories={categories} onChanged={loadCategories} />}
      {tab === 'reports' && <ManageReportsTab />}
    </>
  );
}
