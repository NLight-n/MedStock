import { NextRequest, NextResponse } from 'next/server';
import { getFileStream } from '@/lib/storage';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    // Await params for Next.js dynamic API route
    const { path: filePathArr } = await params;
    const fileName = filePathArr.join('/');
    // Get content type
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Stream the file from MinIO
    const stream: NodeJS.ReadableStream = await getFileStream(fileName);
    return new NextResponse(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(fileName)}"`,
      },
    });
  } catch (err) {
    console.error('File serving error:', err);
    return new NextResponse('File not found or error streaming file', { status: 404 });
  }
} 