import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import formidable, { Fields, Files } from 'formidable';
import path from 'path';
import fs from 'fs';
import { uploadFile, deleteFile } from '@/lib/storage';
import { logCreate, logUpdate, logDelete } from '@/lib/data-logger';
import { Prisma } from '@prisma/client';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_FILE_TYPES = {
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      if (req.query.countOnly === '1') {
        const count = await prisma.document.count();
        return res.status(200).json({ count });
      }
      const { search, vendor, type, dateFrom, dateTo } = req.query;
      const where: Prisma.DocumentWhereInput = {};
      if (search) {
        where.documentNumber = { contains: String(search), mode: 'insensitive' };
      }
      if (vendor) {
        where.vendor = String(vendor);
      }
      if (type) {
        where.type = String(type);
      }
      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) where.date.gte = new Date(String(dateFrom));
        if (dateTo) where.date.lte = new Date(String(dateTo));
      }
      const documents = await prisma.document.findMany({
        select: {
          id: true,
          type: true,
          documentNumber: true,
          date: true,
          vendor: true,
          filePath: true,
          createdAt: true,
          updatedAt: true,
        },
        where,
        orderBy: { date: 'desc' },
      });
      return res.status(200).json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Permission check
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      });
      const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Documents');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Parse form data
      const form = formidable({ 
        multiples: false,
        maxFileSize: MAX_FILE_SIZE,
        filter: (part) => {
          if (!part.originalFilename) return false;
          const ext = path.extname(part.originalFilename).toLowerCase();
          return Object.keys(ALLOWED_FILE_TYPES).includes(ext);
        }
      });

      const formData = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
        form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });

      // DEBUG: Log received fields and files
      console.log('Received fields:', formData.fields);
      console.log('Received files:', formData.files);

      const { type, documentNumber, date, vendor } = formData.fields;
      const file = formData.files.file;

      // Validate required fields
      if (!type || !documentNumber || !date || !vendor) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate document number format
      const docNumberStr = String(documentNumber).trim();
      if (docNumberStr.length === 0) {
        return res.status(400).json({ error: 'Document number cannot be empty' });
      }

      // Check if document number already exists
      const existingDoc = await prisma.document.findUnique({
        where: { documentNumber: docNumberStr },
      });
      if (existingDoc) {
        return res.status(400).json({ error: 'Document number already exists' });
      }

      // Validate date
      const documentDate = new Date(String(date));
      if (isNaN(documentDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // File is optional
      let filePath: string = '';
      if (file) {
        const uploadedFile = Array.isArray(file) ? file[0] : file;
        if (uploadedFile) {
          // Validate file size
          const stats = await fs.promises.stat(uploadedFile.filepath);
          if (stats.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
          }

          // Validate file extension
          const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();
          if (!Object.keys(ALLOWED_FILE_TYPES).includes(ext)) {
            return res.status(400).json({ 
              error: `Invalid file type. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}` 
            });
          }

          // Generate safe filename
          const safeDocNum = docNumberStr.replace(/[^a-zA-Z0-9-_]/g, '_');
          const timestamp = Date.now();
          const filename = `${safeDocNum}_${timestamp}${ext}`;
          // Upload to MinIO
          await uploadFile(filename, fs.createReadStream(uploadedFile.filepath));
          filePath = filename;
        }
      }

      // Save document record
      const doc = await prisma.document.create({
        data: {
          type: String(type),
          documentNumber: docNumberStr,
          date: documentDate,
          vendor: vendor ? String(vendor).trim() : null,
          filePath: filePath,
        },
      });

      // Log the document creation
      await logCreate(
        'Document',
        doc.id,
        {
          type: doc.type,
          documentNumber: doc.documentNumber,
          date: doc.date,
          vendor: doc.vendor,
          filePath: doc.filePath,
        },
        session.user.id,
        `Uploaded document: ${doc.documentNumber} (${doc.type})`
      );

      return res.status(200).json({ 
        id: doc.id,
        message: 'Document uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      // Permission check
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      });
      const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Documents');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Parse form data
      const form = formidable({ 
        multiples: false,
        maxFileSize: MAX_FILE_SIZE,
        filter: (part) => {
          if (!part.originalFilename) return false;
          const ext = path.extname(part.originalFilename).toLowerCase();
          return Object.keys(ALLOWED_FILE_TYPES).includes(ext);
        }
      });

      const formData = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
        form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });

      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      // Find the document
      const document = await prisma.document.findUnique({ where: { id } });
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Prepare update data
      const { type, documentNumber, date, vendor } = formData.fields;
      const updateData: Record<string, unknown> = {};
      if (type) updateData.type = String(type);
      if (documentNumber) updateData.documentNumber = String(documentNumber).trim();
      if (date) updateData.date = new Date(String(date));
      if (vendor) updateData.vendor = String(vendor).trim();

      // Handle file update
      const file = formData.files.file;
      let newFilePath = document.filePath;
      if (file) {
        const uploadedFile = Array.isArray(file) ? file[0] : file;
        if (uploadedFile) {
          // Validate file size
          const stats = await fs.promises.stat(uploadedFile.filepath);
          if (stats.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
          }
          // Validate file extension
          const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();
          if (!Object.keys(ALLOWED_FILE_TYPES).includes(ext)) {
            return res.status(400).json({ error: `Invalid file type. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}` });
          }
          // Upload new file to MinIO
          const docNum = updateData.documentNumber || document.documentNumber || '';
          const safeDocNum = typeof docNum === 'string' ? docNum.replace(/[^a-zA-Z0-9-_]/g, '_') : '';
          const timestamp = Date.now();
          const filename = `${safeDocNum}_${timestamp}${ext}`;
          await uploadFile(filename, fs.createReadStream(uploadedFile.filepath));
          // Delete old file from MinIO if it exists
          if (document.filePath && document.filePath !== '') {
            try {
              await deleteFile(document.filePath);
            } catch {
              // Ignore error
            }
          }
          newFilePath = filename;
        }
      }
      updateData.filePath = newFilePath;

      // Save old values for logging
      const oldValues = { ...document };

      // Update document
      const updatedDoc = await prisma.document.update({
        where: { id },
        data: updateData,
      });

      // Log the update
      await logUpdate(
        'Document',
        updatedDoc.id,
        oldValues,
        updateData,
        session.user.id,
        `Updated document: ${updatedDoc.documentNumber} (${updatedDoc.type})`
      );

      return res.status(200).json({ id: updatedDoc.id, message: 'Document updated successfully' });
    } catch (error) {
      console.error('Error updating document:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Permission check
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      });
      const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Documents');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Document ID is required' });
      }
      // Find the document
      const document = await prisma.document.findUnique({
        where: { id },
        include: { batches: { select: { id: true } } },
      });
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      // Check if document is linked to any batches
      if (document.batches.length > 0) {
        return res.status(400).json({ error: 'Cannot delete document that is linked to batches. Please unlink from batches first.' });
      }
      // Delete the physical file
      if (document.filePath && document.filePath !== '') {
        try {
          await deleteFile(document.filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }
      // Log the deletion before removing the record
      await logDelete(
        'Document',
        document.id,
        document,
        session.user.id,
        `Deleted document: ${document.documentNumber} (${document.type})`
      );
      // Delete the database record
      await prisma.document.delete({ where: { id } });
      return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 