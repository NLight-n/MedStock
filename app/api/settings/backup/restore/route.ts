import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileStream } from '@/lib/storage';
// import formidable from 'formidable'; // Removed unused import
import { pipeline } from 'stream';
import { promisify as pify } from 'util';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
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
    const hostBackupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      // File upload using request.formData()
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(hostBackupDir, file.name);
      fs.writeFileSync(filePath, buffer);
      dumpPath = filePath;
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
    // Run pg_restore in Docker
    const password = process.env.PG_BACKUP_PASSWORD;
    if (!password) {
      return NextResponse.json({ error: 'PG_BACKUP_PASSWORD not set in environment' }, { status: 500 });
    }
    // Terminate all connections to the medstock database
    const terminateCmd = [
      'docker',
      'exec',
      '-e', `PGPASSWORD=${password}`,
      'medstock-pg-backup',
      'psql',
      '-U', 'postgres',
      '-h', 'postgres',
      '-d', 'postgres',
      '-c',
      '"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \'medstock\' AND pid <> pg_backend_pid();"'
    ].join(' ');
    try {
      console.log('[Restore] Terminating connections to medstock:', terminateCmd);
      const { stdout: termOut, stderr: termErr } = await (await import('util')).promisify(require('child_process').exec)(terminateCmd);
      if (termErr && !termErr.includes('WARNING')) {
        console.error('[Restore] Terminate connections stderr:', termErr);
        return NextResponse.json({ error: 'Failed to terminate connections: ' + termErr }, { status: 500 });
      }
      console.log('[Restore] Terminate connections output:', termOut);
    } catch (err) {
      if (err instanceof Error) {
        console.error('[Restore] Error terminating connections:', err.stack || err.message);
        return NextResponse.json({ error: 'Failed to terminate connections: ' + err.message }, { status: 500 });
      } else {
        console.error('[Restore] Error terminating connections:', err);
        return NextResponse.json({ error: 'Failed to terminate connections: Unknown error' }, { status: 500 });
      }
    }
    // Drop and recreate the database before restore
    const dropCmd = [
      'docker',
      'exec',
      '-e', `PGPASSWORD=${password}`,
      'medstock-pg-backup',
      'psql',
      '-U', 'postgres',
      '-h', 'postgres',
      '-d', 'postgres',
      '-c', '"DROP DATABASE IF EXISTS medstock;"'
    ].join(' ');
    const createCmd = [
      'docker',
      'exec',
      '-e', `PGPASSWORD=${password}`,
      'medstock-pg-backup',
      'psql',
      '-U', 'postgres',
      '-h', 'postgres',
      '-d', 'postgres',
      '-c', '"CREATE DATABASE medstock;"'
    ].join(' ');
    try {
      console.log('[Restore] Dropping medstock database:', dropCmd);
      const { stdout: dropOut, stderr: dropErr } = await (await import('util')).promisify(require('child_process').exec)(dropCmd);
      if (dropErr && !dropErr.includes('WARNING')) {
        console.error('[Restore] Drop DB stderr:', dropErr);
        return NextResponse.json({ error: 'Failed to drop database: ' + dropErr }, { status: 500 });
      }
      console.log('[Restore] Drop DB output:', dropOut);
      console.log('[Restore] Creating medstock database:', createCmd);
      const { stdout: createOut, stderr: createErr } = await (await import('util')).promisify(require('child_process').exec)(createCmd);
      if (createErr && !createErr.includes('WARNING')) {
        console.error('[Restore] Create DB stderr:', createErr);
        return NextResponse.json({ error: 'Failed to create database: ' + createErr }, { status: 500 });
      }
      console.log('[Restore] Create DB output:', createOut);
    } catch (err) {
      if (err instanceof Error) {
        console.error('[Restore] Error dropping/creating database:', err.stack || err.message);
        return NextResponse.json({ error: 'Failed to drop/create database: ' + err.message }, { status: 500 });
      } else {
        console.error('[Restore] Error dropping/creating database:', err);
        return NextResponse.json({ error: 'Failed to drop/create database: Unknown error' }, { status: 500 });
      }
    }
    const containerDumpPath = `/backups/${dumpPath.split('\\').pop()?.split('/').pop() || 'backup.sql'}`;
    const dockerRestoreCmd = [
      'docker',
      'exec',
      '-e', `PGPASSWORD=${password}`,
      'medstock-pg-backup',
      'pg_restore',
      '-U', 'postgres',
      '-h', 'postgres',
      '-d', 'medstock',
      containerDumpPath
    ].join(' ');
    console.log('[Restore] Executing Docker pg_restore:', dockerRestoreCmd);
    const { stdout: _stdout, stderr } = await (await import('util')).promisify(require('child_process').exec)(dockerRestoreCmd);
    if (typeof stderr === 'string' && !stderr.includes('WARNING')) {
      console.error('[Restore] pg_restore stderr:', stderr);
      return NextResponse.json({ error: 'Failed to restore: ' + stderr }, { status: 500 });
    }
    // Optionally delete the temp file
    if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
    const response = NextResponse.json({ success: true });
    // Wait 1 second to ensure all async work is complete, then exit for Docker restart
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Restore successful. Restarting server...');
      process.exit(0);
    })();
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Restore] Error restoring backup:', error.stack || error.message);
      return NextResponse.json({ error: 'Failed to restore: ' + error.message }, { status: 500 });
    } else {
      console.error('[Restore] Error restoring backup:', error);
      return NextResponse.json({ error: 'Failed to restore: Unknown error' }, { status: 500 });
    }
  }
} 