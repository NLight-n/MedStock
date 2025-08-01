'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BatchForm } from '@/components/BatchForm';
import { toast } from 'sonner';
import { MaterialForm } from '@/components/MaterialForm';
import Link from 'next/link';
import BackToInventoryButton from '../../documents/[id]/BackToInventoryButton';
import ActionsPopup from '@/components/ActionsPopup';
import { Pencil, X, CirclePlus } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface Batch {
  id: string;
  quantity: number;
  initialQuantity: number;
  purchaseType: string;
  vendor: { id: string; name: string };
  documents: { document: { id: string; documentNumber: string } }[];
  addedBy: { username: string; email: string };
  storageLocation: string;
  lotNumber: string | null;
  cost: number | null;
  expirationDate: string;
  stockAddedDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Material {
  id: string;
  name: string;
  size: string;
  brand: { id: string; name: string };
  materialType: { id: string; name: string };
  batches: Batch[];
}

interface Vendor {
  id: string;
  name: string;
}

interface Document {
  id: string;
  documentNumber: string;
}

export default function MaterialDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<string | null>(null);
  const [showAddBatchDialog, setShowAddBatchDialog] = useState(false);
  const [showEditBatchDialog, setShowEditBatchDialog] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [materialTypes, setMaterialTypes] = useState<{ id: string; name: string }[]>([]);
  const [materialId, setMaterialId] = useState<string | null>(null);

  const permissions = session?.user?.permissions || [];
  const canEdit = permissions.includes('Edit Materials');

  // Extract material ID from params
  useEffect(() => {
    params.then(({ id }) => {
      setMaterialId(id);
    });
  }, [params]);

  const fetchMaterial = useCallback(async () => {
    if (!materialId) return;
    try {
      const response = await fetch(`/api/inventory/${materialId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch material');
      }
      const data = await response.json();
      setMaterial(data);
    } catch (err) {
      setError('Failed to load material details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    if (materialId) {
      fetchMaterial();
      fetchVendors();
      fetchDocuments();
      fetchFilterOptions();
    }
  }, [materialId, fetchMaterial]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/inventory/filters');
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      const data = await response.json();
      setBrands(data.brands);
      setMaterialTypes(data.materialTypes);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      if (!response.ok) {
        throw new Error('Failed to fetch vendors');
      }
      const data = await response.json();
      setVendors(data);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || !materialId) {
      toast.error('You do not have permission to delete materials');
      return;
    }

    try {
      const response = await fetch(`/api/inventory/${materialId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete material');
      }

      toast.success('Material deleted successfully');
      router.push('/inventory');
    } catch (err) {
      toast.error('Failed to delete material');
      console.error(err);
    }
  };

  const handleBatchDelete = async (batchId: string) => {
    if (!materialId) return;
    try {
      const response = await fetch(`/api/inventory/${materialId}/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete batch');
      }

      setMaterial(prev => prev ? {
        ...prev,
        batches: prev.batches.filter(batch => batch.id !== batchId)
      } : null);
      toast.success('Batch deleted successfully');
    } catch (err) {
      toast.error('Failed to delete batch');
      console.error(err);
    } finally {
      setShowBatchDeleteConfirm(null);
    }
  };

  const handleBatchSuccess = () => {
    fetchMaterial();
    setShowAddBatchDialog(false);
    setShowEditBatchDialog(null);
    setSelectedBatch(null);
  };

  const handleMaterialSuccess = () => {
    setShowEditDialog(false);
    fetchMaterial();
    toast.success('Material updated successfully');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!material) return <div>Material not found</div>;
  if (!materialId) return <div>Loading...</div>;

  type PopupAction = { label: string; onClick: (e: React.MouseEvent) => void; variant?: 'default' | 'outline' };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <BackToInventoryButton />
        </div>

        {/* Material Details Section */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Material Details</h2>
              {canEdit && (
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="group"
                        onClick={() => setShowEditDialog(true)}
                      >
                        <Pencil className="w-4 h-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Material</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="group border-red-600 text-red-600 hover:text-red-700 hover:border-red-700"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <X className="w-4 h-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Material</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-base font-medium">{material.name}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Size</label>
                <p className="text-base font-medium">{material.size}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Brand</label>
                <p className="text-base font-medium">{material.brand.name}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Material Type</label>
                <p className="text-base font-medium">{material.materialType.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Material Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Material</DialogTitle>
            </DialogHeader>
            <MaterialForm
              materialId={materialId}
              initialData={{
                name: material.name,
                size: material.size,
                brandId: material.brand.id,
                materialTypeId: material.materialType.id,
              }}
              brands={brands}
              materialTypes={materialTypes}
              onSuccess={handleMaterialSuccess}
              onCancel={() => setShowEditDialog(false)}
            />
          </DialogContent>
        </Dialog>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Batches</h2>
            {canEdit && (
              <Button onClick={() => setShowAddBatchDialog(true)} className="flex items-center gap-2">
                <CirclePlus className="w-5 h-5 mr-1" /> Add New Batch
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {material.batches.map((batch) => (
              <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Quantity</label>
                      <p className="text-base font-medium">{batch.quantity} / {batch.initialQuantity}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Vendor</label>
                      <p className="text-base font-medium">{batch.vendor.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Expiration Date</label>
                      <p className="text-base font-medium">{new Date(batch.expirationDate).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Storage Location</label>
                      <p className="text-base font-medium">{batch.storageLocation}</p>
                    </div>
                    <div className="space-y-1 flex flex-col justify-center">
                      <label className="text-sm font-medium text-gray-500">Purchase Type</label>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold 
                          ${batch.purchaseType === 'Advance' ? 'bg-orange-100 text-orange-700' : ''}
                          ${batch.purchaseType === 'Purchased' ? 'bg-green-100 text-green-700' : ''}
                        `}
                        style={{ minWidth: 70 }}
                      >
                        {batch.purchaseType}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Lot Number</label>
                      <p className="text-base font-medium">{batch.lotNumber || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Cost</label>
                      <p className="text-base font-medium">{batch.cost ? `₹${batch.cost}` : 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Added By</label>
                      <p className="text-base font-medium">{batch.addedBy.username}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Added Date</label>
                      <p className="text-base font-medium">{new Date(batch.stockAddedDate).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1 flex flex-col justify-center">
                      <label className="text-sm font-medium text-gray-500">Document</label>
                      {batch.documents.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {batch.documents.map((doc, index) => (
                            <Link
                              key={index}
                              href={`/documents/${doc.document.id}?referrer=inventory/${material.id}`}
                              target="_blank"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center font-medium text-xs"
                            >
                              {doc.document.documentNumber}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-base font-medium text-gray-400" style={{ minHeight: 28 }}>N/A</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-base font-medium">{new Date(batch.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-base font-medium">{new Date(batch.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1 col-span-full flex justify-end mt-3 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="group"
                            asChild
                          >
                            <span>
                              <ActionsPopup
                                actions={([
                                  batch.documents.length > 0 && {
                                    label: 'View Document Details',
                                    onClick: (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      router.push(`/documents/${batch.documents[0]?.document?.id}?referrer=inventory/${material.id}`);
                                    },
                                    variant: 'default' as const,
                                  },
                                  {
                                    label: 'View Usage Details',
                                    onClick: (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      router.push(`/usage?advanced=1&materialId=${material.id}&batchId=${batch.id}`);
                                    },
                                    variant: 'outline' as const,
                                  },
                                ].filter(Boolean) as PopupAction[])}
                              />
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>More Actions</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="group"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setShowEditBatchDialog(batch.id);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Batch</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="group border-red-600 text-red-600 hover:text-red-700 hover:border-red-700"
                            onClick={() => setShowBatchDeleteConfirm(batch.id)}
                          >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Batch</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dialogs */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete this material? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showBatchDeleteConfirm} onOpenChange={() => setShowBatchDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete this batch? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBatchDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => showBatchDeleteConfirm && handleBatchDelete(showBatchDeleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddBatchDialog} onOpenChange={setShowAddBatchDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add New Batch</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BatchForm
                materialId={materialId}
                vendors={vendors}
                documents={documents}
                onSuccess={handleBatchSuccess}
                onCancel={() => setShowAddBatchDialog(false)}
                mode="add"
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showEditBatchDialog} onOpenChange={() => setShowEditBatchDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit Batch</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden">
              {selectedBatch && (
                <BatchForm
                  materialId={materialId}
                  batchId={selectedBatch.id}
                  initialData={{
                    quantity: selectedBatch.quantity,
                    initialQuantity: selectedBatch.initialQuantity,
                    expirationDate: selectedBatch.expirationDate.slice(0, 10),
                    vendorId: selectedBatch.vendor.id,
                    documentIds: selectedBatch.documents.map(d => d.document.id),
                    storageLocation: selectedBatch.storageLocation,
                    purchaseType: selectedBatch.purchaseType,
                    lotNumber: selectedBatch.lotNumber || '',
                    cost: selectedBatch.cost ?? undefined,
                  }}
                  vendors={vendors}
                  documents={documents}
                  onSuccess={handleBatchSuccess}
                  onCancel={() => setShowEditBatchDialog(null)}
                  mode="edit"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
} 