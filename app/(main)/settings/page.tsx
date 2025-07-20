'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MaterialTypes from './components/MaterialTypes';
import Brands from './components/Brands';
import Vendors from './components/Vendors';
import Physicians from './components/Physicians';
import Backup from './components/Backup';
import UserManagement from './components/UserManagement';
import DataLog from './components/DataLog';

interface Permission {
  id: string;
  name: string;
  description: string;
}

const tabs = [
  { id: 'material-types', name: 'Material Types' },
  { id: 'brands', name: 'Brands' },
  { id: 'vendors', name: 'Vendors' },
  { id: 'physicians', name: 'Physicians' },
  { id: 'backup', name: 'Backup' },
  { id: 'user-management', name: 'User Management' },
  { id: 'data-log', name: 'Data Log' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('material-types');
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      fetchUserPermissions();
    }
  }, [session]);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUserPermissions(userData.user.permissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionName: string) => {
    return userPermissions.some(p => p.name === permissionName);
  };

  const filteredTabs = tabs.filter(tab => {
    if (tab.id === 'user-management') {
      return hasPermission('Manage Users');
    }
    return true;
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'material-types':
        return <MaterialTypes />;
      case 'brands':
        return <Brands />;
      case 'vendors':
        return <Vendors />;
      case 'physicians':
        return <Physicians />;
      case 'backup':
        return <Backup />;
      case 'user-management':
        return <UserManagement />;
      case 'data-log':
        return <DataLog />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage your application settings and configurations.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
} 