'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface DeleteDocumentButtonProps {
  documentId: string;
  documentNumber: string;
  hasLinkedBatches: boolean;
}

export default function DeleteDocumentButton({ 
  documentId, 
  documentNumber, 
  hasLinkedBatches 
}: DeleteDocumentButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
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
        } catch (error) {
          console.error('Error checking permissions:', error);
        }
      }
    };

    checkPermission();
  }, [session]);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('Document deleted successfully');
        router.push('/documents');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('An error occurred while deleting the document');
    } finally {
      setLoading(false);
      setShowDialog(false);
    }
  };

  if (!hasPermission) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        disabled={loading || hasLinkedBatches}
        variant="destructive"
        className="ml-auto"
      >
        {loading ? 'Deleting...' : 'Delete Document'}
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {hasLinkedBatches ? (
              <div className="text-red-600">
                Cannot delete document that is linked to batches. Please unlink from batches first.
              </div>
            ) : (
              <div>
                Are you sure you want to delete document <b>{documentNumber}</b>?<br />
                <span className="text-sm text-gray-500">This action cannot be undone.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading || hasLinkedBatches}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 