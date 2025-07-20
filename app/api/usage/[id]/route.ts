import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logUpdate, logDelete } from '@/lib/data-logger';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Record Usage permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true }
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Record Usage');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      patientName,
      patientId,
      procedureName,
      procedureDate,
      physician,
      batchId,
      quantity
    } = body;

    // Validate required fields
    if (!patientName || !patientId || !procedureName || !procedureDate || !physician || !batchId || !quantity) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Get the existing usage record
    const existingUsage = await prisma.usageRecord.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            material: {
              include: {
                brand: true,
                materialType: true
              }
            },
            vendor: true
          }
        }
      }
    });

    if (!existingUsage) {
      return NextResponse.json(
        { error: 'Usage record not found' },
        { status: 404 }
      );
    }

    // Get the new batch details
    const newBatch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        material: {
          include: {
            brand: true,
            materialType: true
          }
        },
        vendor: true
      }
    });

    if (!newBatch) {
      return NextResponse.json(
        { error: 'New batch not found' },
        { status: 404 }
      );
    }

    // Calculate quantity differences
    const oldQuantity = existingUsage.quantity;
    const newQuantity = quantity;

    // Update usage record and adjust batch quantities in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // If the batch has not changed, adjust quantity by the difference
      if (existingUsage.batchId === batchId) {
        const quantityDifference = newQuantity - oldQuantity;
        if (quantityDifference > 0) {
          // If new quantity is greater, check stock
          const batch = await tx.batch.findUnique({ where: { id: batchId } });
          if (!batch || batch.quantity < quantityDifference) {
            throw new Error('Insufficient stock available in the batch.');
          }
        }
        // Adjust the quantity by the difference
        await tx.batch.update({
          where: { id: batchId },
          data: { quantity: { decrement: quantityDifference } },
        });
      } else {
        // If batch has changed, restore to old and deduct from new
        // Restore quantity to old batch
        await tx.batch.update({
          where: { id: existingUsage.batchId },
          data: { quantity: { increment: oldQuantity } },
        });

        // Deduct quantity from new batch
        const newBatchForUpdate = await tx.batch.findUnique({ where: { id: batchId } });
        if (!newBatchForUpdate || newBatchForUpdate.quantity < newQuantity) {
            throw new Error('Insufficient stock available in the new batch.');
        }

        await tx.batch.update({
          where: { id: batchId },
          data: { quantity: { decrement: newQuantity } },
        });
      }

      // Update usage record
      const updatedUsage = await tx.usageRecord.update({
        where: { id },
        data: {
          patientName,
          patientId,
          procedureName,
          procedureDate: new Date(procedureDate),
          physician,
          batchId,
          quantity
        },
        include: {
          batch: {
            include: {
              material: {
                include: {
                  brand: true,
                  materialType: true
                }
              },
              vendor: true
            }
          },
          user: {
            select: {
              username: true
            }
          }
        }
      });

      return updatedUsage;
    });

    // Log the usage record update
    await logUpdate(
      'UsageRecord',
      result.id,
      {
        patientName: existingUsage.patientName,
        patientId: existingUsage.patientId,
        procedureName: existingUsage.procedureName,
        procedureDate: existingUsage.procedureDate,
        physician: existingUsage.physician,
        batchId: existingUsage.batchId,
        quantity: existingUsage.quantity,
        materialName: existingUsage.batch.material.name
      },
      {
        patientName,
        patientId,
        procedureName,
        procedureDate: new Date(procedureDate),
        physician,
        batchId,
        quantity,
        materialName: newBatch.material.name
      },
      session.user.id,
      `Usage record updated for patient ${patientName} (${patientId}) - ${newQuantity} units of ${newBatch.material.name} used in ${procedureName}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating usage record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update usage record';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Record Usage permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true }
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Record Usage');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get the usage record to be deleted
    const usageRecord = await prisma.usageRecord.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            material: {
              include: {
                brand: true,
                materialType: true
              }
            },
            vendor: true
          }
        }
      }
    });

    if (!usageRecord) {
      return NextResponse.json(
        { error: 'Usage record not found' },
        { status: 404 }
      );
    }

    // Delete usage record and restore batch quantity in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the usage record
      await tx.usageRecord.delete({
        where: { id }
      });

      // Restore quantity to the batch
      await tx.batch.update({
        where: { id: usageRecord.batchId },
        data: { quantity: { increment: usageRecord.quantity } }
      });
    });

    // Log the usage record deletion
    await logDelete(
      'UsageRecord',
      id,
      {
        patientName: usageRecord.patientName,
        patientId: usageRecord.patientId,
        procedureName: usageRecord.procedureName,
        procedureDate: usageRecord.procedureDate,
        physician: usageRecord.physician,
        batchId: usageRecord.batchId,
        quantity: usageRecord.quantity,
        materialName: usageRecord.batch.material.name
      },
      session.user.id,
      `Usage record deleted for patient ${usageRecord.patientName} (${usageRecord.patientId}) - ${usageRecord.quantity} units of ${usageRecord.batch.material.name} restored to inventory`
    );

    return NextResponse.json({ message: 'Usage record deleted successfully' });
  } catch (error) {
    console.error('Error deleting usage record:', error);
    return NextResponse.json(
      { error: 'Failed to delete usage record' },
      { status: 500 }
    );
  }
} 