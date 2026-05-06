import { z } from "zod";
import { protectedProcedure } from "../middleware";
import { prisma } from "../context";
import { ORPCError } from "@orpc/server";

// Guardar calificación de un viaje completado
export const guardarCalificacion = protectedProcedure
  .input(
    z.object({
      viajeId: z.number(),
      estrellas: z.number().int().min(1).max(5),
      comentario: z.string().optional(),
    })
  )
  .handler(async ({ input, context }) => {
    try {
      // 1. Obtener el viaje y verificar que el usuario es pasajero aceptado
      const viaje = await prisma.viajes_publicados.findUnique({
        where: { id_viaje_pub: input.viajeId },
        include: {
          solicitudes: {
            where: {
              id_pasajero: context.user.id,
              estado_solicitud: "aceptada",
            },
          },
          conductor: {
            include: { usuario: true },
          },
          viajes_activos: true,
        },
      });

      if (!viaje) {
        throw new ORPCError("NOT_FOUND", { message: "Viaje no encontrado" });
      }

      // Verificar que el usuario es pasajero con solicitud aceptada en este viaje
      if (!viaje.solicitudes || viaje.solicitudes.length === 0) {
        throw new ORPCError("FORBIDDEN", {
          message: "No tienes una solicitud aceptada en este viaje",
        });
      }

      // Verificar que existe conductor y su información de usuario
      if (!viaje.conductor) {
        throw new ORPCError("NOT_FOUND", {
          message: "Información del conductor no encontrada",
        });
      }

      if (!viaje.conductor.usuario) {
        throw new ORPCError("NOT_FOUND", {
          message: "Datos del usuario conductor no encontrados",
        });
      }

      const conductorId = viaje.conductor.usuario.id_usuario;

      // Obtener el id_viaje_activo
      if (!viaje.viajes_activos || viaje.viajes_activos.length === 0) {
        throw new ORPCError("NOT_FOUND", {
          message: "Registro de viaje activo no encontrado",
        });
      }

      const viajeActivoId = viaje.viajes_activos[0].id_viaje_activo;

      // 2. Verificar si ya existe una calificación de este pasajero para este viaje
      const calificacionExistente = await prisma.calificaciones.findFirst({
        where: {
          id_viaje_activo: viajeActivoId,
          id_evaluador: context.user.id,
          id_evaluado: conductorId,
        },
      });

      if (calificacionExistente) {
        throw new ORPCError("CONFLICT", {
          message: "Ya has calificado este viaje",
        });
      }

      // 3. Crear la calificación
      const calificacion = await prisma.calificaciones.create({
        data: {
          id_viaje_activo: viajeActivoId,
          id_evaluador: context.user.id,
          id_evaluado: conductorId,
          estrellas: input.estrellas,
          comentario: input.comentario || null,
        },
      });

      // 4. Actualizar reputación promedio del conductor
      const todasLasCalificaciones = await prisma.calificaciones.findMany({
        where: { id_evaluado: conductorId },
      });

      const promedio =
        todasLasCalificaciones.reduce((sum, c) => sum + c.estrellas, 0) /
        todasLasCalificaciones.length;

      await prisma.usuarios.update({
        where: { id_usuario: conductorId },
        data: { reputacion_promedio: parseFloat(promedio.toFixed(2)) },
      });

      return {
        success: true,
        calificacion,
        nuevoPromedioReputacion: promedio,
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }
      console.error("Error guardando calificación:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Error al guardar la calificación",
      });
    }
  });

// Obtener calificaciones recibidas por un conductor
export const obtenerCalificacionesRecibidas = protectedProcedure
  .handler(async ({ context }) => {
    const calificaciones = await prisma.calificaciones.findMany({
      where: { id_evaluado: context.user.id },
      include: {
        evaluador: {
          select: {
            id_usuario: true,
            nombre: true,
            apellido_paterno: true,
            foto_perfil: true,
          },
        },
      },
      orderBy: { id_calificacion: "desc" },
    });

    return { success: true, calificaciones };
  });

// Obtener calificaciones dadas por un pasajero
export const obtenerMisCalificaciones = protectedProcedure
  .handler(async ({ context }) => {
    const calificaciones = await prisma.calificaciones.findMany({
      where: { id_evaluador: context.user.id },
      include: {
        evaluado: {
          select: {
            id_usuario: true,
            nombre: true,
            apellido_paterno: true,
            foto_perfil: true,
          },
        },
      },
      orderBy: { id_calificacion: "desc" },
    });

    return { success: true, calificaciones };
  });
