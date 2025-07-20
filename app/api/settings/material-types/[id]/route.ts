import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';

// PUT /api/settings/material-types/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get current material type for logging
    const currentMaterialType = await prisma.materialType.findUnique({
      where: { id },
    });

    const materialType = await prisma.materialType.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    // Log the update
    if (currentMaterialType) {
      await logUpdate(
        'MaterialType',
        id,
        {
          name: currentMaterialType.name,
          description: currentMaterialType.description,
        },
        {
          name: materialType.name,
          description: materialType.description,
        },
        session.user.id,
        `Updated material type: ${name}`
      );
    }

    return NextResponse.json(materialType);
  } catch (error) {
    console.error('Error updating material type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/settings/material-types/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Get material type before deletion for logging
    const materialType = await prisma.materialType.findUnique({
      where: { id },
    });

    if (!materialType) {
      return NextResponse.json({ error: 'Material type not found' }, { status: 404 });
    }

    await prisma.materialType.delete({
      where: { id },
    });

    // Log the deletion
    await logDelete(
      'MaterialType',
      id,
      {
        name: materialType.name,
        description: materialType.description,
      },
      session.user.id,
      `Deleted material type: ${materialType.name}`
    );

    return NextResponse.json({ message: 'Material type deleted successfully' });
  } catch (error) {
    console.error('Error deleting material type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 