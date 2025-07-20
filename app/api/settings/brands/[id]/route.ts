import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';

// PUT /api/settings/brands/[id]
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
    const { name, description, website, contactPerson, contactEmail, contactPhone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get current brand for logging
    const currentBrand = await prisma.brand.findUnique({
      where: { id },
    });

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name,
        description,
        website,
        contactPerson,
        contactEmail,
        contactPhone,
      },
    });

    // Log the update
    if (currentBrand) {
      await logUpdate(
        'Brand',
        id,
        {
          name: currentBrand.name,
          description: currentBrand.description,
          website: currentBrand.website,
          contactPerson: currentBrand.contactPerson,
          contactEmail: currentBrand.contactEmail,
          contactPhone: currentBrand.contactPhone,
        },
        {
          name: brand.name,
          description: brand.description,
          website: brand.website,
          contactPerson: brand.contactPerson,
          contactEmail: brand.contactEmail,
          contactPhone: brand.contactPhone,
        },
        session.user.id,
        `Updated brand: ${name}`
      );
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/settings/brands/[id]
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

    // Get brand before deletion for logging
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    await prisma.brand.delete({
      where: { id },
    });

    // Log the deletion
    await logDelete(
      'Brand',
      id,
      {
        name: brand.name,
        description: brand.description,
        website: brand.website,
        contactPerson: brand.contactPerson,
        contactEmail: brand.contactEmail,
        contactPhone: brand.contactPhone,
      },
      session.user.id,
      `Deleted brand: ${brand.name}`
    );

    return NextResponse.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 