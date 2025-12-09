import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logUpdate, logDelete } from '@/lib/data-logger';
import { hasPermissionByName } from '@/lib/permissions';

// PUT /api/settings/physicians/[id]
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

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Settings') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, specialization, email, phone, department, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!specialization) {
      return NextResponse.json({ error: 'Specialization is required' }, { status: 400 });
    }

    // Get current physician for logging
    const currentPhysician = await prisma.physician.findUnique({
      where: { id },
    });

    const physician = await prisma.physician.update({
      where: { id },
      data: {
        name,
        specialization,
        email,
        phone,
        department,
        isActive,
      },
    });

    // Log the update
    if (currentPhysician) {
      await logUpdate(
        'Physician',
        id,
        {
          name: currentPhysician.name,
          specialization: currentPhysician.specialization,
          email: currentPhysician.email,
          phone: currentPhysician.phone,
          department: currentPhysician.department,
          isActive: currentPhysician.isActive,
        },
        {
          name: physician.name,
          specialization: physician.specialization,
          email: physician.email,
          phone: physician.phone,
          department: physician.department,
          isActive: physician.isActive,
        },
        session.user.id,
        `Updated physician: ${name}`
      );
    }

    return NextResponse.json(physician);
  } catch (error) {
    console.error('Error updating physician:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/settings/physicians/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Settings') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }

    // Get current physician for logging
    const currentPhysician = await prisma.physician.findUnique({
      where: { id },
    });

    const physician = await prisma.physician.update({
      where: { id },
      data: { isActive },
    });

    // Log the update
    if (currentPhysician) {
      await logUpdate(
        'Physician',
        id,
        {
          name: currentPhysician.name,
          specialization: currentPhysician.specialization,
          email: currentPhysician.email,
          phone: currentPhysician.phone,
          department: currentPhysician.department,
          isActive: currentPhysician.isActive,
        },
        {
          name: physician.name,
          specialization: physician.specialization,
          email: physician.email,
          phone: physician.phone,
          department: physician.department,
          isActive: physician.isActive,
        },
        session.user.id,
        `Updated physician status: ${currentPhysician.name} (${isActive ? 'Active' : 'Inactive'})`
      );
    }

    return NextResponse.json(physician);
  } catch (error) {
    console.error('Error updating physician status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/settings/physicians/[id]
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

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Settings') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Get physician before deletion for logging
    const physician = await prisma.physician.findUnique({
      where: { id },
    });

    if (!physician) {
      return NextResponse.json({ error: 'Physician not found' }, { status: 404 });
    }

    await prisma.physician.delete({
      where: { id },
    });

    // Log the deletion
    await logDelete(
      'Physician',
      id,
      {
        name: physician.name,
        specialization: physician.specialization,
        email: physician.email,
        phone: physician.phone,
        department: physician.department,
        isActive: physician.isActive,
      },
      session.user.id,
      `Deleted physician: ${physician.name}`
    );

    return NextResponse.json({ message: 'Physician deleted successfully' });
  } catch (error) {
    console.error('Error deleting physician:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 