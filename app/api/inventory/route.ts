import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logCreate } from '@/lib/data-logger'

interface Batch {
  id: string
  quantity: number
  purchaseType: string
  vendorId: string
  vendor: {
    id: string
    name: string
  }
  document?: {
    id: string
    documentNumber: string
  } | null
  expirationDate: Date
}

interface Material {
  id: string
  name: string
  brand: {
    id: string
    name: string
  }
  materialType: {
    id: string
    name: string
  }
  batches: Batch[]
}

interface SearchCondition {
  name?: { contains: string; mode: 'insensitive' }
  brand?: { name: { contains: string; mode: 'insensitive' } }
  materialType?: { name: { contains: string; mode: 'insensitive' } }
  batches?: { some: { vendor: { name: { contains: string; mode: 'insensitive' } } } }
}

interface WhereClause {
  OR?: SearchCondition[]
  brandId?: string
  materialTypeId?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const materialType = searchParams.get('materialType') || ''
    const brand = searchParams.get('brand') || ''
    const vendor = searchParams.get('vendor') || ''
    const purchaseType = searchParams.get('purchaseType') || ''
    const stockStatus = searchParams.get('stockStatus') || ''

    // Build where clause for materials
    const where: WhereClause = {}

    // Add search conditions
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
        { materialType: { name: { contains: search, mode: 'insensitive' } } },
        { batches: { some: { vendor: { name: { contains: search, mode: 'insensitive' } } } } }
      ]
    }

    // Add brand filter
    if (brand) {
      where.brandId = brand
    }

    // Add material type filter
    if (materialType) {
      where.materialTypeId = materialType
    }

    // Get materials with their batches
    const materials = await prisma.material.findMany({
      where,
      include: {
        brand: true,
        materialType: true,
        batches: {
          include: {
            vendor: true,
            document: true,
          },
        },
      },
      orderBy: {
        name: 'asc'
      }
    }) as unknown as Material[]

    // Get total count before further filtering (for y value)
    const totalCount = materials.length;

    // Filter batches by vendor/purchaseType if needed
    const filteredMaterials = materials.map((mat) => {
      let batches = mat.batches
      if (vendor) {
        batches = batches.filter((b) => b.vendorId === vendor)
      }
      if (purchaseType) {
        batches = batches.filter((b) => b.purchaseType.toLowerCase() === purchaseType.toLowerCase())
      }
      return { ...mat, batches }
    }).filter((mat) => {
      // Only filter out materials with no batches if we're filtering by vendor or purchaseType
      if (vendor || purchaseType) {
        return mat.batches.length > 0
      }
      return true
    })

    // Filter by stock status if needed
    let finalMaterials = filteredMaterials
    if (stockStatus) {
      finalMaterials = finalMaterials.filter((mat) => {
        const totalQuantity = mat.batches.reduce((sum, batch) => sum + batch.quantity, 0)
        switch (stockStatus.toLowerCase()) {
          case 'in stock':
            return totalQuantity > 0
          case 'low stock':
            return totalQuantity > 0 && totalQuantity < 5
          case 'out of stock':
            return totalQuantity === 0
          case 'expiring soon':
            const thirtyDaysFromNow = new Date()
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
            return mat.batches.some(batch => {
              return batch.quantity > 0 && batch.expirationDate <= thirtyDaysFromNow
            })
          default:
            return true
        }
      })
    }

    return NextResponse.json({ materials: finalMaterials, totalCount })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has Edit Materials permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });

    const hasPermission = user?.permissions.some((p: { name: string }) => p.name === 'Edit Materials');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, size, brandId, materialTypeId } = body

    const material = await prisma.material.create({
      data: { name, size, brandId, materialTypeId },
      include: {
        brand: true,
        materialType: true,
        batches: {
          include: {
            vendor: true,
            document: { select: { id: true, documentNumber: true } },
            addedBy: { select: { username: true, email: true } },
          },
          orderBy: { expirationDate: 'asc' },
        },
      },
    })

    // Log the creation
    await logCreate(
      'Material',
      material.id,
      {
        name: material.name,
        size: material.size,
        brandId: material.brandId,
        materialTypeId: material.materialTypeId,
      },
      session.user.id,
      `Created material: ${name}`
    )

    return NextResponse.json(material)
  } catch (error) {
    console.error('Error creating material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 