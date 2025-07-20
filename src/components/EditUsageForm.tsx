'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  size: string;
  brand: { id: string; name: string };
  materialType: { id: string; name: string };
  batches: Batch[];
}

interface Batch {
  id: string;
  quantity: number;
  purchaseType: string;
  vendor: { id: string; name: string };
  lotNumber: string;
  expirationDate: string;
  storageLocation: string;
  document?: { id: string; documentNumber: string } | null;
  stockAddedDate: string;
  stockAddedBy: string;
}

interface Physician {
  id: string;
  name: string;
  specialization: string;
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
  batch: {
    id: string;
    materialId: string;
    material: {
      id: string;
      name: string;
      size: string;
      brand: { id: string; name: string };
      materialType: { id: string; name: string };
    };
    vendor: { id: string; name: string };
  };
}

interface GroupedUsageRecord extends Omit<UsageRecord, 'batchId' | 'quantity'> {
  id: string;
  batchId: string;
  quantity: number;
  records: UsageRecord[];
}

interface MaterialUsage {
  id?: string; // For existing records
  clientId: string; // Stable ID for React key
  materialId: string;
  batchId: string;
  quantity: number;
  isNew?: boolean; // To track if this is a new material
}

interface EditUsageFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  usageRecord: UsageRecord | GroupedUsageRecord | null;
}

export function EditUsageForm({ isOpen, onClose, onSuccess, usageRecord }: EditUsageFormProps) {
  const [formData, setFormData] = useState({
    patientName: '',
    patientId: '',
    procedureName: '',
    procedureDate: '',
    physician: '',
  });

  const [materialUsages, setMaterialUsages] = useState<MaterialUsage[]>([]);
  const [deletedUsageIds, setDeletedUsageIds] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [availableBatches, setAvailableBatches] = useState<Record<string, Batch[]>>({});
  const [loading, setLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [physiciansLoading, setPhysiciansLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchMaterials();
      fetchPhysicians();
      setDeletedUsageIds([]); // Reset on open
    }
  }, [isOpen]);

  useEffect(() => {
    // We must wait for materials AND physicians to be loaded before processing the usage record
    if (usageRecord && isOpen && materials.length > 0 && physicians.length > 0) {
      setFormData({
        patientName: usageRecord.patientName,
        patientId: usageRecord.patientId,
        procedureName: usageRecord.procedureName,
        procedureDate: new Date(usageRecord.procedureDate).toISOString().split('T')[0],
        physician: usageRecord.physician,
      });

      const newAvailableBatches: Record<string, Batch[]> = {};
      let usages: MaterialUsage[] = [];

      if ('records' in usageRecord && usageRecord.records) {
        usages = usageRecord.records.map((record, index) => ({
          id: record.id,
          clientId: record.id || `record-${index}`,
          materialId: record.batch.materialId,
          batchId: record.batchId,
          quantity: record.quantity,
          isNew: false
        }));
      } else {
        usages = [{
          id: usageRecord.id,
          clientId: usageRecord.id,
          materialId: (usageRecord as UsageRecord).batch.materialId,
          batchId: (usageRecord as UsageRecord).batchId,
          quantity: (usageRecord as UsageRecord).quantity,
          isNew: false
        }];
      }

      setMaterialUsages(usages);

      usages.forEach(usage => {
        const material = materials.find(m => m.id === usage.materialId);
        if (material) {
          const now = new Date();
          // Show all batches for the material, not just those with available stock
          const available = material.batches.filter(batch => 
            new Date(batch.expirationDate) > now
          );
          newAvailableBatches[usage.materialId] = available;
        }
      });
      setAvailableBatches(newAvailableBatches);
    }
  }, [usageRecord, isOpen, materials, physicians]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`/api/inventory?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast.error('Failed to fetch materials');
    } finally {
      setMaterialsLoading(false);
    }
  };

  const fetchPhysicians = async () => {
    try {
      const response = await fetch('/api/settings/physicians');
      if (response.ok) {
        const data = await response.json();
        setPhysicians(data);
      }
    } catch (error) {
      console.error('Error fetching physicians:', error);
      toast.error('Failed to fetch physicians');
    } finally {
      setPhysiciansLoading(false);
    }
  };

  const addMaterial = () => {
    setMaterialUsages(prev => [...prev, { 
      clientId: `new-${Date.now()}`,
      materialId: '', 
      batchId: '', 
      quantity: 1, 
      isNew: true 
    }]);
  };

  const removeMaterial = (clientId: string) => {
    const usageToRemove = materialUsages.find(u => u.clientId === clientId);

    if (usageToRemove && usageToRemove.id && !usageToRemove.isNew) {
      setDeletedUsageIds(prev => [...prev, usageToRemove.id!]);
    }
    setMaterialUsages(prev => prev.filter(item => item.clientId !== clientId));
  };

  const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
    setMaterialUsages(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'materialId') {
          updatedItem.batchId = '';
          updatedItem.quantity = 1;
          
          const material = materials.find(m => m.id === value);
          if (material) {
            const now = new Date();
            // Show all batches for the material, not just those with available stock
            const available = material.batches.filter(batch => 
              new Date(batch.expirationDate) > now
            );
            setAvailableBatches(prevBatches => ({ ...prevBatches, [value as string]: available }));
          }
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const handleQuantityChange = (index: number, value: string) => {
    const quantity = parseInt(value);
    const usage = materialUsages[index];
    const selectedBatch = availableBatches[usage.materialId]?.find(b => b.id === usage.batchId);
    
    // Only validate quantity if the batch has stock and it's not the currently selected batch
    if (selectedBatch && selectedBatch.quantity > 0 && quantity > selectedBatch.quantity) {
      toast.error(`Maximum available quantity is ${selectedBatch.quantity}`);
      return;
    }
    
    updateMaterialUsage(index, 'quantity', quantity);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate that at least one material is selected
      const validUsages = materialUsages.filter(usage => 
        usage.materialId && usage.batchId && usage.quantity > 0
      );

      if (validUsages.length === 0 && deletedUsageIds.length === 0) {
        toast.error('No changes to save.');
        setLoading(false);
        return;
      }

      const updateAndCreatePromises = validUsages.map(usage => {
        if (usage.isNew) {
          // Create new usage record
          return fetch('/api/usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              batchId: usage.batchId,
              quantity: usage.quantity
            }),
          });
        } else {
          // Update existing usage record
          return fetch(`/api/usage/${usage.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              batchId: usage.batchId,
              quantity: usage.quantity
            }),
          });
        }
      });

      const deletePromises = deletedUsageIds.map(id => 
        fetch(`/api/usage/${id}`, { method: 'DELETE' })
      );
      
      const allPromises = [...updateAndCreatePromises, ...deletePromises];

      const results = await Promise.allSettled(allPromises);

      const successful = results.filter(result => 
        result.status === 'fulfilled' && (result.value.ok || result.value.status === 201)
      );
      const failed = results.filter(result => 
        result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok && result.value.status !== 201)
      );

      if (failed.length > 0) {
        console.error('Some usage records failed to update:', failed);
        if (successful.length > 0) {
          toast.warning(`Partially successful: ${successful.length} of ${allPromises.length} operations completed`);
        } else {
          toast.error('Failed to update usage records. Please try again.');
        }
      } else {
        toast.success(`Successfully processed ${allPromises.length} change(s)`);
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Error updating usage records:', error);
      toast.error('Failed to update usage records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDeletedUsageIds([]); // Also reset here
    if (usageRecord) {
      if ('records' in usageRecord && usageRecord.records) {
        const usages: MaterialUsage[] = usageRecord.records.map((record, index) => ({
          id: record.id,
          clientId: record.id || `record-${index}`,
          materialId: record.batch.materialId,
          batchId: record.batchId,
          quantity: record.quantity,
          isNew: false
        }));
        setMaterialUsages(usages);
      } else {
        setMaterialUsages([{
          id: usageRecord.id,
          clientId: usageRecord.id,
          materialId: (usageRecord as UsageRecord).batch.materialId,
          batchId: (usageRecord as UsageRecord).batchId,
          quantity: (usageRecord as UsageRecord).quantity,
          isNew: false
        }]);
      }
    }
  };

  // Create options for the searchable select
  const materialOptions = materials.map((material) => ({
    value: material.id,
    label: `${material.name} ${material.size && `(${material.size})`} - ${material.brand.name}`
  }));

  if (!usageRecord) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Usage Record</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient and Procedure Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input
                id="patientName"
                value={formData.patientName}
                onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input
                id="patientId"
                value={formData.patientId}
                onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="procedureName">Procedure Name *</Label>
              <Input
                id="procedureName"
                value={formData.procedureName}
                onChange={(e) => setFormData(prev => ({ ...prev, procedureName: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="procedureDate">Procedure Date *</Label>
              <Input
                id="procedureDate"
                type="date"
                value={formData.procedureDate}
                onChange={(e) => setFormData(prev => ({ ...prev, procedureDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="physician">Physician *</Label>
            <Select
              value={formData.physician}
              onValueChange={(value) => setFormData(prev => ({ ...prev, physician: value }))}
              disabled={physiciansLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select physician" />
              </SelectTrigger>
              <SelectContent>
                {physicians.map((physician) => (
                  <SelectItem key={physician.id} value={physician.name}>
                    {physician.name} - {physician.specialization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Materials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Materials Used</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMaterial}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Material
              </Button>
            </div>

            {materialUsages.map((usage, index) => (
              <div key={usage.clientId} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Material {index + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMaterial(usage.clientId)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Material *</Label>
                    <SearchableSelect
                      options={materialOptions}
                      value={usage.materialId}
                      onValueChange={(value) => updateMaterialUsage(index, 'materialId', value)}
                      placeholder="Select material"
                      disabled={materialsLoading}
                    />
                  </div>

                  {usage.materialId && (
                    <div>
                      <Label>Batch *</Label>
                      <Select
                        value={usage.batchId}
                        onValueChange={(value) => updateMaterialUsage(index, 'batchId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch (FEFO order)" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBatches[usage.materialId]?.map((batch) => (
                            <SelectItem key={batch.id} value={batch.id}>
                              Qty: {batch.quantity} | {batch.purchaseType} | Vendor: {batch.vendor.name} | Exp: {new Date(batch.expirationDate).toLocaleDateString()}
                              {batch.lotNumber && ` | Lot: ${batch.lotNumber}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {usage.batchId && (
                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        max={availableBatches[usage.materialId]?.find(b => b.id === usage.batchId)?.quantity || 999999}
                        value={usage.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={loading}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Usage'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 