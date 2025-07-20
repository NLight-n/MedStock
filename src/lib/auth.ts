import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from './prisma'
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { PrismaAdapter } from '@next-auth/prisma-adapter'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
)

export interface SessionUser {
  userId: string
  username: string
  role: string
  permissions: string[]
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Invalid credentials')
        }
        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          include: { permissions: true },
        })
        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }
        const isPasswordValid = await compare(credentials.password, user.password)
        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions.map((p: { name: string }) => p.name),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        type UserWithPermissions = typeof user & { permissions?: string[]; username?: string; role?: string };
        const u = user as UserWithPermissions;
        token.id = u.id;
        token.username = typeof u.username === 'string' ? u.username : '';
        token.role = typeof u.role === 'string' ? u.role : '';
        token.permissions = Array.isArray(u.permissions) ? u.permissions : [];
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          username: token.username,
          role: token.role,
          permissions: token.permissions,
        },
      }
    },
  },
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionUser
  } catch (error) {
    console.error('Session error:', error)
    return null
  }
}

export async function getUser() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        permissions: true
      }
    })

    if (!user) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions.map((p: { name: string }) => p.name)
    }
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession()
  return session?.permissions.includes(permission) ?? false
}

export async function requirePermission(permission: string): Promise<void> {
  const hasRequiredPermission = await hasPermission(permission)
  if (!hasRequiredPermission) {
    throw new Error('Permission denied')
  }
} 