"use client"
import React, { useState, useEffect, useCallback } from "react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaterialForm } from '@/components/MaterialForm';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import ActionsPopup from '@/components/ActionsPopup';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Copied from MaterialDetailsModal.tsx for type consistency
interface Batch {
  id: string;
  purchaseType: string;
  quantity: number;
  vendor: { id: string; name: string };
  lotNumber: string;
  expirationDate: string;
  storageLocation: string;
  documents: { document: { id: string; documentNumber: string } }[];
  stockAddedDate: string;
  stockAddedBy: string;
}

interface Material {
  id: string;
  name: string;
  size: string;
  brand: { id: string; name: string };
  materialType: { id: string; name: string };
  batches: Batch[];
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState({
    brand: "all",
    materialType: "all",
    vendor: "all",
    purchaseType: "all",
    stockStatus: "all"
  });
  const [materials, setMaterials] = useState<Material[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dynamic filter options
  const [filterOptions, setFilterOptions] = useState<{
    brands: { id: string; name: string }[];
    materialTypes: { id: string; name: string }[];
    vendors: { id: string; name: string }[];
    purchaseTypes: string[];
    stockStatuses: string[];
  }>({
    brands: [],
    materialTypes: [],
    vendors: [],
    purchaseTypes: [],
    stockStatuses: []
  });

  const permissions = session?.user?.permissions || [];
  const canEdit = permissions.includes('Edit Materials');

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (filters.brand && filters.brand !== "all") params.append('brand', filters.brand);
      if (filters.materialType && filters.materialType !== "all") params.append('materialType', filters.materialType);
      if (filters.vendor && filters.vendor !== "all") params.append('vendor', filters.vendor);
      if (filters.purchaseType && filters.purchaseType !== "all") params.append('purchaseType', filters.purchaseType);
      if (filters.stockStatus && filters.stockStatus !== "all") params.append('stockStatus', filters.stockStatus);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch inventory");
      }
      
      setMaterials(Array.isArray(data.materials) ? data.materials : []);
      setTotalCount(typeof data.totalCount === 'number' ? data.totalCount : 0);
    } catch (err: unknown) {
      console.error('Error fetching inventory:', err);
      setError(err instanceof Error ? err.message : "Failed to fetch inventory");
      setMaterials([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function fetchFilterOptions() {
      try {
        const res = await fetch("/api/inventory/filters");
        const data = await res.json();
        setFilterOptions(data);
      } catch {
        setFilterOptions({ brands: [], materialTypes: [], vendors: [], purchaseTypes: [], stockStatuses: [] });
      }
    }
    fetchFilterOptions();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    // Add debounce to search
    const timeoutId = setTimeout(() => {
      fetchMaterials();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mounted, search, filters, fetchMaterials]);

  const handleMaterialSuccess = () => {
    setShowAddDialog(false);
    fetchMaterials();
    toast.success('Material created successfully');
  };

  // Helper to format date as DD-MM-YYYY
  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  }

  // Export as Excel (all batches)
  const handleExportExcel = () => {
    const exportData: Record<string, string | number | null | undefined>[] = [];
    materials.forEach(mat => {
      mat.batches.forEach(batch => {
        exportData.push({
          'Brand': mat.brand.name,
          'Name': mat.name,
          'Size': mat.size,
          'Material Type': mat.materialType.name,
          'Purchase Type': batch.purchaseType,
          'Quantity': batch.quantity,
          'Vendor': batch.vendor?.name,
          'Lot Number': batch.lotNumber,
          'Expiration Date': formatDate(batch.expirationDate),
          'Storage Location': batch.storageLocation,
          'Stock Added Date': formatDate(batch.stockAddedDate),
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory_export.xlsx');
  };

  // Export as PDF (all batches)
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const exportData: Array<(string | number)[]> = [];
    materials.forEach(mat => {
      mat.batches.forEach(batch => {
        exportData.push([
          mat.brand.name || '',
          mat.name || '',
          mat.size || '',
          mat.materialType.name || '',
          batch.purchaseType || '',
          batch.quantity,
          batch.vendor?.name || '',
          batch.lotNumber || '',
          formatDate(batch.expirationDate),
          batch.storageLocation || '',
          formatDate(batch.stockAddedDate),
        ]);
      });
    });
    autoTable(doc, {
      head: [[
        'Brand', 'Name', 'Size', 'Material Type', 'Purchase Type', 'Quantity', 'Vendor', 'Lot Number', 'Expiration Date', 'Storage Location', 'Stock Added Date'
      ]],
      body: exportData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [49, 46, 129] },
    });
    doc.save('inventory_export.pdf');
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="flex flex-row flex-wrap gap-x-2 gap-y-2 items-center">
          <input
            type="text"
            placeholder="Search by name, brand, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-64"
          />
          {search && (
            <button
              type="button"
              className="ml-1 text-red-500 hover:text-red-700"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
          <div className="flex items-center gap-x-1">
            <Select value={filters.brand} onValueChange={value => setFilters(f => ({ ...f, brand: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {filterOptions.brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.brand && filters.brand !== "all" && (
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setFilters((f) => ({ ...f, brand: "all" }))}
                aria-label="Clear brand"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-x-1">
            <Select value={filters.materialType} onValueChange={value => setFilters(f => ({ ...f, materialType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {filterOptions.materialTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.materialType && filters.materialType !== "all" && (
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setFilters((f) => ({ ...f, materialType: "all" }))}
                aria-label="Clear material type"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-x-1">
            <Select value={filters.vendor} onValueChange={value => setFilters(f => ({ ...f, vendor: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {filterOptions.vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.vendor && filters.vendor !== "all" && (
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setFilters((f) => ({ ...f, vendor: "all" }))}
                aria-label="Clear vendor"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-x-1">
            <Select value={filters.purchaseType} onValueChange={value => setFilters(f => ({ ...f, purchaseType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Purchase Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purchase Types</SelectItem>
                {filterOptions.purchaseTypes.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.purchaseType && filters.purchaseType !== "all" && (
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setFilters((f) => ({ ...f, purchaseType: "all" }))}
                aria-label="Clear purchase type"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-x-1">
            <Select value={filters.stockStatus} onValueChange={value => setFilters(f => ({ ...f, stockStatus: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Status</SelectItem>
                <SelectItem value="In Stock">In Stock</SelectItem>
                <SelectItem value="Low Stock">Low Stock</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
            {filters.stockStatus && filters.stockStatus !== "all" && (
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setFilters((f) => ({ ...f, stockStatus: "all" }))}
                aria-label="Clear stock status"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="highlight" className="font-semibold" onClick={() => setShowAddDialog(true)}>
              Add Material
            </Button>
          )}
          <Button variant="outline" onClick={handleExportExcel}>
            Export as Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            Export as PDF
          </Button>
        </div>
      </div>
      {!loading && !error && materials.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {materials.length} of {totalCount} entries
        </div>
      )}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <p className="font-medium">Error loading inventory</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No materials found matching your search criteria.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Brand</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Material Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Quantity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => {
                const totalQty = mat.batches.reduce((sum, b) => sum + b.quantity, 0);
                const stockStatus = totalQty === 0 ? "Out of Stock" : totalQty < 5 ? "Low Stock" : "In Stock";
                const query = new URLSearchParams({
                  search,
                  brand: filters.brand,
                  materialType: filters.materialType,
                  vendor: filters.vendor,
                  purchaseType: filters.purchaseType,
                  stockStatus: filters.stockStatus,
                });

                return (
                  <React.Fragment key={mat.id}>
                    <tr 
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => setExpanded(expanded === mat.id ? null : mat.id)}
                    >
                      <td className="px-4 py-2">{mat.brand.name}</td>
                      <td className="px-4 py-2">{mat.name}</td>
                      <td className="px-4 py-2">{mat.size}</td>
                      <td className="px-4 py-2">{mat.materialType.name}</td>
                      <td className="px-4 py-2">{totalQty}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          stockStatus === "Out of Stock" ? "bg-red-100 text-red-800" :
                          stockStatus === "Low Stock" ? "bg-yellow-100 text-yellow-800" :
                          "bg-green-100 text-green-800"
                        }`}>
                          {stockStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div onClick={e => e.stopPropagation()}>
                          <ActionsPopup
                            actions={[
                              {
                                label: 'View',
                                onClick: (e) => {
                                  e.stopPropagation();
                                  window.location.href = `/inventory/${mat.id}?${query.toString()}`;
                                },
                              },
                              {
                                label: 'Usage Details',
                                onClick: (e) => {
                                  e.stopPropagation();
                                  window.location.href = `/usage?advanced=1&materialId=${mat.id}`;
                                },
                                variant: 'outline',
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                    {expanded === mat.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-gray-50 dark:bg-gray-700">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead>
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Purchase Type</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Quantity</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Vendor</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Expiration Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Storage Location</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Document</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mat.batches.map((batch) => (
                                  <tr key={batch.id}>
                                    <td className="px-4 py-2">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-semibold 
                                          ${batch.purchaseType === 'Advance' ? 'bg-orange-100 text-orange-700' : ''}
                                          ${batch.purchaseType === 'Purchased' ? 'bg-green-100 text-green-700' : ''}
                                        `}
                                      >
                                        {batch.purchaseType}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2">{batch.quantity}</td>
                                    <td className="px-4 py-2">{batch.vendor?.name || '-'}</td>
                                    <td className="px-4 py-2">{new Date(batch.expirationDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-2">{batch.storageLocation}</td>
                                    <td className="px-4 py-2">
                                      {batch.documents && batch.documents.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {batch.documents.map((doc) => (
                                            <Link
                                              key={doc.document.id}
                                              href={`/documents/${doc.document.id}?${query.toString()}`}
                                              className="text-indigo-600 hover:text-indigo-900 text-xs"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {doc.document.documentNumber}
                                            </Link>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Material Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
          </DialogHeader>
          <MaterialForm
            brands={filterOptions.brands}
            materialTypes={filterOptions.materialTypes}
            onSuccess={handleMaterialSuccess}
            onCancel={() => setShowAddDialog(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}