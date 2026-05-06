import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { protectedProcedure } from '../middleware'
import { prisma } from '../context'

// Obtener todas las notificaciones del usuario
export const obtenerTodas = protectedProcedure
  .handler(async ({ context }) => {
    const notificaciones = await prisma.notificaciones.findMany({
      where: { id_usuario: context.user.id },
      orderBy: { fecha_creacion: 'desc' },
    });
    return { success: true, notificaciones };
  });

// Marcar una notificación como leída
export const marcarLeida = protectedProcedure
  .input(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    const notificacion = await prisma.notificaciones.findUnique({
      where: { id_notificacion: input.id },
    });

    if (!notificacion || notificacion.id_usuario !== context.user.id) {
      throw new ORPCError('NOT_FOUND', { message: 'Notificación no encontrada' });
    }

    await prisma.notificaciones.update({
      where: { id_notificacion: input.id },
      data: { leido: true },
    });

    return { success: true };
  });

// Marcar todas las notificaciones como leídas
export const marcarTodasLeidas = protectedProcedure
  .handler(async ({ context }) => {
    await prisma.notificaciones.updateMany({
      where: { id_usuario: context.user.id, leido: false },
      data: { leido: true },
    });
    return { success: true };
  });

// Eliminar una notificación
export const eliminar = protectedProcedure
  .input(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    const notificacion = await prisma.notificaciones.findUnique({
      where: { id_notificacion: input.id },
    });

    if (!notificacion || notificacion.id_usuario !== context.user.id) {
      throw new ORPCError('NOT_FOUND', { message: 'Notificación no encontrada' });
    }

    await prisma.notificaciones.delete({
      where: { id_notificacion: input.id },
    });

    return { success: true };
  });

// Crear notificación (para usar desde otros endpoints)
export const crearNotificacion = async (
  usuarioId: string,
  titulo: string,
  cuerpo: string,
  tipo: string
) => {
  await prisma.notificaciones.create({
    data: {
      id_usuario: usuarioId,
      titulo,
      cuerpo_mensaje: cuerpo,
      tipo_notif: tipo,
      leido: false,
      fecha_creacion: new Date(),
    },
  });
};