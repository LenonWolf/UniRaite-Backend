import { os, ORPCError } from '@orpc/server'
import jwt from 'jsonwebtoken'
import type { InitialContext, AuthContext } from './context'

// Procedimiento base
export const baseProcedure = os.$context<InitialContext>()

// Middleware de autenticación
export const authMiddleware = baseProcedure.middleware(async ({ context, next }) => {
  const token = context.headers.authorization?.split(' ')[1]

  if (!token) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Token requerido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

    return next({
      context: {
        ...context,
        user: { id: decoded.id },
      } satisfies AuthContext,
    })
  } catch {
    throw new ORPCError('UNAUTHORIZED', { message: 'Token inválido' })
  }
})

// Procedimiento protegido
export const protectedProcedure = baseProcedure.use(authMiddleware)