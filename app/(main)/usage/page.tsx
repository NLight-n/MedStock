'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageForm } from '@/components/UsageForm';
import { EditUsageForm } from '@/components/EditUsageForm';
import { toast } from 'sonner';
import { Edit, Trash2, X } from 'lucide-react';
import ActionsPopup from '@/components/ActionsPopup';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Action {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'default' | 'outline';
}

interface UsageRecord {
  id: string;
  patientName: string;
  patientId: string;
  procedureName: string;
  procedureDate: string;
  physician: string;
  batchId: string;
  quantity: number;
  createdAt: string;
  user: {
    username: string;
  };
  batch: {
    id: string;
    materialId: string;
    material: {
      id: string;
      name: string;
      size: string;
      brand: {
        id: string;
        name: string;
      };
      materialType: {
        id: string;
        name: string;
      };
    };
    vendor: {
      id: string;
      name: string;
    };
    lotNumber: string;
    document?: { id: string } | null;
    purchaseType: string | null;
  };
}

interface GroupedUsageRecord extends Omit<UsageRecord, 'batchId' | 'quantity'> {
  id: string;
  batchId: string;
  quantity: number;
  records: UsageRecord[];
}

interface MaterialType {
  id: string;
  name: string;
}

interface Physician {
  id: string;
  name: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

const getISODateString = (date: Date) => {
  return date.toISOString().split('T')[0];
};

function UsagePageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUsageRecord, setSelectedUsageRecord] = useState<UsageRecord | GroupedUsageRecord | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [totalProcedures, setTotalProcedures] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState('');
  const [physician, setPhysician] = useState('');
  const [dateRange, setDateRange] = useState('last7days');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState('all'); // 'all', 'Advance', 'Purchased'
  const [triggerFetch, setTriggerFetch] = useState(0);

  // Advanced search states
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedMaterialId, setAdvancedMaterialId] = useState('');
  const [advancedBatchId, setAdvancedBatchId] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<{ id: string; lotNumber: string | null; purchaseType: string | null; expirationDate: string | null; vendor: { id: string; name: string } | null } | null>(null);

  // Filter options
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [materials, setMaterials] = useState<{ id: string; name: string; size: string | null }[]>([]);
  const [batches, setBatches] = useState<{ 
    id: string; 
    lotNumber: string | null;
    purchaseType: string | null;
    expirationDate: string | null;
    vendor: { id: string; name: string } | null;
  }[]>([]);

  const router = useRouter();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<null | {
    patientName: string;
    patientId: string;
    procedureName: string;
    procedureDate: string;
    physician: string;
    records: UsageRecord[];
  }>(null);

  const fetchUsageRecords = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (physician) params.append('physician', physician);
      if (dateRange !== 'all') {
        if (from) params.append('dateFrom', from);
        if (to) params.append('dateTo', to);
      }
      if (materialType) params.append('materialType', materialType);
      if (advancedMaterialId) params.append('advancedMaterialId', advancedMaterialId);
      if (advancedBatchId) params.append('advancedBatchId', advancedBatchId);
      if (dateRange === 'yesterday') {
        params.append('isYesterday', 'true');
      }
      const res = await fetch(`/api/usage?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch usage records");
      }
      setUsageRecords(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Error fetching usage records:', err);
      setError(err instanceof Error ? err.message : "Failed to fetch usage records");
      setUsageRecords([]);
    } finally {
      setLoading(false);
    }
  }, [search, physician, materialType, advancedMaterialId, advancedBatchId, dateRange]);

  const fetchUserPermissions = useCallback(async () => {
    if (!session?.user.id) return;
    setPermissionsLoading(true);
    try {
      const res = await fetch(`/api/settings/users/${session.user.id}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setUserPermissions(data);
      } else {
        setUserPermissions([]);
      }
    } catch (error) {
      console.error('Failed to fetch user permissions', error);
      setUserPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, [session?.user.id]);

  const fetchTotalRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/usage?countOnly=1');
      const data = await res.json();
      setTotalProcedures(data.count || 0);
    } catch {
      setTotalProcedures(0);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let from = '';
    let to = '';

    if (dateRange !== 'custom') {
      const today = new Date();
      const fromDate = new Date();
      
      switch (dateRange) {
        case 'today':
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
      }
      from = getISODateString(fromDate);
      to = getISODateString(today);
    } else {
        from = dateFrom;
        to = dateTo;
    }
    
    if(from && to){
      fetchUsageRecords(from, to);
    }
  }, [mounted, physician, materialType, dateRange, dateFrom, dateTo, triggerFetch, fetchUsageRecords]);
  
  const handleSearch = () => {
    if (!advancedMaterialId) {
      toast.error('Please select a material');
      return;
    }

    setTriggerFetch(prev => prev + 1);
  };

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/usage/filters');
      if (response.ok) {
        const data = await response.json();
        setPhysicians(data.physicians || []);
        setMaterialTypes(data.materialTypes || []);
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }

    // Only clear filters if there are no query params for advanced search
    const hasQueryParams = !!(searchParams && (searchParams.get('materialId') || searchParams.get('batchId')));
    if (hasQueryParams) {
      console.log('Preserving filters because query params are present:', {
        materialId: searchParams.get('materialId'),
        batchId: searchParams.get('batchId'),
      });
      // Do not clear filters
      return;
    } else {
      console.log('Clearing filters because no advanced search query params are present');
      setSearch('');
      setPhysician('');
      setDateRange('last7days');
      setMaterialType('');
      const today = new Date();
      const fromDate = new Date();
      fromDate.setDate(today.getDate() - 6);
      setDateFrom(getISODateString(fromDate));
      setDateTo(getISODateString(today));
      setAdvancedMaterialId('');
      setAdvancedBatchId('');
      setShowAdvancedSearch(false);
      setTriggerFetch(c => c + 1);
    }
  }, [searchParams]);

  const fetchBatches = useCallback(async () => {
    if (!advancedMaterialId) return;

    try {
      const response = await fetch(`/api/inventory/${advancedMaterialId}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const availableBatches = data.batches.filter((batch: { quantity: number }) => batch.quantity > 0);
        setBatches(availableBatches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to fetch batches');
    }
  }, [advancedMaterialId]);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 6);
    setDateFrom(getISODateString(fromDate));
    setDateTo(getISODateString(today));
    
    fetchFilterOptions();
    fetchUserPermissions();
    fetchTotalRecords();
    // Prefill advanced search from query params
    if (searchParams) {
      const materialId = searchParams.get('materialId');
      const batchId = searchParams.get('batchId');
      if (materialId) {
        setShowAdvancedSearch(true);
        setAdvancedMaterialId(materialId);
        if (batchId) setAdvancedBatchId(batchId);
      }
    }
  }, [fetchUserPermissions, searchParams, fetchTotalRecords, fetchFilterOptions]);
  
  useEffect(() => {
    if (advancedMaterialId) {
      fetchBatches();
    } else {
      setBatches([]);
    }
  }, [advancedMaterialId, fetchBatches]);

  useEffect(() => {
    // If advancedBatchId is set but not in batches, fetch and add it
    if (advancedBatchId && !batches.find(b => b.id === advancedBatchId)) {
      (async () => {
        try {
          const res = await fetch(`/api/inventory/batch/${advancedBatchId}`);
          if (res.ok) {
            const data = await res.json();
            setSelectedBatch(data);
          }
        } catch {}
      })();
    } else {
      setSelectedBatch(null);
    }
  }, [advancedBatchId, batches]);

  const hasPermission = (permissionName: string) => {
    return userPermissions.some(p => p.name === permissionName);
  };

  const handleClearFilters = () => {
    setSearch('');
    setPhysician('');
    setDateRange('last7days');
    setMaterialType('');

    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 6);
    setDateFrom(getISODateString(fromDate));
    setDateTo(getISODateString(today));
    setAdvancedMaterialId('');
    setAdvancedBatchId('');
    setShowAdvancedSearch(false);
    setTriggerFetch(c => c + 1);
  };

  const handleClearAdvancedSearch = () => {
    setAdvancedMaterialId('');
    setAdvancedBatchId('');
    setSelectedBatch(null);
    setBatches([]);
    setTriggerFetch(prev => prev + 1);
  };

  const handleEditUsage = async (group: {
    patientName: string;
    patientId: string;
    procedureName: string;
    procedureDate: string;
    physician: string;
    records: UsageRecord[];
  }) => {
    try {
      const params = new URLSearchParams({
        patientName: group.patientName,
        patientId: group.patientId,
        procedureName: group.procedureName,
        procedureDate: new Date(group.procedureDate).toISOString().split('T')[0],
      });

      const res = await fetch(`/api/usage/procedure?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch full procedure details.');
      }

      const fullProcedureRecords: UsageRecord[] = await res.json();

      if (fullProcedureRecords.length > 0) {
        const firstRecord = fullProcedureRecords[0];
        const groupedUsageRecord: GroupedUsageRecord = {
          id: `group-${firstRecord.id}`,
          patientName: group.patientName,
          patientId: group.patientId,
          procedureName: group.procedureName,
          procedureDate: group.procedureDate,
          physician: group.physician,
          batchId: '',
          quantity: 0,
          createdAt: firstRecord.createdAt,
          user: firstRecord.user,
          batch: firstRecord.batch,
          records: fullProcedureRecords,
        };
        
        setSelectedUsageRecord(groupedUsageRecord);
        setShowEditDialog(true);
      } else {
        toast.error('Could not find the procedure to edit.');
      }
    } catch (error) {
      console.error('Error in handleEditUsage:', error);
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
  };
  
  const handleUsageSuccess = () => {
    setTriggerFetch(c => c + 1);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setSelectedUsageRecord(null);
    handleUsageSuccess();
  };

  const handleDeleteUsage = (group: {
    patientName: string;
    patientId: string;
    procedureName: string;
    procedureDate: string;
    physician: string;
    records: UsageRecord[];
  }) => {
    setGroupToDelete(group);
    setShowDeleteDialog(true);
  };

  const confirmDeleteUsage = async () => {
    if (!groupToDelete) return;
    setShowDeleteDialog(false);
    try {
      const deletePromises = groupToDelete.records.map(record =>
        fetch(`/api/usage/${record.id}`, { method: 'DELETE' })
      );
      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.ok
      ).length;
      if (successful < groupToDelete.records.length) {
        toast.error('Some items failed to delete.');
      } else {
        toast.success(`Successfully deleted entire procedure for ${groupToDelete.patientName}`);
      }
      handleUsageSuccess();
    } catch (error) {
      console.error('Error deleting usage records:', error);
      toast.error('Failed to delete usage records.');
    } finally {
      setGroupToDelete(null);
    }
  };

  // Helper to group records into procedures
  function groupRecords(records: UsageRecord[]) {
    return records.reduce((groups, record) => {
      const procedureDate = new Date(record.procedureDate).toISOString().split('T')[0];
      const key = `${record.patientName}-${record.patientId}-${record.procedureName}-${procedureDate}`;
      if (!groups[key]) {
        groups[key] = {
          patientName: record.patientName,
          patientId: record.patientId,
          procedureName: record.procedureName,
          procedureDate: record.procedureDate,
          physician: record.physician,
          records: []
        };
      }
      groups[key].records.push(record);
      return groups;
    }, {} as Record<string, {
      patientName: string;
      patientId: string;
      procedureName: string;
      procedureDate: string;
      physician: string;
      records: UsageRecord[];
    }>);
  }

  // Group filtered records for display and count (move this above useEffect)
  let filteredUsageRecords = usageRecords;
  if (purchaseTypeFilter !== 'all') {
    // Only keep records where at least one material in the procedure used the selected purchase type
    const grouped = groupRecords(usageRecords);
    filteredUsageRecords = Object.values(grouped)
      .filter(group => group.records.some(record => record.batch.purchaseType === purchaseTypeFilter))
      .flatMap(group => group.records);
  }
  const groupedRecords = groupRecords(filteredUsageRecords);
  const shownProcedures = Object.keys(groupedRecords).length;

  // Fetch all usage records (unfiltered) on mount for total procedures
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const res = await fetch('/api/usage?all=1');
        const data = await res.json();
        if (Array.isArray(data)) {
          const grouped = groupRecords(data);
          const total = Object.keys(grouped).length;
          setTotalProcedures(total > 0 ? total : shownProcedures);
        } else {
          setTotalProcedures(shownProcedures);
        }
      } catch {
        setTotalProcedures(shownProcedures);
      }
    })();
  }, [mounted, shownProcedures]);

  useEffect(() => {
    if (showAdvancedSearch) {
      setDateRange('all');
    }
  }, [showAdvancedSearch]);

  // Create options for the searchable select in advanced search
  const advancedMaterialOptions = materials.map((m) => ({
    value: m.id,
    label: `${m.name} ${m.size && `(${m.size})`}`
  }));

  // Helper to format date as DD-MM-YYYY
  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  }

  // Export as Excel
  const handleExportExcel = () => {
    let exportRows = usageRecords;
    if (purchaseTypeFilter === 'Advance') {
      exportRows = usageRecords.filter(rec => rec.batch.purchaseType === 'Advance');
    }
    const exportData = exportRows.map(rec => ({
      'Patient Name': rec.patientName,
      'Patient ID': rec.patientId,
      'Procedure Name': rec.procedureName,
      'Procedure Date': formatDate(rec.procedureDate),
      'Physician': rec.physician,
      'Material': rec.batch.material.name,
      'Material Type': rec.batch.material.materialType.name,
      'Brand': rec.batch.material.brand.name,
      'Batch Lot': rec.batch.lotNumber,
      'Purchase Type': rec.batch.purchaseType,
      'Vendor': rec.batch.vendor?.name,
      'Quantity': rec.quantity,
      'Recorded By': rec.user.username,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usage');
    XLSX.writeFile(wb, 'usage_export.xlsx');
  };

  // Export as PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let exportRows = usageRecords;
    if (purchaseTypeFilter === 'Advance') {
      exportRows = usageRecords.filter(rec => rec.batch.purchaseType === 'Advance');
    }
    const exportData = exportRows.map(rec => ([
      rec.patientName,
      rec.patientId,
      rec.procedureName,
      formatDate(rec.procedureDate),
      rec.physician,
      rec.batch.material.name,
      rec.batch.material.materialType.name,
      rec.batch.material.brand.name,
      rec.batch.lotNumber,
      rec.batch.purchaseType,
      rec.batch.vendor?.name,
      rec.quantity,
      rec.user.username,
    ]));
    autoTable(doc, {
      head: [['Patient Name', 'Patient ID', 'Procedure Name', 'Procedure Date', 'Physician', 'Material', 'Material Type', 'Brand', 'Batch Lot', 'Purchase Type', 'Vendor', 'Quantity', 'Recorded By']],
      body: exportData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [49, 46, 129] },
    });
    doc.save('usage_export.pdf');
  };

  if (!mounted || permissionsLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Usage Records</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track material usage by patient and procedure
          </p>
        </div>
        <div className="flex gap-2 items-center justify-end">
          <Button variant="highlight" className="font-semibold" onClick={() => setShowAddDialog(true)}>
            Record Usage
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            Export as Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            Export as PDF
          </Button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Filters</h3>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="sm:col-span-2 flex gap-2 items-center">
            <Input
              placeholder="Search patient, procedure, material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {search && (
              <button
                type="button"
                className="ml-1 text-red-500 hover:text-red-700"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            )}
            <Button onClick={handleSearch}>Search</Button>
          </div>
          <div className="flex items-center">
            <Select value={physician} onValueChange={setPhysician}>
              <SelectTrigger>
                <SelectValue placeholder="All Physicians" />
              </SelectTrigger>
              <SelectContent>
                {physicians.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {physician && (
              <button
                type="button"
                className="ml-1 text-red-500 hover:text-red-700"
                onClick={() => setPhysician('')}
                aria-label="Clear physician"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center">
            <Select value={dateRange} onValueChange={(value) => {
              setDateRange(value)
              if (value === 'custom') {
                setDateFrom('');
                setDateTo('');
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select Date Range" />
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
            {dateRange !== 'last7days' && dateRange !== 'all' && (
              <button
                type="button"
                className="ml-1 text-red-500 hover:text-red-700"
                onClick={() => setDateRange('last7days')}
                aria-label="Clear date range"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center">
            <Select value={materialType} onValueChange={setMaterialType}>
              <SelectTrigger>
                <SelectValue placeholder="All Material Types" />
              </SelectTrigger>
              <SelectContent>
                {materialTypes.map((mt) => (
                  <SelectItem key={mt.id} value={mt.id}>
                    {mt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {materialType && (
              <button
                type="button"
                className="ml-1 text-red-500 hover:text-red-700"
                onClick={() => setMaterialType('')}
                aria-label="Clear material type"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center">
            <Select value={purchaseTypeFilter} onValueChange={setPurchaseTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Purchase Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purchase Types</SelectItem>
                <SelectItem value="Advance">Advance</SelectItem>
                <SelectItem value="Purchased">Purchased</SelectItem>
              </SelectContent>
            </Select>
            {purchaseTypeFilter !== 'all' && (
              <button
                type="button"
                className="ml-1 text-red-500 hover:text-red-700"
                onClick={() => setPurchaseTypeFilter('all')}
                aria-label="Clear purchase type"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Button variant="link" onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}>
            {showAdvancedSearch ? 'Hide Advanced Search' : 'Show Advanced Search'}
          </Button>
        </div>

        {showAdvancedSearch && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
            <div className="sm:col-span-2">
              <SearchableSelect
                options={advancedMaterialOptions}
                value={advancedMaterialId}
                onValueChange={(value) => {
                  setAdvancedMaterialId(value);
                  setAdvancedBatchId('');
                }}
                placeholder="Select a Material"
              />
            </div>
            <div className="sm:col-span-2">
              <Select value={advancedBatchId} onValueChange={setAdvancedBatchId} disabled={!advancedMaterialId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder="Select a Batch (Optional)"
                    {...(advancedBatchId && (selectedBatch || batches.find(b => b.id === advancedBatchId)) ? {
                      children: `${
                        (selectedBatch && selectedBatch.purchaseType) ||
                        (batches.find(b => b.id === advancedBatchId)?.purchaseType) ||
                        'N/A'
                      } | ${
                        (selectedBatch && selectedBatch.vendor?.name) ||
                        (batches.find(b => b.id === advancedBatchId)?.vendor?.name) ||
                        'N/A'
                      } | ${
                        (() => {
                          const dateStr = (selectedBatch && selectedBatch.expirationDate) || (batches.find(b => b.id === advancedBatchId)?.expirationDate);
                          return dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
                        })()
                      } | ${
                        (selectedBatch && selectedBatch.lotNumber) ||
                        (batches.find(b => b.id === advancedBatchId)?.lotNumber) ||
                        'N/A'
                      }`
                    } : {})}
                  />
                </SelectTrigger>
                <SelectContent>
                  {selectedBatch && !batches.find(b => b.id === selectedBatch.id) && (
                    <SelectItem key={selectedBatch.id} value={selectedBatch.id}>
                      {selectedBatch.purchaseType || 'N/A'} | {selectedBatch.vendor?.name || 'N/A'} | {selectedBatch.expirationDate ? new Date(selectedBatch.expirationDate).toLocaleDateString() : 'N/A'} | {selectedBatch.lotNumber || 'N/A'}
                    </SelectItem>
                  )}
                  {batches.map((b) => {
                    const purchaseType = b.purchaseType || 'N/A';
                    const vendor = b.vendor?.name || 'N/A';
                    const expirationDate = b.expirationDate ? new Date(b.expirationDate).toLocaleDateString() : 'N/A';
                    const lotNumber = b.lotNumber || 'N/A';
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        {purchaseType} | {vendor} | {expirationDate} | {lotNumber}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                onClick={handleSearch} 
                disabled={!advancedMaterialId}
                className="w-full"
              >
                Search
              </Button>
            </div>
            <div>
              <Button 
                variant="outline"
                onClick={handleClearAdvancedSearch} 
                disabled={!advancedMaterialId && !advancedBatchId}
                className="w-full"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-start-4">
              <Input
                type="date"
                placeholder="From Date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="To Date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Always show the entries count */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Showing {shownProcedures} of {totalProcedures} entries
      </div>

      {loading ? (
        <div className="text-center py-8">Loading usage records...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : Object.keys(groupedRecords).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No usage records found
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedRecords).map((group, index) => (
            <Card key={index} className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <span className="text-lg font-semibold">{group.patientName}</span>
                    <span className="text-gray-500 ml-2">({group.patientId})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-500">
                      {new Date(group.procedureDate).toLocaleDateString()}
                    </div>
                    {hasPermission('Record Usage') && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUsage(group)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUsage(group)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardTitle>
                <div className="text-sm text-gray-600">
                  <div><strong>Procedure:</strong> {group.procedureName}</div>
                  <div><strong>Physician:</strong> {group.physician}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.records.map((record) => (
                    <div key={record.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="font-medium flex items-center gap-2">
                          {record.batch.material.name}
                          {record.batch.material.size && ` (${record.batch.material.size})`}
                          {record.batch.purchaseType && (
                            <span
                              className={`ml-2 px-2 py-1 rounded text-xs font-semibold 
                                ${record.batch.purchaseType === 'Advance' ? 'bg-orange-100 text-orange-700' : ''}
                                ${record.batch.purchaseType === 'Purchased' ? 'bg-green-100 text-green-700' : ''}
                              `}
                              style={{ minWidth: 70 }}
                            >
                              {record.batch.purchaseType}
                            </span>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5">
                            {record.batch.material.brand?.name && <span>{record.batch.material.brand.name}</span>}
                            {record.batch.vendor?.name && <span> &middot; {record.batch.vendor.name}</span>}
                          </div>
                        </div>
                        <ActionsPopup
                          actions={[
                            {
                              label: 'View Material Details',
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                router.push(`/inventory/${record.batch.material.id}`);
                              },
                            },
                            record.batch.document && {
                              label: 'View Document Details',
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                router.push(`/documents/${record.batch.document!.id}?referrer=usage`);
                              },
                              variant: 'outline',
                            },
                            {
                              label: 'View Usage Details',
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                router.push(`/usage?advanced=1&materialId=${record.batch.material.id}&batchId=${record.batch.id}`);
                              },
                              variant: 'outline',
                            },
                          ].filter(Boolean) as Action[]}
                        />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 md:mt-0">
                        <div className="text-right">
                          <div className="font-semibold text-lg">{record.quantity} units</div>
                          <div className="text-xs text-gray-500">
                            Recorded by {record.user.username}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(record.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UsageForm
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleUsageSuccess}
      />

      <EditUsageForm
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedUsageRecord(null);
        }}
        onSuccess={handleEditSuccess}
        usageRecord={selectedUsageRecord}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MedStock App</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {groupToDelete && (
              <div>
                Are you sure you want to delete this entire procedure for patient <b>{groupToDelete.patientName}</b>?<br />
                <span className="text-sm text-gray-500">This will restore all material quantities to inventory.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setGroupToDelete(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteUsage}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UsagePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <UsagePageInner />
    </Suspense>
  );
}