import type { IncomingHttpHeaders } from 'node:http'
import { PrismaClient } from '@prisma/client'

// Prisma singleton
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Contexto inicial que llega con cada request (solo los headers)
export interface InitialContext {
  headers: IncomingHttpHeaders
}

// Contexto enriquecido luego de pasar por el middleware de auth
export interface AuthContext extends InitialContext {
  user: {
    id: string
  }
}
