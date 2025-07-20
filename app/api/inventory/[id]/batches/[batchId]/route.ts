import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Materials');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: materialId, batchId } = await params;
    const body = await request.json();
    const {
      quantity,
      initialQuantity,
      expirationDate,
      vendorId,
      documentId,
      storageLocation,
      purchaseType,
      lotNumber,
      cost
    } = body;

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { name: true },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }
    
    const currentBatch = await prisma.batch.findUnique({
        where: { id: batchId },
    });

    const batch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        quantity,
        initialQuantity,
        expirationDate: new Date(expirationDate),
        vendorId,
        documentId,
        storageLocation,
        purchaseType,
        lotNumber,
        cost,
      },
      include: {
        vendor: true,
        document: { select: { id: true, documentNumber: true } },
        addedBy: { select: { username: true, email: true } },
      },
    });

    if (currentBatch) {
        await logUpdate(
            'Batch',
            batchId,
            {
                quantity: currentBatch.quantity,
                initialQuantity: currentBatch.initialQuantity,
                expirationDate: currentBatch.expirationDate,
                vendorId: currentBatch.vendorId,
                documentId: currentBatch.documentId,
                storageLocation: currentBatch.storageLocation,
                purchaseType: currentBatch.purchaseType,
                lotNumber: currentBatch.lotNumber,
                cost: currentBatch.cost,
            },
            {
                quantity,
                initialQuantity,
                expirationDate,
                vendorId,
                documentId,
                storageLocation,
                purchaseType,
                lotNumber,
                cost,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Materials');
    if (!hasPermission) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: materialId, batchId } = await params;

    const material = await prisma.material.findUnique({
        where: { id: materialId },
        select: { name: true },
    });

    if (!material) {
        return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const batchToDelete = await prisma.batch.findUnique({
        where: { id: batchId },
    });

    if (!batchToDelete) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    await prisma.batch.delete({
      where: { id: batchId },
    });

    await logDelete(
        'Batch',
        batchId,
        {
            quantity: batchToDelete.quantity,
            initialQuantity: batchToDelete.initialQuantity,
            expirationDate: batchToDelete.expirationDate,
            vendorId: batchToDelete.vendorId,
            documentId: batchToDelete.documentId,
            storageLocation: batchToDelete.storageLocation,
            purchaseType: batchToDelete.purchaseType,
            lotNumber: batchToDelete.lotNumber,
            cost: batchToDelete.cost,
        },
        session.user.id,
        `Deleted batch for material: ${material.name}`
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 