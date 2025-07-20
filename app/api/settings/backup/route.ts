import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logCreate } from '@/lib/data-logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { uploadFile } from '@/lib/storage';
import { getFileStream } from '@/lib/storage';
import formidable from 'formidable';
import { pipeline } from 'stream';
import { promisify as pify } from 'util';

const execAsync = promisify(exec);

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

    const backups = await prisma.backup.findMany({
      include: {
        createdBy: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(backups);
  } catch (error) {
    console.error('Error fetching backups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  const url = new URL(request.url || '', 'http://localhost');
  if (url.pathname.endsWith('/restore')) {
    // --- RESTORE LOGIC (as before) ---
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Check permission
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      });
      const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Manage Settings');
      if (!hasPermission) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      // Parse form or JSON
      let dumpPath = '';
      const hostBackupDir = path.join(process.cwd(), 'backups');
      if (request.headers.get('content-type')?.includes('multipart/form-data')) {
        // File upload
        const form = formidable({ multiples: false, uploadDir: hostBackupDir, keepExtensions: true });
        const formData = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
          form.parse(request as unknown as import('http').IncomingMessage, (err: unknown, fields: formidable.Fields, files: formidable.Files) => {
            if (err) reject(err);
            else resolve({ fields, files });
          });
        });
        const file = formData.files?.file;
        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        // @ts-expect-error: file may have either filepath or path depending on formidable version
        dumpPath = file.filepath || file.path;
        if (!dumpPath) return NextResponse.json({ error: 'No file path found' }, { status: 400 });
      } else {
        // JSON body with filename (from MinIO)
        const { filename } = await request.json();
        if (!filename) return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
        const localPath = `${hostBackupDir}/${filename.split('/').pop()}`;
        // Download from MinIO
        const minioStream = await getFileStream(filename);
        const writeStream = fs.createWriteStream(localPath);
        await pify(pipeline)(minioStream, writeStream);
        dumpPath = localPath;
      }
      // Run pg_restore directly in this container
      const password = process.env.PG_BACKUP_PASSWORD;
      if (!password) {
        return NextResponse.json({ error: 'PG_BACKUP_PASSWORD not set in environment' }, { status: 500 });
      }
      if (!dumpPath) {
        return NextResponse.json({ error: 'No dump path found' }, { status: 500 });
      }
      const containerDumpPath = `/backups/${(dumpPath ?? '').split('\\').pop()?.split('/').pop()}`;
      const pgRestoreCmd = [
        `PGPASSWORD=${password}`,
        'pg_restore',
        '-U', 'postgres',
        '-h', 'postgres',
        '-d', 'medstock',
        containerDumpPath
      ].join(' ');
      console.log('Executing pg_restore:', pgRestoreCmd);
      const { stdout: _stdout, stderr } = await execAsync(pgRestoreCmd);
      if (stderr && !stderr.includes('WARNING')) {
        console.error('pg_restore stderr:', stderr);
        return NextResponse.json({ error: 'Failed to restore: ' + stderr }, { status: 500 });
      }
      // Optionally delete the temp file
      if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error restoring backup:', error.stack || error.message);
        return NextResponse.json({ error: 'Failed to restore: ' + error.message }, { status: 500 });
      } else {
        console.error('Error restoring backup:', error);
        return NextResponse.json({ error: 'Failed to restore: Unknown error' }, { status: 500 });
      }
    }
  } else {
    // --- BACKUP CREATION LOGIC (restored) ---
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
      const { description } = await request.json();
      // Generate backup filename (use .dump extension for binary format)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medstock-backup-${timestamp}.dump`;
      // Host backup directory (should match Docker volume mount)
      const hostBackupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
      const filePath = path.join(hostBackupDir, filename);
      // Use dedicated env variable for backup password
      const password = process.env.PG_BACKUP_PASSWORD;
      if (!password) {
        return NextResponse.json({ error: 'PG_BACKUP_PASSWORD not set in environment' }, { status: 500 });
      }
      // Compose pg_dump command to run directly in this container
      const pgDumpCmd = [
        `PGPASSWORD=${password}`,
        'pg_dump',
        '-U', 'postgres',
        '-h', 'postgres',
        '-F', 'c',
        '-f', filePath,
        'medstock'
      ].join(' ');
      // Run pg_dump inside the web container
      console.log('Executing pg_dump:', pgDumpCmd);
      const { stdout: _stdout, stderr } = await execAsync(pgDumpCmd);
      if (stderr && !stderr.includes('WARNING')) {
        console.error('pg_dump stderr:', stderr);
        return NextResponse.json({ error: 'Failed to create backup: ' + stderr }, { status: 500 });
      }
      // Check if file was created and has content
      console.log('[Backup] Checking if file exists:', filePath);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Backup file was not created' }, { status: 500 });
      }
      console.log('[Backup] File exists. Getting stats...');
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return NextResponse.json({ error: 'Backup file is empty' }, { status: 500 });
      }
      console.log('[Backup] File size:', stats.size);
      const fileSize = stats.size;
      // Upload to MinIO with error handling
      let minioObjectName = '';
      try {
        console.log('[Backup] Reading file for MinIO upload...');
        const fileBuffer = fs.readFileSync(filePath);
        console.log('[Backup] Uploading to MinIO...');
        minioObjectName = await uploadFile(filename, fileBuffer, 'backups');
        console.log('[Backup] Upload to MinIO successful:', minioObjectName);
      } catch (err) {
        if (err instanceof Error) {
          console.error('[Backup] Error uploading to MinIO:', err.stack || err.message);
        } else {
          console.error('[Backup] Error uploading to MinIO:', err);
        }
        return NextResponse.json({ error: 'Backup created but failed to upload to MinIO: ' + (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
      }
      // Remove local file after upload
      try {
        console.log('[Backup] Deleting local backup file:', filePath);
        fs.unlinkSync(filePath);
        console.log('[Backup] Local backup file deleted.');
      } catch (err) {
        if (err instanceof Error) {
          console.error('[Backup] Error deleting local backup file:', err.stack || err.message);
        } else {
          console.error('[Backup] Error deleting local backup file:', err);
        }
      }
      // Save backup record to database (store MinIO object name as filename, no local filePath)
      console.log('[Backup] Saving backup record to database...');
      const backup = await prisma.backup.create({
        data: {
          filename: minioObjectName,
          filePath: '',
          fileSize,
          description,
          createdById: session.user.id,
        },
        include: {
          createdBy: {
            select: { username: true },
          },
        },
      });
      console.log('[Backup] Backup record saved:', backup.id);
      // Log the backup creation
      await logCreate(
        'Backup',
        backup.id,
        {
          filename: backup.filename,
          fileSize: backup.fileSize,
          description: backup.description,
        },
        session.user.id,
        `Created database backup: ${filename}`
      );
      console.log('[Backup] logCreate done. Returning response.');
      return NextResponse.json(backup);
    } catch (error) {
      if (error instanceof Error) {
        console.error('[Backup] Error creating backup:', error.stack || error.message);
        return NextResponse.json({ error: 'Failed to create backup: ' + error.message }, { status: 500 });
      } else {
        console.error('[Backup] Error creating backup:', error);
        return NextResponse.json({ error: 'Failed to create backup: Unknown error' }, { status: 500 });
      }
    }
  }
} 