import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { logCreate } from '@/lib/data-logger';

// GET /api/settings/material-types
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Manage Settings permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Manage Settings');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const materialTypes = await prisma.materialType.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(materialTypes);
  } catch (error) {
    console.error('Error fetching material types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/material-types
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Manage Settings permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Manage Settings');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const materialType = await prisma.materialType.create({
      data: {
        name,
        description,
      },
    });

    // Log the creation
    await logCreate(
      'MaterialType',
      materialType.id,
      {
        name: materialType.name,
        description: materialType.description,
      },
      session.user.id,
      `Created material type: ${name}`
    );

    return NextResponse.json(materialType);
  } catch (error) {
    console.error('Error creating material type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 