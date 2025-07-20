import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [materialTypes, brands, vendors] = await Promise.all([
      prisma.materialType.findMany({ orderBy: { name: 'asc' } }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } }),
      prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    ])
    const purchaseTypes = ['Advance', 'Purchased']
    return NextResponse.json({
      materialTypes,
      brands,
      vendors,
      purchaseTypes,
      stockStatuses: ['In Stock', 'Low Stock', 'Out of Stock']
    })
  } catch (_error) {
    console.error('Error fetching filters:', _error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 