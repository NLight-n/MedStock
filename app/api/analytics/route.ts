import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const materialTypeId = searchParams.get('materialTypeId');
  const materialId = searchParams.get('materialId');
  const vendorId = searchParams.get('vendorId');

  try {
    // Use UTC for month calculation to ensure current month is always included
    const now = new Date();
    const monthsArr: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() - i;
      const d = new Date(Date.UTC(year, month, 1));
      monthsArr.push(d.toISOString().slice(0, 7));
    }

    // Build date filter conditions
    let dateFromCondition = "ur.\"procedureDate\" >= '2020-01-01'::date";
    // Set dateToCondition to include current month (robust to timezones)
    const lastDayCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    let dateToCondition = `ur."procedureDate" <= '${lastDayCurrentMonth.toISOString().replace('T', ' ').slice(0, 19)}'`;
    
    if (dateFrom) {
      dateFromCondition = `ur."procedureDate" >= '${dateFrom}'::date`;
    }
    if (dateTo) {
      const adjustedDateTo = new Date(dateTo);
      adjustedDateTo.setDate(adjustedDateTo.getDate() + 1);
      dateToCondition = `ur."procedureDate" <= '${adjustedDateTo.toISOString().split('T')[0]}'::date`;
    }

    // 1. Monthly Usage Trends by Material Type
    const monthlyUsageByType = await prisma.$queryRawUnsafe(`
      SELECT 
        mt.name as material_type,
        TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM') as month,
        SUM(ur.quantity) as total_quantity
      FROM "UsageRecord" ur
      JOIN "Batch" b ON ur."batchId" = b.id
      JOIN "Material" m ON b."materialId" = m.id
      JOIN "MaterialType" mt ON m."materialTypeId" = mt.id
      WHERE ${dateFromCondition}
        AND ${dateToCondition}
        ${materialTypeId ? `AND mt.id = '${materialTypeId}'` : ''}
      GROUP BY mt.name, TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM')
      ORDER BY month DESC, total_quantity DESC
    `);

    // 2. Monthly Usage for Specific Material
    const monthlyUsageByMaterial = materialId ? await prisma.$queryRaw`
      SELECT 
        m.name as material_name,
        DATE_TRUNC('month', ur."procedureDate") as month,
        SUM(ur.quantity) as total_quantity
      FROM "UsageRecord" ur
      JOIN "Batch" b ON ur."batchId" = b.id
      JOIN "Material" m ON b."materialId" = m.id
      WHERE m.id = ${materialId}
        AND ${Prisma.raw(dateFromCondition)}
        AND ${Prisma.raw(dateToCondition)}
      GROUP BY m.name, DATE_TRUNC('month', ur."procedureDate")
      ORDER BY month DESC
    ` : [];

    // 3. Vendor-based Analysis
    const vendorAnalysis = await prisma.$queryRaw`
      SELECT 
        v.name as vendor_name,
        COUNT(DISTINCT b.id) as total_batches,
        SUM(b.quantity) as current_stock,
        SUM(b."initialQuantity") as total_purchased,
        COUNT(DISTINCT m.id) as materials_supplied,
        SUM(CASE WHEN b."purchaseType" = 'Advance' THEN b.quantity ELSE 0 END) as advance_stock,
        SUM(CASE WHEN b."purchaseType" = 'Purchased' THEN b.quantity ELSE 0 END) as purchased_stock
      FROM "Vendor" v
      LEFT JOIN "Batch" b ON v.id = b."vendorId"
      LEFT JOIN "Material" m ON b."materialId" = m.id
      WHERE b.id IS NOT NULL
        ${vendorId ? Prisma.sql`AND v.id = ${vendorId}` : Prisma.sql``}
      GROUP BY v.id, v.name
      ORDER BY total_purchased DESC
    `;

    // 4. Advance Materials by Category
    const advanceMaterialsByCategory = await prisma.$queryRaw`
      SELECT 
        mt.name as material_type,
        COUNT(DISTINCT m.id) as total_materials,
        COUNT(DISTINCT CASE WHEN b."purchaseType" = 'Advance' THEN m.id END) as advance_materials,
        SUM(CASE WHEN b."purchaseType" = 'Advance' THEN b.quantity ELSE 0 END) as advance_quantity,
        SUM(CASE WHEN b."purchaseType" = 'Purchased' THEN b.quantity ELSE 0 END) as purchased_quantity
      FROM "MaterialType" mt
      LEFT JOIN "Material" m ON mt.id = m."materialTypeId"
      LEFT JOIN "Batch" b ON m.id = b."materialId"
      WHERE b.id IS NOT NULL
      GROUP BY mt.id, mt.name
      ORDER BY advance_quantity DESC
    `;

    // 5. Top Used Materials
    const topUsedMaterials = await prisma.$queryRaw`
      SELECT 
        m.name as material_name,
        mt.name as material_type,
        br.name as brand_name,
        SUM(ur.quantity) as total_used,
        COUNT(ur.id) as usage_count
      FROM "UsageRecord" ur
      JOIN "Batch" b ON ur."batchId" = b.id
      JOIN "Material" m ON b."materialId" = m.id
      JOIN "MaterialType" mt ON m."materialTypeId" = mt.id
      JOIN "Brand" br ON m."brandId" = br.id
      WHERE ${Prisma.raw(dateFromCondition)}
        AND ${Prisma.raw(dateToCondition)}
        ${materialTypeId ? Prisma.sql`AND mt.id = ${materialTypeId}` : Prisma.sql``}
      GROUP BY m.id, m.name, mt.name, br.name
      ORDER BY total_used DESC
      LIMIT 10
    `;

    // 6. Current Stock Status (enhanced SQL)
    const currentStockStatus = await prisma.$queryRawUnsafe(`
      SELECT 
        mt.name as material_type,
        COUNT(DISTINCT m.id) as total_materials,
        COUNT(DISTINCT CASE WHEN COALESCE(b.quantity, 0) > 0 THEN m.id END) as in_stock_materials,
        COUNT(DISTINCT CASE WHEN COALESCE(b.quantity, 0) = 0 THEN m.id END) as out_of_stock_materials,
        COUNT(DISTINCT CASE WHEN COALESCE(b.quantity, 0) < 5 AND COALESCE(b.quantity, 0) > 0 THEN m.id END) as low_stock_materials,
        SUM(b.quantity) as total_stock
      FROM "MaterialType" mt
      JOIN "Material" m ON mt.id = m."materialTypeId"
      LEFT JOIN "Batch" b ON m.id = b."materialId"
      GROUP BY mt.name
      ORDER BY mt.name
    `);
    // Fix all fields to always be a number
    const currentStockStatusFixed = (convertBigInt(currentStockStatus) as Array<{
      material_type: string;
      total_materials: number;
      in_stock_materials: number;
      out_of_stock_materials: number;
      low_stock_materials: number;
      total_stock: number;
      [key: string]: unknown;
    }>).map((item) => ({
      ...item,
      total_materials: Number(item.total_materials) || 0,
      in_stock_materials: Number(item.in_stock_materials) || 0,
      out_of_stock_materials: Number(item.out_of_stock_materials) || 0,
      low_stock_materials: Number(item.low_stock_materials) || 0,
      total_stock: Number(item.total_stock) || 0
    }));

    // 7. Expiry Analysis
    const expiryAnalysis = await prisma.$queryRaw`
      SELECT 
        mt.name as material_type,
        COUNT(DISTINCT CASE WHEN b."expirationDate" <= NOW() + INTERVAL '30 days' THEN m.id END) as expiring_soon,
        COUNT(DISTINCT CASE WHEN b."expirationDate" <= NOW() + INTERVAL '7 days' THEN m.id END) as expiring_this_week,
        COUNT(DISTINCT CASE WHEN b."expirationDate" <= NOW() THEN m.id END) as expired
      FROM "MaterialType" mt
      LEFT JOIN "Material" m ON mt.id = m."materialTypeId"
      LEFT JOIN "Batch" b ON m.id = b."materialId"
      WHERE b.quantity > 0
      GROUP BY mt.id, mt.name
      ORDER BY expiring_soon DESC
    `;

    // 8. Usage by Physician (fetch all physicians, count unique procedures for each)
    // Get all physicians
    const allPhysicians = await prisma.physician.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    });
    // Get all usage records in the period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        procedureDate: {
          gte: new Date(monthsArr[0] + '-01'),
          lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
        }
      },
      select: {
        physician: true,
        patientId: true,
        procedureName: true,
        procedureDate: true,
        quantity: true
      }
    });
    // Build a map: physician -> Set of unique procedure keys
    const physicianMap = new Map();
    const quantityMap = new Map();
    for (const rec of usageRecords) {
      const key = `${rec.patientId}|${rec.procedureName}|${rec.procedureDate.toISOString().slice(0, 10)}`;
      if (!physicianMap.has(rec.physician)) {
        physicianMap.set(rec.physician, new Set());
        quantityMap.set(rec.physician, 0);
      }
      physicianMap.get(rec.physician).add(key);
      quantityMap.set(rec.physician, quantityMap.get(rec.physician) + (rec.quantity || 0));
    }
    // Build the final array for all physicians
    const usageByPhysician = allPhysicians.map(p => ({
      physician: p.name,
      procedure_count: physicianMap.get(p.name) ? physicianMap.get(p.name).size : 0,
      total_quantity: quantityMap.get(p.name) || 0
    })).sort((a, b) => b.total_quantity - a.total_quantity);

    // 9. Procedures Per Month
    // Use $queryRawUnsafe and cast month to text for robust month extraction
    const proceduresPerMonth = await prisma.$queryRawUnsafe(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM') as month,
        COUNT(DISTINCT CAST(ur."patientId" AS TEXT) || '|' || ur."procedureName" || '|' || TO_CHAR(ur."procedureDate", 'YYYY-MM-DD')) as procedure_count
      FROM "UsageRecord" ur
      WHERE ${dateFromCondition}
        AND ${dateToCondition}
      GROUP BY TO_CHAR(DATE_TRUNC('month', ur."procedureDate"), 'YYYY-MM')
      ORDER BY month DESC
    `);

    const rawProceduresPerMonth = (proceduresPerMonth as Array<{ month: string; procedure_count: number }>).map((row) => ({
      ...row,
      month: row.month, // already 'YYYY-MM'
      procedure_count: Number(row.procedure_count)
    }));
    // Build a map for quick lookup
    const monthMap = new Map(rawProceduresPerMonth.map(row => [row.month, row.procedure_count]));
    // Build the final array for the last 12 months
    const proceduresPerMonthFinal = monthsArr.map(month => ({
      month,
      procedure_count: monthMap.get(month) || 0
    }));

    // 1. Monthly Usage Trends by Material Type (post-process to fill all months)
    const rawMonthlyUsageByType = convertBigInt(monthlyUsageByType) as { material_type: string, month: Date, total_quantity: number }[];
    // Build a set of all material types
    const allMaterialTypes = Array.from(new Set(rawMonthlyUsageByType.map(row => row.material_type)));
    // Build a map: material_type -> { month: quantity }
    const typeMonthMap = new Map<string, Map<string, number>>();
    for (const row of rawMonthlyUsageByType) {
      let monthStr = '';
      if (row.month instanceof Date && !isNaN(row.month.getTime())) {
        monthStr = row.month.toISOString().slice(0, 7);
      } else if (typeof row.month === 'string') {
        const d = new Date(row.month);
        if (!isNaN(d.getTime())) {
          monthStr = d.toISOString().slice(0, 7);
        }
      }
      if (!typeMonthMap.has(row.material_type)) {
        typeMonthMap.set(row.material_type, new Map());
      }
      typeMonthMap.get(row.material_type)!.set(monthStr, row.total_quantity);
    }
    // For each material type, build an array of 12 months, filling zeroes
    const monthlyUsageByTypeFinal = allMaterialTypes.map((type: string) => ({
      material_type: type,
      data: monthsArr.map((month: string) => ({ month, total_quantity: typeMonthMap.get(type)?.get(month) || 0 }))
    }));

    return NextResponse.json({
      monthlyUsageByType: monthlyUsageByTypeFinal,
      monthlyUsageByMaterial: convertBigInt(monthlyUsageByMaterial),
      vendorAnalysis: convertBigInt(vendorAnalysis),
      advanceMaterialsByCategory: convertBigInt(advanceMaterialsByCategory),
      topUsedMaterials: convertBigInt(topUsedMaterials),
      currentStockStatus: currentStockStatusFixed,
      expiryAnalysis: convertBigInt(expiryAnalysis),
      usageByPhysician,
      proceduresPerMonth: proceduresPerMonthFinal
    });

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
} 