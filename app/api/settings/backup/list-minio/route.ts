import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermissionByName } from '@/lib/permissions';
import { listBackupsInMinio } from '@/lib/storage';

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
    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Settings') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    const backups = await listBackupsInMinio();
    return NextResponse.json(backups);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backup] Error listing MinIO backups:', error);
    return NextResponse.json({ error: 'Failed to list MinIO backups: ' + errorMessage }, { status: 500 });
  }
} 