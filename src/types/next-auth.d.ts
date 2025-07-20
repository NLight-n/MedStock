import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      permissions?: string[];
    } & DefaultSession['user'];
  }

  interface User {
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    permissions: string[]
  }
} 