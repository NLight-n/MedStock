import { Readable } from 'stream';
import { Client as MinioClient } from 'minio';
import path from 'path';

// MinIO config - parse endpoint to remove protocol if present
const parseMinioEndpoint = (endpoint: string): string => {
  // Remove http:// or https:// if present
  return endpoint.replace(/^https?:\/\//, '').split('/')[0];
};

const minioConfig = {
  endPoint: parseMinioEndpoint(process.env.MINIO_ENDPOINT || 'localhost'),
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
  bucket: process.env.MINIO_BUCKET || 'medstock',
};

let minioClient: MinioClient | null = null;
let bucketInitialized = false;

function getMinioClient() {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    });
  }
  return minioClient;
}

// Ensure the bucket exists, create it if it doesn't
export async function ensureBucketExists(): Promise<void> {
  if (bucketInitialized) {
    return;
  }
  
  const client = getMinioClient();
  const bucketName = minioConfig.bucket;
  
  try {
    // Check if bucket exists
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      // Create the bucket if it doesn't exist
      await client.makeBucket(bucketName, 'us-east-1'); // Default region
      console.log(`[MinIO] Created bucket: ${bucketName}`);
    } else {
      console.log(`[MinIO] Bucket already exists: ${bucketName}`);
    }
    bucketInitialized = true;
  } catch (error) {
    console.error(`[MinIO] Error ensuring bucket exists:`, error);
    // Don't throw - let operations fail naturally if bucket can't be created
    // This allows the app to start even if MinIO is temporarily unavailable
  }
}

export async function uploadFile(filePath: string, fileBuffer: Buffer | Readable, folder?: string): Promise<string> {
  await ensureBucketExists();
  let objectName = path.basename(filePath);
  if (folder) {
    objectName = `${folder.replace(/\/+$|\/+/g, '')}/${objectName}`;
  }
  await getMinioClient().putObject(minioConfig.bucket, objectName, fileBuffer);
  return objectName;
}

export async function getFileStream(fileName: string): Promise<Readable> {
  await ensureBucketExists();
  return await getMinioClient().getObject(minioConfig.bucket, fileName);
}

export async function deleteFile(fileName: string): Promise<void> {
  await ensureBucketExists();
  await getMinioClient().removeObject(minioConfig.bucket, fileName);
}

// List all backup files in the 'backups/' folder in MinIO
export async function listBackupsInMinio(): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
  await ensureBucketExists();
  const objects: Array<{ name: string; size: number; lastModified: Date }> = [];
  const stream = getMinioClient().listObjectsV2(minioConfig.bucket, 'backups/', true);
  return new Promise((resolve, reject) => {
    stream.on('data', obj => {
      if (obj.name) {
        objects.push({ name: obj.name, size: obj.size, lastModified: obj.lastModified });
      }
    });
    stream.on('end', () => resolve(objects));
    stream.on('error', err => reject(err));
  });
} 