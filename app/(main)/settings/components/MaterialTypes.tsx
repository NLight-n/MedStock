'use client';

import { useState, useEffect } from 'react';

interface MaterialType {
  id: string;
  name: string;
  description: string;
}

export default function MaterialTypes() {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<MaterialType, 'id'>>({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchMaterialTypes();
  }, []);

  const fetchMaterialTypes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/material-types');
      const data = await response.json();
      if (Array.isArray(data)) {
        setMaterialTypes(data);
        setError(null);
      } else {
        setMaterialTypes([]);
        setError(data?.error || 'Failed to fetch material types');
      }
    } catch (err) {
      setError('Failed to fetch material types');
      setMaterialTypes([]);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await fetch(`/api/settings/material-types/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/settings/material-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      await fetchMaterialTypes();
      resetForm();
    } catch (err) {
      setError('Failed to save material type');
      console.error(err);
    }
  };

  const handleEdit = (materialType: MaterialType) => {
    setEditingId(materialType.id);
    setFormData({
      name: materialType.name,
      description: materialType.description,
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material type?')) return;
    
    try {
      await fetch(`/api/settings/material-types/${id}`, {
        method: 'DELETE',
      });
      await fetchMaterialTypes();
    } catch (err) {
      setError('Failed to delete material type');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingId(null);
    setIsAdding(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Material Types</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Add Material Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 shadow sm:rounded-lg p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-400">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-400">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 shadow sm:rounded-lg">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {materialTypes.map((type) => (
            <li key={type.id} className="px-6 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex items-center justify-between">
              <div>
                <div className="font-medium">{type.name}</div>
                <div className="text-gray-500 dark:text-gray-400">{type.description}</div>
              </div>
              <div className="flex gap-2 ml-auto">
                <button className="text-blue-600 hover:underline" onClick={() => handleEdit(type)}>Edit</button>
                <button className="text-red-600 hover:underline" onClick={() => handleDelete(type.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 