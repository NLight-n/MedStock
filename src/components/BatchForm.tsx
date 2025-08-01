'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SearchableSelect, MultiSearchableSelect } from '@/components/ui/searchable-select';

type BatchFormData = {
  quantity: number;
  initialQuantity: number;
  expirationDate: string;
  vendorId: string;
  documentIds?: string[];
  storageLocation: string;
  purchaseType: string;
  lotNumber?: string;
  cost?: number;
};

const batchSchema = z.object({
  quantity: z.coerce
    .number()
    .min(0, 'Quantity must be positive'),
  initialQuantity: z.coerce
    .number()
    .min(0, 'Initial quantity must be positive'),
  expirationDate: z.string().min(1, 'Expiration date is required'),
  vendorId: z.string().min(1, 'Vendor is required'),
  documentIds: z.array(z.string()).optional(),
  storageLocation: z.string().min(1, 'Storage location is required'),
  purchaseType: z.string().min(1, 'Purchase type is required'),
  lotNumber: z.string().optional(),
  cost: z.coerce
    .number()
    .optional()
    .transform(val => isNaN(val as number) ? undefined : val),
});

interface Vendor {
  id: string;
  name: string;
}

interface Document {
  id: string;
  documentNumber: string;
}

interface BatchFormProps {
  materialId: string;
  batchId?: string;
  initialData?: Partial<BatchFormData>;
  vendors: Vendor[];
  documents: Document[];
  onSuccess: () => void;
  onCancel: () => void;
  mode?: 'add' | 'edit';
}

export function BatchForm({
  materialId,
  batchId,
  initialData,
  vendors,
  documents,
  onSuccess,
  onCancel,
  mode = 'add',
}: BatchFormProps) {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      quantity: 0,
      initialQuantity: 0,
      expirationDate: '',
      vendorId: '',
      documentIds: undefined,
      storageLocation: '',
      purchaseType: '',
      lotNumber: '',
      cost: undefined,
      ...initialData,
    },
  });

  // Keep initialQuantity in sync with quantity in 'add' mode
  const quantityValue = watch('quantity');
  useEffect(() => {
    if (mode === 'add') {
      setValue('initialQuantity', quantityValue, { shouldValidate: true });
    }
  }, [quantityValue, mode, setValue]);

  const onSubmit = async (data: BatchFormData) => {
    setLoading(true);
    try {
      const url = batchId
        ? `/api/inventory/${materialId}/batches/${batchId}`
        : `/api/inventory/${materialId}/batches`;
      
      const response = await fetch(url, {
        method: batchId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save batch');
      }

      toast.success(`Batch ${batchId ? 'updated' : 'created'} successfully`);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${batchId ? 'update' : 'create'} batch`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      <div className="flex-1 overflow-y-auto pr-2 pb-4 min-h-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              {...register('quantity')}
              className={errors.quantity ? 'border-red-500' : ''}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity.message}</p>
            )}
          </div>
          {mode === 'edit' && (
            <div>
              <Label htmlFor="initialQuantity">Initial Quantity</Label>
              <Input
                id="initialQuantity"
                type="number"
                {...register('initialQuantity')}
                className={errors.initialQuantity ? 'border-red-500' : ''}
              />
              {errors.initialQuantity && (
                <p className="text-sm text-red-500">{errors.initialQuantity.message}</p>
              )}
            </div>
          )}
          {/* Hidden input for initialQuantity in add mode */}
          {mode === 'add' && (
            <input type="hidden" {...register('initialQuantity')} />
          )}
          <div>
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Input
              id="expirationDate"
              type="date"
              {...register('expirationDate')}
              className={errors.expirationDate ? 'border-red-500' : ''}
            />
            {errors.expirationDate && (
              <p className="text-sm text-red-500">{errors.expirationDate.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="vendorId">Vendor</Label>
            <SearchableSelect
              options={vendors.map(v => ({ value: v.id, label: v.name }))}
              value={watch('vendorId')}
              onValueChange={value => setValue('vendorId', value, { shouldValidate: true })}
              placeholder="Select a vendor"
            />
            {errors.vendorId && (
              <p className="text-sm text-red-500">{errors.vendorId.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="documentIds">Documents (Optional)</Label>
            <MultiSearchableSelect
              options={documents.map(d => ({ value: d.id, label: d.documentNumber }))}
              value={watch('documentIds')}
              onValueChange={value => setValue('documentIds', value, { shouldValidate: true })}
              placeholder="Select documents"
            />
          </div>
          <div>
            <Label htmlFor="storageLocation">Storage Location</Label>
            <Input
              id="storageLocation"
              {...register('storageLocation')}
              className={errors.storageLocation ? 'border-red-500' : ''}
            />
            {errors.storageLocation && (
              <p className="text-sm text-red-500">{errors.storageLocation.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="purchaseType">Purchase Type</Label>
            <Select
              onValueChange={(value: string) => setValue('purchaseType', value, { shouldValidate: true })}
              defaultValue={initialData?.purchaseType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purchase type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Purchased">Purchased</SelectItem>
                <SelectItem value="Advance">Advance</SelectItem>
              </SelectContent>
            </Select>
            {errors.purchaseType && (
              <p className="text-sm text-red-500">{errors.purchaseType.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lotNumber">Lot Number (Optional)</Label>
            <Input
              id="lotNumber"
              {...register('lotNumber')}
              className={errors.lotNumber ? 'border-red-500' : ''}
            />
            {errors.lotNumber && (
              <p className="text-sm text-red-500">{errors.lotNumber.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="cost">Cost (Optional)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              {...register('cost')}
              className={errors.cost ? 'border-red-500' : ''}
            />
            {errors.cost && (
              <p className="text-sm text-red-500">{errors.cost.message}</p>
            )}
          </div>
        </form>
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t mt-4 flex-shrink-0 bg-background" style={{ paddingBottom: '12px', marginBottom: '8px' }}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} onClick={handleSubmit(onSubmit)}>
          {loading ? 'Saving...' : mode === 'add' ? 'Add Batch' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
} 