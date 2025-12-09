import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileStream } from '@/lib/storage';
import { hasPermissionByName } from '@/lib/permissions';

export async function GET(
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
    const hasPermission = user ? hasPermissionByName(user.permissions, 'Manage Settings') : false;
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    // Await params for Next.js dynamic API route
    const { id } = await context.params;
    const objectName = Array.isArray(id) ? id.join('/') : id;
    // Use objectName as the MinIO object name
    // Optionally, try to get a user-friendly filename
    const filename = objectName.split('/').pop() || 'backup.dump';
    const fileStream = await getFileStream(objectName);
    return new NextResponse(fileStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 