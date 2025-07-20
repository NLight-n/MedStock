import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { logDelete } from '@/lib/data-logger';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string[] }> }
) {
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
    // Await params for Next.js dynamic API route
    const { id } = await context.params;
    const objectName = Array.isArray(id) ? id.join('/') : id;
    // Try to get backup record for logging
    let oldBackup = null;
    try {
      oldBackup = await prisma.backup.findUnique({ where: { id: objectName } });
    } catch {}
    // Try to delete from MinIO (objectName is the object name)
    try {
      await deleteFile(objectName);
    } catch {
      // Continue, as file may not exist in MinIO
    }
    // Try to delete DB record if it exists (objectName may be a MinIO object name or DB id)
    try {
      await prisma.backup.delete({ where: { id: objectName } });
    } catch {
      // Ignore if not found
    }
    // Log the backup deletion
    await logDelete(
      'Backup',
      objectName,
      oldBackup ? {
        filename: oldBackup.filename,
        fileSize: oldBackup.fileSize,
        description: oldBackup.description,
        createdAt: oldBackup.createdAt,
        createdById: oldBackup.createdById,
      } : { filename: objectName },
      session.user.id,
      `Deleted database backup: ${objectName}`
    );
    return NextResponse.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 