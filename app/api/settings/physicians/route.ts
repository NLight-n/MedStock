import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logCreate } from '@/lib/data-logger';

// GET /api/settings/physicians
export async function GET() {
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

    const physicians = await prisma.physician.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(physicians);
  } catch (error) {
    console.error('Error fetching physicians:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/physicians
export async function POST(request: Request) {
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
    const { name, specialization, email, phone, department, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!specialization) {
      return NextResponse.json({ error: 'Specialization is required' }, { status: 400 });
    }

    const physician = await prisma.physician.create({
      data: {
        name,
        specialization,
        email,
        phone,
        department,
        isActive: isActive ?? true,
      },
    });

    // Log the creation
    await logCreate(
      'Physician',
      physician.id,
      {
        name: physician.name,
        specialization: physician.specialization,
        email: physician.email,
        phone: physician.phone,
        department: physician.department,
        isActive: physician.isActive,
      },
      session.user.id,
      `Created physician: ${name}`
    );

    return NextResponse.json(physician);
  } catch (error) {
    console.error('Error creating physician:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 