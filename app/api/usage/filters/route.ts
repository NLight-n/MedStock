import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [physicians, materialTypes, materials] = await Promise.all([
      prisma.physician.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.materialType.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.material.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, size: true },
      }),
    ]);

    return NextResponse.json({
      physicians,
      materialTypes,
      materials,
    });
  } catch (error) {
    console.error('Error fetching usage filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
} 