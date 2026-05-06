import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { baseProcedure, protectedProcedure } from '../middleware'
import { prisma } from '../context'
import { io } from '../../server'

// Función auxiliar para crear notificaciones
const crearNotificacion = async (
  usuarioId: string,
  titulo: string,
  cuerpo: string,
  tipo: string
) => {
  try {
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
  } catch (error) {
    console.error("Error al crear notificación:", error);
  }
};



function parseFechaHora(fecha: string, hora: string): Date {
  const meses: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  }

  

  const ahora = new Date()
  let dia = ahora.getDate()
  let mes = ahora.getMonth()
  let año = ahora.getFullYear()

  if (fecha.includes('Hoy')) {
    // valores ya asignados arriba
  } else if (fecha.includes('Mañana')) {
    const manana = new Date()
    manana.setDate(ahora.getDate() + 1)
    dia = manana.getDate()
    mes = manana.getMonth()
    año = manana.getFullYear()
  } else {
    const partes = fecha.trim().split(' ')
    if (partes.length >= 2) {
      dia = parseInt(partes[0])
      const nombreMes = partes[1].toLowerCase()
      if (meses[nombreMes] !== undefined) mes = meses[nombreMes]
    }
  }

  let horas = 0
  let minutos = 0
  const horaMatch = hora.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (horaMatch) {
    horas = parseInt(horaMatch[1])
    minutos = parseInt(horaMatch[2])
    const ampm = horaMatch[3].toUpperCase()
    if (ampm === 'PM' && horas !== 12) horas += 12
    if (ampm === 'AM' && horas === 12) horas = 0
  }

  return new Date(año, mes, dia, horas, minutos)
}

export const listarViajes = baseProcedure.handler(async () => {
  const viajes = await prisma.viajes_publicados.findMany({
    where: {
      asientos_disponibles: { gt: 0 },
      // ELIMINADO: fecha_hora_salida: { gt: new Date() },
    },
    include: {
      conductor: {
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              apellido_paterno: true,
              foto_perfil: true,
              reputacion_promedio: true,
              viajes_completados: true,
            },
          },
        },
      },
    },
    orderBy: { fecha_hora_salida: 'asc' },
  })

  const viajesConDatos = viajes.map((viaje: any) => ({
    ...viaje,
    asientos_totales: viaje.conductor.capacidad_pasajeros,
    conductor: {
      ...viaje.conductor,
      usuario: {
        ...viaje.conductor.usuario,
        reputacion_promedio: viaje.conductor.usuario.reputacion_promedio || 0,
        total_viajes: viaje.conductor.usuario.viajes_completados || 0,
      },
    },
  }))

  return { success: true, viajes: viajesConDatos }
})

export const publicarViaje = protectedProcedure
  .input(
    z.object({
      origen_texto: z.string().min(1),
      destino_texto: z.string().min(1),

      latitud_origen: z.number(),
      longitud_origen: z.number(),
      latitud_destino: z.number(),
      longitud_destino: z.number(),
      
      fecha: z.string().min(1),
      hora: z.string().min(1),
      asientos: z.number().int().min(1),
      precio: z.number().positive(),
    })
  )
  .handler(async ({ input, context }) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { id_usuario: context.user.id },
    })

    if (!usuario) {
      throw new ORPCError('NOT_FOUND', { message: 'Usuario no encontrado' })
    }

    if (!usuario.licencia_de_conducir) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Debes ser conductor registrado para publicar viajes',
      })
    }

    const conductor = await prisma.conductores.findUnique({
      where: { id_licencia: usuario.licencia_de_conducir },
    })

    if (!conductor) {
      throw new ORPCError('NOT_FOUND', { message: 'Datos de conductor no encontrados' })
    }

    const fechaHoraSalida = parseFechaHora(input.fecha, input.hora)

    const nuevoViaje = await prisma.viajes_publicados.create({
      data: {
        id_licencia_conductor: conductor.id_licencia,
        origen_texto: input.origen_texto,
        destino_texto: input.destino_texto,
        latitud_origen: input.latitud_origen,
        longitud_origen: input.longitud_origen,
        latitud_destino: input.latitud_destino,
        longitud_destino: input.longitud_destino,
        fecha_hora_salida: fechaHoraSalida,
        asientos_disponibles: input.asientos,
        costo_estimado: input.precio,
        es_recurrente: false,
      },
    })

    // Emitir evento WebSocket a todos los usuarios conectados
    if (io) {
      io.emit('nuevo_viaje', {
        viaje: nuevoViaje,
        mensaje: `Nuevo viaje disponible: ${nuevoViaje.origen_texto} → ${nuevoViaje.destino_texto}`
      })
      
      io.emit('nueva_notificacion', {
        usuarioId: null,
        titulo: "Nuevo viaje disponible",
        cuerpo: `Nuevo viaje: ${nuevoViaje.origen_texto} → ${nuevoViaje.destino_texto}`,
        tipo: "viaje"
      })
      
      console.log('📢 Eventos nuevo_viaje y nueva_notificacion emitidos')
    }

    return {
      success: true,
      message: 'Viaje publicado exitosamente',
      viaje: nuevoViaje,
    }
  })

// GET /api/viajes/conductor/activos
export const obtenerViajesActivos = protectedProcedure
  .handler(async ({ context }) => {
    const viajes = await prisma.viajes_publicados.findMany({
      where: {
        conductor: {
          usuario: { id_usuario: context.user.id }
        },
        viajes_activos: {
          none: {
            estado_trayecto: 'finalizado'
          }
        }
      },
      include: {
        conductor: {
          include: {
            usuario: {
              select: {
                id_usuario: true,
                nombre: true,
                apellido_paterno: true,
                foto_perfil: true,
              }
            }
          }
        },
        solicitudes: {
          where: { estado_solicitud: 'aceptada' },
          include: {
            pasajero: {
              select: {
                id_usuario: true,
                nombre: true,
                apellido_paterno: true,
                foto_perfil: true,
              }
            }
          }
        },
        viajes_activos: {
          where: { estado_trayecto: 'en_curso' }
        },
      },
      orderBy: { fecha_hora_salida: 'asc' }
    })

    if (viajes.length > 0) {
      console.log("Viaje [0] listo para enviar:", JSON.stringify(viajes[0], null, 2));
    } else {
      console.log("No se encontraron viajes para este conductor.");
    }

    return { success: true, viajes }
  })

// GET /api/viajes/conductor/historial
export const obtenerHistorialConductor = protectedProcedure
  .handler(async ({ context }) => {
    const viajes = await prisma.viajes_publicados.findMany({
      where: {
        conductor: {
          usuario: { id_usuario: context.user.id }
        },
        OR: [
          { fecha_hora_salida: { lt: new Date() } },
          {
            viajes_activos: {
              some: {
                estado_trayecto: 'finalizado'
              }
            }
          }
        ]
      },
      include: {
        conductor: {
          include: {
            usuario: {
              select: {
                id_usuario: true,
                nombre: true,
                apellido_paterno: true,
                foto_perfil: true,
                reputacion_promedio: true,
                viajes_completados: true,
              }
            }
          }
        }
      },
      orderBy: { fecha_hora_salida: 'desc' },
      take: 20
    })

    return { success: true, viajes }
  })

// GET /api/viajes/pasajero/historial
export const obtenerHistorialPasajero = protectedProcedure
  .handler(async ({ context }) => {
    const solicitudes = await prisma.solicitudes_viaje.findMany({
      where: {
        id_pasajero: context.user.id,
        estado_solicitud: 'aceptada',
        OR: [
          { viaje: { fecha_hora_salida: { lt: new Date() } } },
          {
            viaje: {
              viajes_activos: {
                some: {
                  estado_trayecto: 'finalizado'
                }
              }
            }
          }
        ]
      },
      include: {
        viaje: {
          include: {
            conductor: {
              include: {
                usuario: {
                  select: {
                    id_usuario: true,
                    nombre: true,
                    apellido_paterno: true,
                    foto_perfil: true,
                    reputacion_promedio: true,
                    viajes_completados: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        viaje: {
          fecha_hora_salida: 'desc'
        }
      },
      take: 20
    })

    const viajes = solicitudes.map(s => s.viaje)
    return { success: true, viajes }
  })

// GET viaje específico por ID — incluye viajes con 0 asientos (para pasajeros con solicitud)
export const obtenerViajePorId = protectedProcedure
  .input(z.object({ viajeId: z.number() }))
  .handler(async ({ input }) => {
    const viaje = await prisma.viajes_publicados.findUnique({
  where: { id_viaje_pub: input.viajeId },
  include: {
    conductor: {
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            apellido_paterno: true,
            foto_perfil: true,
            reputacion_promedio: true,
            viajes_completados: true,
          },
        },
      },
    },
    solicitudes: {
      where: { estado_solicitud: 'aceptada' },
      include: {
        pasajero: {
          select: {
            id_usuario: true,
            nombre: true,
            apellido_paterno: true,
            foto_perfil: true,
          },
        },
      },
    },
  },
});

    if (!viaje) {
      throw new ORPCError('NOT_FOUND', { message: 'Viaje no encontrado' });
    }

    if (!viaje.conductor?.usuario) {
      throw new ORPCError('NOT_FOUND', { message: 'Datos del conductor no encontrados' });
    }

    return {
      success: true,
      viaje: {
        ...viaje,
        asientos_totales: viaje.conductor.capacidad_pasajeros,
        conductor: {
          ...viaje.conductor,
          usuario: {
            ...viaje.conductor.usuario,
            reputacion_promedio: viaje.conductor.usuario.reputacion_promedio || 0,
            total_viajes: viaje.conductor.usuario.viajes_completados || 0,
          },
        },
      },
    };
  });

// Iniciar viaje (conductor) — crea el viaje_activo y avisa a pasajeros
export const iniciarViaje = protectedProcedure
  .input(z.object({ viajeId: z.number() }))
  .handler(async ({ input, context }) => {
    const viaje = await prisma.viajes_publicados.findUnique({
      where: { id_viaje_pub: input.viajeId },
      include: {
        conductor: { include: { usuario: true } },
        solicitudes: {
          where: { estado_solicitud: 'aceptada' },
          select: { id_pasajero: true, latitud_recogida: true, longitud_recogida: true },
        },
      },
    });

    if (!viaje) throw new ORPCError('NOT_FOUND', { message: 'Viaje no encontrado' });
    if (viaje.conductor.usuario?.id_usuario !== context.user.id) {
      throw new ORPCError('FORBIDDEN', { message: 'No autorizado' });
    }

    const viajeActivoExistente = await prisma.viajes_activos.findFirst({
      where: { id_viaje_pub: input.viajeId },
    });
    if (viajeActivoExistente) {
      return { success: true, viajeActivo: viajeActivoExistente };
    }

    const viajeActivo = await prisma.viajes_activos.create({
      data: {
        id_viaje_pub:    input.viajeId,
        hora_inicio_real: new Date(),
        estado_trayecto: 'en_curso',
        historial_ruta:  [], 
      },
    });

    // Notificar a pasajeros aceptados
    for (const solicitud of viaje.solicitudes) {
      await crearNotificacion(
        solicitud.id_pasajero,
        '¡El conductor está en camino!',
        `Tu viaje a ${viaje.destino_texto} ha comenzado.`,
        'viaje_iniciado'
      );

      if (io) {
        io.emit('viaje_iniciado', {
          viajeId: input.viajeId,
          viajeActivoId: viajeActivo.id_viaje_activo,
          usuarioId: solicitud.id_pasajero,
        });
      }
    }

    return { success: true, viajeActivo };
  });

// Cancelar un viaje (solo conductor)
export const cancelarViaje = protectedProcedure
  .input(z.object({ viajeId: z.number() }))
  .handler(async ({ input, context }) => {
    const viaje = await prisma.viajes_publicados.findUnique({
      where: { id_viaje_pub: input.viajeId },
      include: { 
        conductor: { include: { usuario: true } },
        solicitudes: { 
          select: { 
            id_pasajero: true 
          } 
        }
      },
    })

    if (!viaje) {
      throw new ORPCError('NOT_FOUND', { message: 'Viaje no encontrado' })
    }

    if (viaje.conductor.usuario?.id_usuario !== context.user.id) {
      throw new ORPCError('FORBIDDEN', { message: 'No autorizado' })
    }

    // NOTIFICACIÓN: Avisar a todos los pasajeros que solicitaron el viaje
    if (viaje.solicitudes && viaje.solicitudes.length > 0) {
      for (const solicitud of viaje.solicitudes) {
        await crearNotificacion(
          solicitud.id_pasajero,
          "Viaje cancelado",
          `El viaje a ${viaje.destino_texto} ha sido cancelado por el conductor.`,
          "cancelacion"
        );
        
        if (io) {
          io.emit('nueva_notificacion', {
            usuarioId: solicitud.id_pasajero,
            titulo: "Viaje cancelado",
            cuerpo: `El viaje a ${viaje.destino_texto} ha sido cancelado.`,
            tipo: "cancelacion"
          });
        }
      }
    }

    // Emitir evento WebSocket para actualizar listas
    if (io) {
      io.emit('viaje_cancelado', { viajeId: input.viajeId })
    }

    // 1. Eliminar mensajes del chat
    await prisma.mensajes_chat.deleteMany({
      where: { id_viaje_pub: input.viajeId },
    })

    // 2. Eliminar viajes activos
    await prisma.viajes_activos.deleteMany({
      where: { id_viaje_pub: input.viajeId },
    })

    // 3. Eliminar solicitudes relacionadas
    await prisma.solicitudes_viaje.deleteMany({
      where: { id_viaje_pub: input.viajeId },
    })

    // 4. Luego eliminar el viaje
    await prisma.viajes_publicados.delete({
      where: { id_viaje_pub: input.viajeId },
    })

    return { success: true, message: 'Viaje cancelado' }
  })

// Finalizar un viaje (solo conductor) - Guarda en historial
export const finalizarViaje = protectedProcedure
  .input(z.object({ viajeId: z.number() }))
  .handler(async ({ input, context }) => {
    const viaje = await prisma.viajes_publicados.findUnique({
      where: { id_viaje_pub: input.viajeId },
      include: { 
        conductor: { include: { usuario: true } },
        solicitudes: { 
          where: { estado_solicitud: 'aceptada' },
          include: {
            pasajero: {
              select: {
                id_usuario: true,
                nombre: true,
                apellido_paterno: true,
              },
            },
          },
        }
      },
    });

    if (!viaje) {
      throw new ORPCError('NOT_FOUND', { message: 'Viaje no encontrado' });
    }

    if (viaje.conductor.usuario?.id_usuario !== context.user.id) {
      throw new ORPCError('FORBIDDEN', { message: 'No autorizado para finalizar este viaje' });
    }

    // 1. Contar pasajeros confirmados (aceptados)
    const pasajerosCount = viaje.solicitudes ? viaje.solicitudes.length : 0;

    // 2. Actualizar el viaje - guardar asientos disponibles y pasajeros confirmados
    await prisma.viajes_publicados.update({
      where: { id_viaje_pub: input.viajeId },
      data: {
        asientos_disponibles: 0,
        pasajeros_confirmados: pasajerosCount,
        // ELIMINADO: fecha_hora_salida: new Date(),
      },
    });

    // 3. Incrementar viajes_completados del conductor

    await prisma.usuarios.update({
      where: { id_usuario: viaje.conductor.usuario.id_usuario },
      data: {
        viajes_completados: { increment: 1 },
      },
    });

    // 3. Opcional: Crear o actualizar viaje_activo con estado finalizado
    const viajeActivoExistente = await prisma.viajes_activos.findFirst({
      where: { id_viaje_pub: input.viajeId },
    });

    if (!viajeActivoExistente) {
      await prisma.viajes_activos.create({
        data: {
          id_viaje_pub: input.viajeId,
          hora_inicio_real: viaje.fecha_hora_salida,
          hora_fin_real: new Date(),
          estado_trayecto: 'finalizado',
        },
      });
    } else {
      await prisma.viajes_activos.update({
        where: { id_viaje_activo: viajeActivoExistente.id_viaje_activo },
        data: {
          hora_fin_real: new Date(),
          estado_trayecto: 'finalizado',
        },
      });
    }

    // 4. Notificar a pasajeros aceptados
    if (viaje.solicitudes && viaje.solicitudes.length > 0) {
      for (const solicitud of viaje.solicitudes) {
        await crearNotificacion(
          solicitud.id_pasajero,
          "Viaje finalizado",
          `El viaje a ${viaje.destino_texto} ha sido completado.`,
          "finalizacion"
        );
        if (io) {
          io.emit('nueva_notificacion', {
            usuarioId: solicitud.id_pasajero,
            titulo: "Viaje finalizado",
            cuerpo: `El viaje a ${viaje.destino_texto} ha sido completado.`,
            tipo: "finalizacion"
          });
        }
      }
    }

    // 5. Emitir evento para actualizar listas en tiempo real
    if (io) {
      io.emit('viaje_finalizado', { viajeId: input.viajeId });
    }

    return { success: true, message: 'Viaje finalizado y guardado en historial' };
  });