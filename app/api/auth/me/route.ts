import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const formatPermissionName = (name: string) => {
  if (!name) return name
  const cleaned = name.replace(/_/g, ' ').toLowerCase()
  return cleaned
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get user with permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const formattedPermissions = user.permissions.map((p: { name: string }) => ({
      ...p,
      name: formatPermissionName(p.name),
    }))

    return NextResponse.json({
      user: {
        ...session.user,
        permissions: formattedPermissions,
      },
    })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 