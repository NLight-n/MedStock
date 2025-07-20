import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function convertBigInt(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertBigInt);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertBigInt(v)])
    );
  } else if (typeof obj === 'bigint') {
    return Number(obj);
  }
  return obj;
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Recent Activity (last 10 data log entries)
    const recentActivity = await prisma.dataLog.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    });

    // 2. Low Stock Alerts (materials with total quantity < 5)
    const lowStockAlerts = await prisma.$queryRaw`
      SELECT 
        m.id,
        m.name as material_name,
        m.size,
        mt.name as material_type,
        br.name as brand_name,
        SUM(b.quantity) as total_quantity
      FROM "Material" m
      JOIN "MaterialType" mt ON m."materialTypeId" = mt.id
      JOIN "Brand" br ON m."brandId" = br.id
      LEFT JOIN "Batch" b ON m.id = b."materialId"
      GROUP BY m.id, m.name, m.size, mt.name, br.name
      HAVING SUM(b.quantity) < 5 AND SUM(b.quantity) > 0
      ORDER BY total_quantity ASC
      LIMIT 10
    `;

    // 3. Expiring Soon Alerts (batches expiring within 30 days)
    const expiringSoonAlertsRaw = await prisma.$queryRaw`
      SELECT 
        b.id,
        m.name as material_name,
        m.size,
        mt.name as material_type,
        br.name as brand_name,
        b.quantity,
        b."expirationDate",
        b."lotNumber",
        v.name as vendor_name
      FROM "Batch" b
      JOIN "Material" m ON b."materialId" = m.id
      JOIN "MaterialType" mt ON m."materialTypeId" = mt.id
      JOIN "Brand" br ON m."brandId" = br.id
      JOIN "Vendor" v ON b."vendorId" = v.id
      WHERE b.quantity > 0 
        AND b."expirationDate" <= NOW() + INTERVAL '30 days'
        AND b."expirationDate" > NOW()
      ORDER BY b."expirationDate" ASC
      LIMIT 10
    `;
    // Convert expirationDate to ISO string if it's a Date object
    const expiringSoonAlerts = (expiringSoonAlertsRaw as Array<{ expirationDate: Date | string }>).map((alert) => ({
      ...alert,
      expirationDate: alert.expirationDate instanceof Date
        ? alert.expirationDate.toISOString()
        : alert.expirationDate
    }));

    // 4. Summary Statistics
    const summaryStats = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "Material") as total_materials,
        (SELECT COUNT(*) FROM "Batch" WHERE quantity > 0) as active_batches,
        (SELECT COUNT(*) FROM "Vendor") as total_vendors,
        (SELECT COUNT(DISTINCT CAST("patientId" AS TEXT) || '|' || "procedureName" || '|' || TO_CHAR("procedureDate", 'YYYY-MM-DD')) FROM "UsageRecord" WHERE "procedureDate" >= NOW() - INTERVAL '30 days') as usage_last_30_days,
        (SELECT COUNT(*) FROM "Document") as total_documents,
        (SELECT COUNT(*) FROM "Batch" WHERE quantity < 5 AND quantity > 0) as low_stock_materials,
        (SELECT COUNT(*) FROM "Batch" WHERE "expirationDate" <= NOW() + INTERVAL '30 days' AND "expirationDate" > NOW() AND quantity > 0) as expiring_soon_count
    `;

    // 5. Inventory by Category (for chart)
    const inventoryByCategory = await prisma.$queryRaw`
      SELECT 
        mt.name as material_type,
        COUNT(DISTINCT m.id) as total_materials,
        SUM(b.quantity) as total_stock
      FROM "MaterialType" mt
      LEFT JOIN "Material" m ON mt.id = m."materialTypeId"
      LEFT JOIN "Batch" b ON m.id = b."materialId"
      GROUP BY mt.id, mt.name
      ORDER BY total_stock DESC
    `;

    // 7. Monthly Usage Trends (last 6 months)
    const monthlyUsageTrends = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM') as month,
        COUNT(DISTINCT CAST(ur."patientId" AS TEXT) || '|' || ur."procedureName" || '|' || TO_CHAR(ur."procedureDate", 'YYYY-MM-DD')) as procedure_count,
        SUM(ur.quantity) as total_quantity
      FROM "UsageRecord" ur
      WHERE ur."procedureDate" >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM')
      ORDER BY month DESC
    `;

    // Advance Materials Used (last 30 days)
    const advanceMaterialsUsed = await prisma.$queryRaw`
      SELECT 
        m.id,
        m.name as material_name,
        mt.name as material_type,
        br.name as brand_name,
        SUM(ur.quantity) as total_used
      FROM "UsageRecord" ur
      JOIN "Batch" b ON ur."batchId" = b.id
      JOIN "Material" m ON b."materialId" = m.id
      JOIN "MaterialType" mt ON m."materialTypeId" = mt.id
      JOIN "Brand" br ON m."brandId" = br.id
      WHERE b."purchaseType" = 'Advance'
        AND ur."procedureDate" >= NOW() - INTERVAL '30 days'
      GROUP BY m.id, m.name, mt.name, br.name
      HAVING SUM(ur.quantity) > 0
      ORDER BY total_used DESC
      LIMIT 10
    `;

    return NextResponse.json({
      recentActivity: convertBigInt(recentActivity),
      lowStockAlerts: convertBigInt(lowStockAlerts),
      expiringSoonAlerts: convertBigInt(expiringSoonAlerts),
      summaryStats: convertBigInt((summaryStats as Array<{
        total_materials: number
        active_batches: number
        total_vendors: number
        usage_last_30_days: number
        total_documents: number
        low_stock_materials: number
        expiring_soon_count: number
      }>)[0]) as {
        total_materials: number
        active_batches: number
        total_vendors: number
        usage_last_30_days: number
        total_documents: number
        low_stock_materials: number
        expiring_soon_count: number
      },
      inventoryByCategory: convertBigInt(inventoryByCategory),
      monthlyUsageTrends: convertBigInt(monthlyUsageTrends),
      advanceMaterialsUsed: convertBigInt(advanceMaterialsUsed),
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
} 