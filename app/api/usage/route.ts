import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logCreate } from '@/lib/data-logger';
import { hasPermissionByName } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const physician = searchParams.get('physician');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const materialType = searchParams.get('materialType');
  const advancedMaterialId = searchParams.get('advancedMaterialId');
  const advancedBatchId = searchParams.get('advancedBatchId');
  const isYesterday = searchParams.get('isYesterday') === 'true';

  const where: Prisma.UsageRecordWhereInput = {};

  if (search) {
    where.OR = [
      { patientName: { contains: search, mode: 'insensitive' } },
      { patientId: { contains: search, mode: 'insensitive' } },
      { procedureName: { contains: search, mode: 'insensitive' } },
      { batch: { material: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  if (physician) {
    where.physician = physician;
  }

  if (dateFrom && dateTo) {
    // If it's the yesterday case, don't add extra day to avoid including today
    const shouldAddDay = !isYesterday;
    where.procedureDate = {
      gte: new Date(dateFrom),
      lte: shouldAddDay ? new Date(new Date(dateTo).getTime() + 86400000) : new Date(dateTo),
    };
  }

  if (materialType) {
    where.batch = {
        material: {
            materialTypeId: materialType,
        }
    };
  }
  
  if (advancedBatchId) {
    where.batchId = advancedBatchId;
  } else if (advancedMaterialId) {
    where.batch = {
      material: {
        id: advancedMaterialId,
      },
    };
  }

  try {
    const usageRecords = await prisma.usageRecord.findMany({
      where,
      include: {
        user: { select: { username: true } },
        batch: {
          include: {
            material: { include: { brand: true, materialType: true } },
            vendor: true,
          },
        },
      },
      orderBy: {
        procedureDate: 'desc',
      },
    });
    return NextResponse.json(usageRecords);
  } catch (error) {
    console.error('Error fetching usage records:', error);
    return NextResponse.json({ error: 'Failed to fetch usage records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Record Usage') : false;
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

    // Check if batch exists and has sufficient quantity
    const batch = await prisma.batch.findUnique({
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

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (batch.quantity < quantity) {
      return NextResponse.json(
        { error: 'Insufficient stock available' },
        { status: 400 }
      );
    }

    // Create usage record and update batch quantity in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create usage record
      const usageRecord = await tx.usageRecord.create({
        data: {
          patientName,
          patientId,
          procedureName,
          procedureDate: new Date(procedureDate),
          physician,
          userId: session.user.id,
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

      // Update batch quantity
      await tx.batch.update({
        where: { id: batchId },
        data: { quantity: { decrement: quantity } }
      });

      // Log the usage record creation
      await logCreate(
        'UsageRecord',
        usageRecord.id,
        {
          patientName,
          patientId,
          procedureName,
          procedureDate: new Date(procedureDate),
          physician,
          batchId,
          quantity,
          materialName: batch.material.name,
          batchVendor: batch.vendor?.name || 'No vendor'
        },
        session.user.id,
        `Usage recorded for patient ${patientName} (${patientId}) - ${quantity} units of ${batch.material.name} used in ${procedureName}`
      );

      return usageRecord;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating usage record:', error);
    return NextResponse.json(
      { error: 'Failed to create usage record' },
      { status: 500 }
    );
  }
} 