import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get material types
    const materialTypes = await prisma.materialType.findMany({
      orderBy: { name: 'asc' }
    });

    // Get materials with their types
    const materials = await prisma.material.findMany({
      include: {
        materialType: true,
        brand: true
      },
      orderBy: { name: 'asc' }
    });

    // Get vendors
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: 'asc' }
    });

    // Get physicians from usage records
    const physicians = await prisma.usageRecord.findMany({
      select: { physician: true },
      distinct: ['physician'],
      orderBy: { physician: 'asc' }
    });

    return NextResponse.json({
      materialTypes,
      materials,
      vendors,
      physicians: physicians.map(p => p.physician)
    });

  } catch (error) {
    console.error('Error fetching analytics filters:', error);
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
  }
} 