'use client';

import { useState, useEffect } from 'react';
import React from 'react';

interface Backup {
  id: string;
  filename: string;
  fileSize: number;
  description?: string;
  createdAt: string;
  createdBy: {
    username: string;
  };
}

export default function Backup() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'existing' | 'upload' | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetchMinioBackups();
  }, []);

  // Fetch backup list from MinIO
  const fetchMinioBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/backup/list-minio');
      if (response.ok) {
        const data = await response.json();
        // Map to Backup[]-like structure for table
        setBackups(
          data
            .map((b: { name: string; size: number; lastModified: Date }) => ({
              id: b.name, // Use filename as id
              filename: b.name,
              fileSize: b.size,
              createdAt: b.lastModified,
              createdBy: { username: 'unknown' }, // MinIO doesn't store creator
            }))
            .sort((a: Backup, b: Backup) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      }
    } catch (error) {
      console.error('Failed to fetch MinIO backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      
      if (response.ok) {
        setDescription('');
        fetchMinioBackups();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      alert('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (backupId: string, filename: string) => {
    try {
      const response = await fetch(`/api/settings/backup/download/${backupId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a: HTMLAnchorElement = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download backup:', error);
      alert('Failed to download backup');
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;
    
    try {
      const response = await fetch(`/api/settings/backup/${backupId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchMinioBackups();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete backup');
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
      alert('Failed to delete backup');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to calculate days old
  const getDaysOld = (createdAt: string | Date) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffTime = now.getTime() - createdDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Restore from existing backup
  const handleRestoreExisting = async () => {
    if (!selectedBackup) return;
    setRestoring(true);
    try {
      const response = await fetch('/api/settings/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedBackup }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert('Database restored successfully!');
        setShowRestoreModal(false);
        setRestoreMode(null);
        setSelectedBackup(null);
      } else {
        alert(data.error || 'Failed to restore database');
      }
    } catch {
      alert('Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  // Restore from uploaded file
  const handleRestoreUpload = async () => {
    if (!uploadFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await fetch('/api/settings/backup/restore', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert('Database restored successfully!');
        setShowRestoreModal(false);
        setRestoreMode(null);
        setUploadFile(null);
      } else {
        alert(data.error || 'Failed to restore database');
      }
    } catch {
      alert('Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Database Backup</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            <p>Create and manage database backups for data safety.</p>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-400">
                Backup Description (Optional)
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="description"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Monthly backup before system update"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRestoreModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Restore
              </button>
              <button
                onClick={createBackup}
                disabled={creating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => {
                setShowRestoreModal(false);
                setRestoreMode(null);
                setSelectedBackup(null);
                setUploadFile(null);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Restore Database</h2>
            {!restoreMode && (
              <div className="flex flex-col gap-4">
                <button
                  className="w-full py-2 px-4 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  onClick={() => setRestoreMode('existing')}
                >
                  Restore from Existing Backup
                </button>
                <button
                  className="w-full py-2 px-4 rounded bg-gray-600 text-white font-semibold hover:bg-gray-700"
                  onClick={() => setRestoreMode('upload')}
                >
                  Restore from File
                </button>
              </div>
            )}
            {restoreMode === 'existing' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select a backup to restore:</label>
                <select
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-4"
                  value={selectedBackup || ''}
                  onChange={e => setSelectedBackup(e.target.value)}
                >
                  <option value="">-- Select Backup --</option>
                  {backups.map(b => (
                    <option key={b.id} value={b.filename}>{b.filename}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                    disabled={!selectedBackup || restoring}
                    onClick={handleRestoreExisting}
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-gray-400 text-white font-semibold hover:bg-gray-500"
                    onClick={() => setRestoreMode(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
            {restoreMode === 'upload' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload a backup file (.dump):</label>
                <input
                  type="file"
                  accept=".dump"
                  className="mb-4"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                    disabled={!uploadFile || restoring}
                    onClick={handleRestoreUpload}
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-gray-400 text-white font-semibold hover:bg-gray-500"
                    onClick={() => setRestoreMode(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Backup History</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            <p>View and manage your database backups.</p>
          </div>
          
          <div className="mt-5">
            {loading ? (
              <div className="text-center py-4">Loading backups...</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">No backups found</div>
            ) : (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                        Days Old
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {backups.map((backup) => (
                      <tr key={backup.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium dark:text-gray-300">
                          {backup.filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {formatFileSize(backup.fileSize)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {new Date(backup.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {getDaysOld(backup.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {backup.createdBy?.username || 'unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => downloadBackup(backup.id, backup.filename)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 