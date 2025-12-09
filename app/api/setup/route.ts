import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { username, email, password, confirmPassword } = await request.json()

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    // Check if any users exist
    const existingUser = await prisma.user.findFirst()
    if (existingUser) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create admin user with all permissions
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        permissions: {
          create: [
            { name: 'View Only', description: 'View all modules' },
            { name: 'Edit Materials', description: 'Add/edit inventory items and batches' },
            { name: 'Record Usage', description: 'Record materials used during procedures' },
            { name: 'Edit Documents', description: 'Upload, edit, delete document images and metadata' },
            { name: 'Manage Settings', description: 'Access to manage master data and settings' },
            { name: 'Manage Users', description: 'Manage users and permissions' }
          ]
        }
      },
      include: {
        permissions: true
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions.map((p: { name: string }) => p.name)
      }
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    )
  }
} 