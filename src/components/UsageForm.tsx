'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';

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

interface MaterialUsage {
  materialId: string;
  batchId: string;
  quantity: number;
}

interface UsageFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UsageForm({ isOpen, onClose, onSuccess }: UsageFormProps) {
  const [formData, setFormData] = useState({
    patientName: '',
    patientId: '',
    procedureName: '',
    procedureDate: new Date().toISOString().split('T')[0],
    physician: '',
  });

  const [materialUsages, setMaterialUsages] = useState<MaterialUsage[]>([
    { materialId: '', batchId: '', quantity: 1 }
  ]);

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
    }
  }, [isOpen]);

  useEffect(() => {
    // Update available batches when material selections change
    const newAvailableBatches: Record<string, Batch[]> = {};
    
    materialUsages.forEach((usage) => {
      if (usage.materialId) {
        const material = materials.find(m => m.id === usage.materialId);
        if (material) {
          // Filter batches with available stock and not expired
          const now = new Date();
          const availableBatches = material.batches.filter(batch => 
            batch.quantity > 0 && new Date(batch.expirationDate) > now
          );
          newAvailableBatches[usage.materialId] = availableBatches;
        }
      }
    });
    
    setAvailableBatches(newAvailableBatches);
  }, [materialUsages, materials]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        setMaterials(Array.isArray(data.materials) ? data.materials : []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate that at least one material is selected
      const validUsages = materialUsages.filter(usage => 
        usage.materialId && usage.batchId && usage.quantity > 0
      );

      if (validUsages.length === 0) {
        toast.error('Please select at least one material');
        setLoading(false);
        return;
      }

      // Create usage records for each material
      const results = await Promise.allSettled(
        validUsages.map(usage => 
          fetch('/api/usage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...formData,
              batchId: usage.batchId,
              quantity: usage.quantity
            }),
          })
        )
      );

      const successful = results.filter(result => {
        if (result.status === 'rejected') return false;
        const response = result.value;
        return response.ok || response.status === 201;
      });
      
      const failed = results.filter(result => {
        if (result.status === 'rejected') return true;
        const response = result.value;
        return !response.ok && response.status !== 201;
      });

      if (failed.length > 0) {
        console.error('Some usage records failed to create:', failed);
        if (successful.length > 0) {
          toast.warning(`Partially successful: ${successful.length} of ${validUsages.length} materials recorded`);
        } else {
          toast.error('Failed to record usage. Please try again.');
        }
      } else {
        toast.success(`Successfully recorded usage for ${validUsages.length} material(s)`);
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Error recording usage:', error);
      toast.error('Failed to record usage. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientName: '',
      patientId: '',
      procedureName: '',
      procedureDate: new Date().toISOString().split('T')[0],
      physician: '',
    });
    setMaterialUsages([{ materialId: '', batchId: '', quantity: 1 }]);
  };

  const addMaterial = () => {
    setMaterialUsages(prev => [...prev, { materialId: '', batchId: '', quantity: 1 }]);
  };

  const removeMaterial = (index: number) => {
    if (materialUsages.length > 1) {
      setMaterialUsages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
    setMaterialUsages(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // If material is being changed, reset batch and quantity
        if (field === 'materialId') {
          updatedItem.batchId = '';
          updatedItem.quantity = 1;
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
    
    if (selectedBatch && quantity > selectedBatch.quantity) {
      toast.error(`Maximum available quantity is ${selectedBatch.quantity}`);
      return;
    }
    
    updateMaterialUsage(index, 'quantity', quantity);
  };

  // Create options for the searchable select
  const materialOptions = Array.isArray(materials)
    ? materials.filter(material => material.batches.some(batch => batch.quantity > 0))
        .map((material) => ({
          value: material.id,
          label: `${material.name} ${material.size && `(${material.size})`} - ${material.brand.name}`
        }))
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Material Usage</DialogTitle>
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
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Material {index + 1}</Label>
                  {materialUsages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
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
                        max={availableBatches[usage.materialId]?.find(b => b.id === usage.batchId)?.quantity || 1}
                        value={usage.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Available: {availableBatches[usage.materialId]?.find(b => b.id === usage.batchId)?.quantity || 0} units
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Record Usage'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 