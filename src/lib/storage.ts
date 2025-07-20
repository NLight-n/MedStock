import { Readable } from 'stream';
import { Client as MinioClient } from 'minio';
import path from 'path';

// MinIO config
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
  bucket: process.env.MINIO_BUCKET || 'medstock',
};

const minioClient = new MinioClient({
  endPoint: minioConfig.endPoint,
  port: minioConfig.port,
  useSSL: minioConfig.useSSL,
  accessKey: minioConfig.accessKey,
  secretKey: minioConfig.secretKey,
});

export async function uploadFile(filePath: string, fileBuffer: Buffer | Readable, folder?: string): Promise<string> {
  let objectName = path.basename(filePath);
  if (folder) {
    objectName = `${folder.replace(/\/+$/, '')}/${objectName}`;
  }
  await minioClient.putObject(minioConfig.bucket, objectName, fileBuffer);
  return objectName;
}

export async function getFileStream(fileName: string): Promise<Readable> {
  return await minioClient.getObject(minioConfig.bucket, fileName);
}

export async function deleteFile(fileName: string): Promise<void> {
  await minioClient.removeObject(minioConfig.bucket, fileName);
}

// List all backup files in the 'backups/' folder in MinIO
export async function listBackupsInMinio(): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
  const objects: Array<{ name: string; size: number; lastModified: Date }> = [];
  const stream = minioClient.listObjectsV2(minioConfig.bucket, 'backups/', true);
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