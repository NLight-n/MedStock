import { prisma } from './prisma';

export interface DataLogEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId: string;
  description: string;
}

export async function logDataChange(entry: DataLogEntry) {
  try {
    await prisma.dataLog.create({
      data: {
        action: entry.action,
        tableName: entry.tableName,
        recordId: entry.recordId,
        oldValues: entry.oldValues ? JSON.parse(JSON.stringify(entry.oldValues)) : null,
        newValues: entry.newValues ? JSON.parse(JSON.stringify(entry.newValues)) : null,
        userId: entry.userId,
        description: entry.description,
      },
    });
  } catch (error) {
    console.error('Failed to log data change:', error);
    // Don't throw error to prevent breaking the main operation
  }
}

// Helper functions for common operations
export async function logCreate(
  tableName: string,
  recordId: string,
  newValues: Record<string, unknown>,
  userId: string,
  description: string
) {
  await logDataChange({
    action: 'CREATE',
    tableName,
    recordId,
    newValues,
    userId,
    description,
  });
}

export async function logUpdate(
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  userId: string,
  description: string
) {
  await logDataChange({
    action: 'UPDATE',
    tableName,
    recordId,
    oldValues,
    newValues,
    userId,
    description,
  });
}

export async function logDelete(
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>,
  userId: string,
  description: string
) {
  await logDataChange({
    action: 'DELETE',
    tableName,
    recordId,
    oldValues,
    userId,
    description,
  });
} 