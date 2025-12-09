import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';
import { hasPermissionByName } from '@/lib/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        brand: true,
        materialType: true,
        batches: {
          include: {
            vendor: true,
            documents: {
              include: {
                document: { select: { id: true, documentNumber: true } }
              }
            },
            addedBy: { select: { username: true, email: true } },
          },
          orderBy: { expirationDate: 'asc' },
        },
      },
    });

    if (!material) {
      return new NextResponse('Material not found', { status: 404 });
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error fetching material:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(
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

    const { id } = await params;
    const body = await request.json();
    const { name, size, brandId, materialTypeId } = body;

    const currentMaterial = await prisma.material.findUnique({
      where: { id },
    });

    const material = await prisma.material.update({
      where: { id },
      data: { name, size, brandId, materialTypeId },
      include: {
        brand: true,
        materialType: true,
        batches: {
          include: {
            vendor: true,
            documents: {
              include: {
                document: { select: { id: true, documentNumber: true } }
              }
            },
            addedBy: { select: { username: true, email: true } },
          },
          orderBy: { expirationDate: 'asc' },
        },
      },
    });

    if (currentMaterial) {
      await logUpdate(
        'Material',
        id,
        {
          name: currentMaterial.name,
          size: currentMaterial.size,
          brandId: currentMaterial.brandId,
          materialTypeId: currentMaterial.materialTypeId,
        },
        { name, size, brandId, materialTypeId },
        session.user.id,
        `Updated material: ${name}`
      );
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { id } = await params;

    const materialToDelete = await prisma.material.findUnique({
      where: { id },
    });

    if (!materialToDelete) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Delete all batches first (cascade delete)
    await prisma.batch.deleteMany({
      where: { materialId: id },
    });

    // Then delete the material
    await prisma.material.delete({
      where: { id },
    });

    await logDelete(
      'Material',
      id,
      {
        name: materialToDelete.name,
        size: materialToDelete.size,
        brandId: materialToDelete.brandId,
        materialTypeId: materialToDelete.materialTypeId,
      },
      session.user.id,
      `Deleted material: ${materialToDelete.name}`
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 