'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Document } from '@prisma/client';

interface EditDocumentButtonProps {
  documentId: string;
  document: Document;
}

export default function EditDocumentButton({ documentId, document }: EditDocumentButtonProps) {
  const { data: session } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: document.type,
    documentNumber: document.documentNumber,
    date: document.date ? new Date(document.date).toISOString().slice(0, 10) : '',
    vendor: document.vendor || '',
    file: null as File | null,
  });

  useEffect(() => {
    const checkPermissionAndFetchVendors = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/auth/me');
          if (response.ok) {
            const userData = await response.json();
            const hasEditPermission = userData.user?.permissions?.some(
              (p: { name: string }) => p.name === 'Edit Documents'
            );
            setHasPermission(hasEditPermission);
          }
        } catch {
          setHasPermission(false);
        }
      }
      // Fetch vendors
      try {
        const vendorsResponse = await fetch('/api/settings/vendors');
        if (vendorsResponse.ok) {
          const vendorsData = await vendorsResponse.json();
          setVendors(vendorsData);
        }
      } catch {
        // ignore
      }
    };
    checkPermissionAndFetchVendors();
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
    setSuccess(null);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('type', formData.type);
      formDataToSend.append('documentNumber', formData.documentNumber);
      formDataToSend.append('date', formData.date);
      formDataToSend.append('vendor', formData.vendor);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'PUT',
        body: formDataToSend,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update document');
      }
      setSuccess('Document updated successfully');
      setTimeout(() => {
        setShowModal(false);
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setShowModal(true)}>
        Edit Document
      </Button>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Edit Document</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Select value={formData.vendor} onValueChange={(value) => setFormData(prev => ({ ...prev, vendor: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.name}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="file">Replace Document File</Label>
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
                  Leave blank to keep the current file. Supported formats: PDF, Images (JPG, PNG, GIF, BMP, WebP), Documents (DOC, DOCX)
                </p>
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 