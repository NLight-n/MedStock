'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Vendor {
  id: string;
  name: string;
}

export default function DocumentUploadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    documentNumber: '',
    date: '',
    vendor: '',
    file: null as File | null,
  });
  const [fileSize, setFileSize] = useState<string | null>(null);

  useEffect(() => {
    const checkPermissionAndFetchData = async () => {
      try {
        // Check user permissions
        if (session?.user) {
          const userResponse = await fetch('/api/auth/me');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const hasEditPermission = userData.user?.permissions?.some(
              (p: { name: string }) => p.name === 'Edit Documents'
            );
            setHasPermission(hasEditPermission);
            
            if (!hasEditPermission) {
              setError('You do not have permission to upload documents');
              return;
            }
          }
        }

        // Fetch vendors
        const vendorsResponse = await fetch('/api/settings/vendors');
        if (vendorsResponse.ok) {
          const vendorsData = await vendorsResponse.json();
          setVendors(vendorsData);
        }
      } catch {
        setError('Failed to load page data');
      }
    };

    checkPermissionAndFetchData();
  }, [session]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, file }));
    if (file) {
      const sizeKB = file.size / 1024;
      setFileSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB.toFixed(2)} KB`);
    } else {
      setFileSize(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.vendor) {
        setError('Vendor is required.');
        setLoading(false);
        return;
      }
      // file is optional
      const formDataToSend = new FormData();
      formDataToSend.append('type', formData.type);
      formDataToSend.append('documentNumber', formData.documentNumber);
      formDataToSend.append('date', formData.date);
      formDataToSend.append('vendor', formData.vendor);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formDataToSend,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
      const result = await response.json();
      router.push(`/documents/${result.id}?referrer=documents`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission && !error) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        </div>
      </div>
    );
  }

  if (error && !hasPermission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <Link href="/documents" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            ← Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/documents" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Documents
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Upload Document</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Upload a new invoice, delivery challan, purchase order, governing council document, or other document
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="type">Document Type *</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Invoice">Invoice</SelectItem>
              <SelectItem value="Delivery Challan">Delivery Challan</SelectItem>
              <SelectItem value="Purchase Order">Purchase Order</SelectItem>
              <SelectItem value="Governing Council">Governing Council</SelectItem>
              <SelectItem value="Others">Others</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="documentNumber">Document Number *</Label>
          <Input
            id="documentNumber"
            type="text"
            value={formData.documentNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, documentNumber: e.target.value }))}
            placeholder="e.g., INV-001, DC-001, PO-001, GC-001"
            required
          />
        </div>

        <div>
          <Label htmlFor="date">Document Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="vendor">Vendor *</Label>
          <Select value={formData.vendor} onValueChange={(value) => setFormData(prev => ({ ...prev, vendor: value }))} required>
            <SelectTrigger>
              <SelectValue placeholder="Select a vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map(vendor => (
                <SelectItem key={vendor.id} value={vendor.name}>{vendor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!formData.vendor && error) && (
            <p className="text-red-600 text-sm mt-1">Vendor is required.</p>
          )}
        </div>

        <div>
          <Label htmlFor="file">Document File</Label>
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx"
          />
          {fileSize && (
            <p className="text-xs text-gray-500 mt-1">Selected file size: {fileSize}</p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Supported formats: PDF, Images (JPG, PNG, GIF, BMP, WebP), Documents (DOC, DOCX)
          </p>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload Document'}
          </Button>
          <Link href="/documents">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
} 