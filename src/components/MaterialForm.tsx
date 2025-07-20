import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { toast } from 'sonner';

const materialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  size: z.string().min(1, 'Size is required'),
  brandId: z.string().min(1, 'Brand is required'),
  materialTypeId: z.string().min(1, 'Material type is required'),
});

type MaterialFormData = z.infer<typeof materialSchema>;

interface Brand {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
}

interface MaterialFormProps {
  materialId?: string; // Optional for create mode
  initialData?: Partial<MaterialFormData>;
  brands: Brand[];
  materialTypes: MaterialType[];
  onSuccess: () => void;
  onCancel: () => void;
  mode?: 'create' | 'edit';
}

export function MaterialForm({
  materialId,
  initialData,
  brands,
  materialTypes,
  onSuccess,
  onCancel,
  mode = 'edit',
}: MaterialFormProps) {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: MaterialFormData) => {
    setLoading(true);
    try {
      const url = mode === 'create' ? '/api/inventory' : `/api/inventory/${materialId}`;
      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Failed to ${mode} material`);
      }
      
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${mode} material`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name')}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="size">Size</Label>
        <Input
          id="size"
          {...register('size')}
          className={errors.size ? 'border-red-500' : ''}
        />
        {errors.size && (
          <p className="text-sm text-red-500">{errors.size.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="brandId">Brand</Label>
        <Select
          onValueChange={(value: string) => setValue('brandId', value, { shouldValidate: true })}
          defaultValue={initialData?.brandId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a brand" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.brandId && (
          <p className="text-sm text-red-500">{errors.brandId.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="materialTypeId">Material Type</Label>
        <Select
          onValueChange={(value: string) => setValue('materialTypeId', value, { shouldValidate: true })}
          defaultValue={initialData?.materialTypeId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {materialTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.materialTypeId && (
          <p className="text-sm text-red-500">{errors.materialTypeId.message}</p>
        )}
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  );
} 