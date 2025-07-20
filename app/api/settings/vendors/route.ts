import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logCreate } from '@/lib/data-logger';

// GET /api/settings/vendors
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

    const vendors = await prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/vendors
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

    const vendor = await prisma.vendor.create({
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

    // Log the creation
    await logCreate(
      'Vendor',
      vendor.id,
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
      `Created new vendor: ${name}`
    );

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 