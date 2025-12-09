import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logCreate } from '@/lib/data-logger';
import { hasPermissionByName } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Manage Users permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Users') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: {
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Manage Users permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Users') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { username, email, password, role, permissions } = await request.json();

    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get permission IDs
    const permissionIds = await prisma.permission.findMany({
      where: { name: { in: permissions } },
      select: { id: true },
    });

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        createdById: session.user.id,
        permissions: {
          connect: permissionIds.map((p: { id: string }) => ({ id: p.id })),
        },
      },
      include: {
        permissions: true,
      },
    });

    // Log the creation
    await logCreate(
      'User',
      newUser.id,
      {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        permissions: newUser.permissions.map((p: { name: string }) => p.name),
      },
      session.user.id,
      `Created new user: ${username}`
    );

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 