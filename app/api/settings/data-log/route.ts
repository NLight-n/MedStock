import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermissionByName } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    if (searchParams.get('distinct') === 'tableName') {
      const tableNames = await prisma.dataLog.findMany({
        select: { tableName: true },
        distinct: ['tableName'],
        orderBy: { tableName: 'asc' },
      });
      return NextResponse.json(tableNames.map(t => t.tableName));
    }

    const action = searchParams.get('action');
    const tableName = searchParams.get('tableName');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const userFilter = searchParams.get('user');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.DataLogWhereInput = {};
    if (action) where.action = action;
    if (tableName) where.tableName = tableName;
    if (dateFrom || dateTo) {
      const timestampFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) timestampFilter.gte = new Date(dateFrom);
      if (dateTo) timestampFilter.lte = new Date(dateTo + 'T23:59:59.999Z');
      where.timestamp = timestampFilter;
    }
    if (userFilter) {
      where.user = {
        username: {
          contains: userFilter,
          mode: 'insensitive',
        },
      };
    }

    const [logs, total] = await Promise.all([
      prisma.dataLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.dataLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error('Failed to fetch data logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 