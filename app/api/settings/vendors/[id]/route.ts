import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';

// PUT /api/settings/vendors/[id]
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
    const {
      name,
      description,
      address,
      city,
      state,
      country,
      postalCode,
      website,
      contactPerson,
      contactEmail,
      contactPhone,
      gstNumber,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get current vendor for logging
    const currentVendor = await prisma.vendor.findUnique({
      where: { id },
    });

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name,
        description,
        address,
        city,
        state,
        country,
        postalCode,
        website,
        contactPerson,
        contactEmail,
        contactPhone,
        gstNumber,
      },
    });

    // Log the update
    if (currentVendor) {
      await logUpdate(
        'Vendor',
        id,
        {
          name: currentVendor.name,
          description: currentVendor.description,
          address: currentVendor.address,
          city: currentVendor.city,
          state: currentVendor.state,
          country: currentVendor.country,
          postalCode: currentVendor.postalCode,
          website: currentVendor.website,
          contactPerson: currentVendor.contactPerson,
          contactEmail: currentVendor.contactEmail,
          contactPhone: currentVendor.contactPhone,
          gstNumber: currentVendor.gstNumber,
        },
        {
          name: vendor.name,
          description: vendor.description,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          country: vendor.country,
          postalCode: vendor.postalCode,
          website: vendor.website,
          contactPerson: vendor.contactPerson,
          contactEmail: vendor.contactEmail,
          contactPhone: vendor.contactPhone,
          gstNumber: vendor.gstNumber,
        },
        session.user.id,
        `Updated vendor: ${name}`
      );
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/settings/vendors/[id]
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

    // Get current vendor for logging
    const currentVendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!currentVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Check if vendor is used in any batches
    const batchesUsingVendor = await prisma.batch.findFirst({
      where: { vendorId: id },
    });

    if (batchesUsingVendor) {
      return NextResponse.json({ 
        error: 'Cannot delete vendor. It is being used by one or more batches.' 
      }, { status: 400 });
    }

    await prisma.vendor.delete({
      where: { id },
    });

    // Log the deletion
    await logDelete(
      'Vendor',
      id,
      {
        name: currentVendor.name,
        description: currentVendor.description,
        address: currentVendor.address,
        city: currentVendor.city,
        state: currentVendor.state,
        country: currentVendor.country,
        postalCode: currentVendor.postalCode,
        website: currentVendor.website,
        contactPerson: currentVendor.contactPerson,
        contactEmail: currentVendor.contactEmail,
        contactPhone: currentVendor.contactPhone,
        gstNumber: currentVendor.gstNumber,
      },
      session.user.id,
      `Deleted vendor: ${currentVendor.name}`
    );

    return NextResponse.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 