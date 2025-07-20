import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logUpdate, logDelete } from '@/lib/data-logger';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Manage Users');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { username, email, password, role, permissions } = await request.json();

    // Validate required fields
    if (!username || !email) {
      return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
    }

    // Check if username or email already exists for other users
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
        NOT: {
          id,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });
    }

    // Get current user data for logging
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { permissions: true },
    });

    // Prepare update data
    const updateData: {
      username: string;
      email: string;
      role: string;
      password?: string;
    } = {
      username,
      email,
      role,
    };

    // Hash password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Get permission IDs
    const permissionIds = await prisma.permission.findMany({
      where: { name: { in: permissions } },
      select: { id: true },
    });

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        permissions: {
          set: permissionIds.map((p: { id: string }) => ({ id: p.id })),
        },
      },
      include: {
        permissions: true,
      },
    });

    // Log the update
    if (currentUser) {
      await logUpdate(
        'User',
        id,
        {
          username: currentUser.username,
          email: currentUser.email,
          role: currentUser.role,
          permissions: currentUser.permissions.map((p: { name: string }) => p.name),
        },
        {
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          permissions: updatedUser.permissions.map((p: { name: string }) => p.name),
        },
        session.user.id,
        `Updated user: ${username}`
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Manage Users');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    // Prevent deleting self
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Get user data before deletion for logging
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: { permissions: true },
    });

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    // Log the deletion
    if (userToDelete) {
      await logDelete(
        'User',
        id,
        {
          username: userToDelete.username,
          email: userToDelete.email,
          role: userToDelete.role,
          permissions: userToDelete.permissions.map((p: { name: string }) => p.name),
        },
        session.user.id,
        `Deleted user: ${userToDelete.username}`
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 