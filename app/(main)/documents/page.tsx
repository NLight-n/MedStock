'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface Document {
  id: string;
  type: string;
  documentNumber: string;
  date: string;
  vendor: string | null;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

interface UserPermissions {
  name: string;
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [docType, setDocType] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const docTypes = ["Invoice", "Delivery Challan", "Purchase Order", "Governing Council", "Others"];
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch vendors for filter dropdown
    fetch("/api/settings/vendors").then(res => res.json()).then(setVendors).catch(() => setVendors([]));
  }, []);

  // Update dateFrom/dateTo when dateRange changes (plain JS, like Usage page)
  useEffect(() => {
    if (dateRange === 'custom') return;
    let from = '', to = '';
    const today = new Date();
    const fromDate = new Date();
    switch (dateRange) {
      case 'today':
        // both today
        break;
      case 'yesterday':
        fromDate.setDate(today.getDate() - 1);
        today.setDate(today.getDate() - 1);
        break;
      case 'last3days':
        fromDate.setDate(today.getDate() - 2);
        break;
      case 'last7days':
        fromDate.setDate(today.getDate() - 6);
        break;
      case 'last1month':
        fromDate.setMonth(today.getMonth() - 1);
        break;
      default:
        from = '';
        to = '';
    }
    from = fromDate.toISOString().split('T')[0];
    to = today.toISOString().split('T')[0];
    setDateFrom(from);
    setDateTo(to);
  }, [dateRange]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.append('search', search.trim());
        if (vendor && vendor !== 'all') params.append('vendor', vendor);
        if (docType && docType !== 'all') params.append('type', docType);
        if (dateRange !== 'all') {
          if (dateFrom) params.append('dateFrom', dateFrom);
          if (dateTo) params.append('dateTo', dateTo);
        }
        const response = await fetch(`/api/documents?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch documents');
        const data = await response.json();
        setDocuments(data);

        // Fetch total count for 'Showing X of Y entries'
        try {
          const totalRes = await fetch('/api/documents?countOnly=1');
          if (totalRes.ok) {
            const totalData = await totalRes.json();
            setTotalCount(totalData.count || data.length);
          } else {
            setTotalCount(data.length);
          }
        } catch {
          setTotalCount(data.length);
        }

        // Check user permissions
        if (session?.user) {
          const userResponse = await fetch('/api/auth/me');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            // DEBUG: Log permissions to console
            console.log('User permissions:', userData.user?.permissions);
            const hasPermission = userData.user?.permissions?.some(
              (p: UserPermissions) => p.name === 'Edit Documents'
            );
            setHasEditPermission(hasPermission);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [search, vendor, docType, dateRange, dateFrom, dateTo, session]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Documents</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage invoices, delivery challans, purchase orders, governing council documents, and other documents
          </p>
        </div>
        {hasEditPermission && (
          <Link href="/documents/upload">
            <Button variant="highlight">Upload New Document</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-row flex-wrap gap-x-2 gap-y-2 items-center mb-6">
        <input
          type="text"
          placeholder="Search by document number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm min-w-[180px] max-w-xs w-auto"
        />
        {search && (
          <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => setSearch("")} aria-label="Clear search"><X size={18} /></button>
        )}
        <div className="min-w-[180px] max-w-xs w-auto">
          <Select value={vendor} onValueChange={setVendor}>
            <SelectTrigger>
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {vendor && vendor !== 'all' && (
          <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => setVendor("all") } aria-label="Clear vendor"><X size={18} /></button>
        )}
        <div className="min-w-[180px] max-w-xs w-auto">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {docTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {docType && docType !== 'all' && (
          <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => setDocType("all") } aria-label="Clear type"><X size={18} /></button>
        )}
        <div className="min-w-[180px] max-w-xs w-auto">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger>
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last3days">Last 3 Days</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last1month">Last 1 Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateRange !== 'all' && (
          <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => setDateRange('all')} aria-label="Clear date range"><X size={18} /></button>
        )}
        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1 text-sm min-w-[140px] max-w-xs w-auto"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm min-w-[140px] max-w-xs w-auto"
            />
          </>
        )}
      </div>

      {documents.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {documents.length} of {totalCount ?? documents.length} entries
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No documents found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No documents have been uploaded yet
          </p>
          {hasEditPermission && (
            <div className="mt-4">
              <Link href="/documents/upload">
                <Button variant="highlight">Upload New Document</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((document) => (
            <Link
              key={document.id}
              href={`/documents/${document.id}?referrer=documents`}
              className="block"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">📄</span>
                    <div>
                      <h3 className="text-lg font-semibold">{document.documentNumber}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{document.type}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span>{new Date(document.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Vendor:</span>
                    <span className="truncate max-w-32">{document.vendor || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
                    <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Click to view document
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 