import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import BackToInventoryButton from './BackToInventoryButton'
import DeleteDocumentButton from './DeleteDocumentButton'
import ImagePreview from './ImagePreview'
import EditDocumentButton from './EditDocumentButton'
import BatchActionsPopup from './BatchActionsPopup'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        batches: {
          select: {
            id: true,
            lotNumber: true,
            material: { select: { id: true, name: true, brand: true } }
          }
        }
      }
    })

    if (!document) {
      console.error(`Document not found with id: ${id}`)
      return notFound()
    }

    // Get file extension for display
    const getFileExtension = (filePath: string) => {
      return filePath.split('.').pop()?.toUpperCase() || 'FILE';
    };

    // Determine if file is an image
    const isImage = (filePath: string) => {
      const extension = filePath.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '');
    };

    // Determine if file is a PDF
    const isPDF = (filePath: string) => {
      return filePath.toLowerCase().endsWith('.pdf');
    };

    // Determine if file is a DOC or DOCX
    const isDoc = (filePath: string) => {
      const ext = filePath.split('.').pop()?.toLowerCase();
      return ext === 'doc' || ext === 'docx';
    };

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-4">
          <BackToInventoryButton />
          <div className="flex gap-2">
            <EditDocumentButton 
              documentId={document.id}
              document={document}
            />
            <DeleteDocumentButton 
              documentId={document.id} 
              documentNumber={document.documentNumber}
              hasLinkedBatches={document.batches.length > 0}
            />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-4">Document Details</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Information */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Document Information</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="font-semibold">{document.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Document Number:</span>
                  <span className="font-semibold">{document.documentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Date:</span>
                  <span>{new Date(document.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Vendor:</span>
                  <span>{document.vendor || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">File Type:</span>
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                    {getFileExtension(document.filePath)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Created:</span>
                  <span>{new Date(document.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Last Updated:</span>
                  <span>{new Date(document.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Linked Batches */}
            <div className="bg-white dark:bg-gray-800 rounded shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Linked Batches</h2>
              {document.batches.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No batches linked to this document.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Lot Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Material</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Brand</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase sticky right-0 bg-white dark:bg-gray-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.batches.map((batch) => (
                        <BatchActionsPopup key={batch.id} batch={batch} actionCellClassName="sticky right-0 bg-white dark:bg-gray-800" />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Document Preview */}
          <div className="bg-white dark:bg-gray-800 rounded shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Document Preview</h2>
            <div className="flex justify-end mb-2">
              <a
                href={`/api/files/${document.filePath.replace(/^\/uploads\//, '').replace(/^\//, '')}`}
                download
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Download
              </a>
            </div>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              {isImage(document.filePath) ? (
                <ImagePreview
                  src={`/api/files/${document.filePath.replace(/^\/uploads\//, '').replace(/^\//, '')}`}
                  alt={`Document ${document.documentNumber}`}
                  filePath={document.filePath}
                />
              ) : isPDF(document.filePath) ? (
                <div>
                  <iframe
                    src={`/api/files/${document.filePath.replace(/^\/uploads\//, '').replace(/^\//, '')}`}
                    className="w-full h-96 border rounded-lg"
                    title={`PDF Document ${document.documentNumber}`}
                  />
                </div>
              ) : isDoc(document.filePath) ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg font-medium mb-2">{document.documentNumber}</p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {getFileExtension(document.filePath)} Document
                  </p>
                  <a
                    href={`/api/files/${document.filePath.replace(/^\/uploads\//, '').replace(/^\//, '')}`}
                    download
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg font-medium mb-2">{document.documentNumber}</p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {getFileExtension(document.filePath)} Document
                  </p>
                  <p className="text-sm text-gray-500">
                    File path: {document.filePath}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    This file type cannot be previewed directly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error fetching document:', error)
    return notFound()
  }
} 