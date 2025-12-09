import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logCreate, logUpdate } from '@/lib/data-logger';
import { hasPermissionByName } from '@/lib/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: materialId } = await params;

    const batches = await prisma.batch.findMany({
      where: { materialId },
      select: {
        id: true,
        lotNumber: true,
        purchaseType: true,
        expirationDate: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Edit Materials permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Edit Materials') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: _id } = await params;
    const body = await request.json();
    const {
      quantity,
      initialQuantity,
      expirationDate,
      vendorId,
      documentIds,
      storageLocation,
      purchaseType,
      lotNumber,
      cost
    } = body;

    const material = await prisma.material.findUnique({
      where: { id: _id },
      select: { name: true },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const batch = await prisma.batch.create({
      data: {
        quantity,
        initialQuantity,
        expirationDate: new Date(expirationDate),
        vendorId,
        storageLocation,
        purchaseType,
        lotNumber,
        cost,
        materialId: _id,
        addedById: session.user.id,
      },
      include: {
        vendor: true,
        addedBy: { select: { username: true, email: true } },
      },
    });

    // Create document relationships if documentIds are provided
    if (documentIds && documentIds.length > 0) {
      await prisma.batchDocument.createMany({
        data: documentIds.map((documentId: string) => ({
          batchId: batch.id,
          documentId: documentId
        }))
      });
    }

    // Fetch the batch with documents for response
    const batchWithDocuments = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: {
        vendor: true,
        documents: {
          include: {
            document: { select: { id: true, documentNumber: true } }
          }
        },
        addedBy: { select: { username: true, email: true } },
      },
    });

    // Log the creation
    await logCreate(
      'Batch',
      batch.id,
      {
        quantity: batch.quantity,
        initialQuantity: batch.initialQuantity,
        expirationDate: batch.expirationDate,
        vendorId: batch.vendorId,
        documentIds: documentIds || [],
        storageLocation: batch.storageLocation,
        purchaseType: batch.purchaseType,
        lotNumber: batch.lotNumber,
        cost: batch.cost,
        materialId: batch.materialId,
      },
      session.user.id,
      `Created batch for material: ${material.name} (Quantity: ${quantity})`
    );

    return NextResponse.json(batchWithDocuments);
  } catch (error) {
    console.error('Error creating batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Edit Materials permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Edit Materials') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: _id, batchId } = await params;
    const body = await request.json();
    const {
      quantity,
      initialQuantity,
      expirationDate,
      vendorId,
      documentIds,
      storageLocation,
      purchaseType,
      lotNumber,
      cost
    } = body;

    const material = await prisma.material.findUnique({
      where: { id: _id },
      select: { name: true },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Get current batch for logging
    const currentBatch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        documents: {
          include: {
            document: { select: { id: true } }
          }
        }
      }
    });

    // Delete existing document relationships
    await prisma.batchDocument.deleteMany({
      where: { batchId }
    });

    const batch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        quantity,
        initialQuantity,
        expirationDate: new Date(expirationDate),
        vendorId,
        storageLocation,
        purchaseType,
        lotNumber,
        cost,
        documents: {
          create: documentIds?.map((documentId: string) => ({
            document: {
              connect: { id: documentId }
            }
          })) || []
        }
      },
      include: {
        vendor: true,
        documents: {
          include: {
            document: { select: { id: true, documentNumber: true } }
          }
        },
        addedBy: { select: { username: true, email: true } },
      },
    });

    // Log the update
    if (currentBatch) {
      await logUpdate(
        'Batch',
        batchId,
        {
          quantity: currentBatch.quantity,
          initialQuantity: currentBatch.initialQuantity,
          expirationDate: currentBatch.expirationDate,
          vendorId: currentBatch.vendorId,
          documentIds: currentBatch.documents.map(d => d.document.id),
          storageLocation: currentBatch.storageLocation,
          purchaseType: currentBatch.purchaseType,
          lotNumber: currentBatch.lotNumber,
          cost: currentBatch.cost,
        },
        {
          quantity: batch.quantity,
          initialQuantity: batch.initialQuantity,
          expirationDate: batch.expirationDate,
          vendorId: batch.vendorId,
          documentIds: documentIds || [],
          storageLocation: batch.storageLocation,
          purchaseType: batch.purchaseType,
          lotNumber: batch.lotNumber,
          cost: batch.cost,
        },
        session.user.id,
        `Updated batch for material: ${material.name} (Quantity: ${quantity})`
      );
    }

    return NextResponse.json(batch);
  } catch (error) {
    console.error('Error updating batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 