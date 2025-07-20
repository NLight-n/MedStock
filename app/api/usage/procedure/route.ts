import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientName = searchParams.get('patientName');
  const patientId = searchParams.get('patientId');
  const procedureName = searchParams.get('procedureName');
  const procedureDate = searchParams.get('procedureDate');

  if (!patientName || !patientId || !procedureName || !procedureDate) {
    return NextResponse.json({ error: 'Missing required procedure parameters' }, { status: 400 });
  }

  const startDate = new Date(procedureDate);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(procedureDate);
  endDate.setUTCHours(23, 59, 59, 999);

  const where: Prisma.UsageRecordWhereInput = {
    patientName,
    patientId,
    procedureName,
    procedureDate: {
      gte: startDate,
      lte: endDate,
    },
  };

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
        createdAt: 'asc',
      },
    });
    
    if (usageRecords.length === 0) {
        return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    }

    return NextResponse.json(usageRecords);
  } catch (error) {
    console.error('Error fetching procedure records:', error);
    return NextResponse.json({ error: 'Failed to fetch procedure records' }, { status: 500 });
  }
} 