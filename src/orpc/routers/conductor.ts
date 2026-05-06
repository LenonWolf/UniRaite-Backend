import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import { protectedProcedure } from '../middleware'
import { prisma } from '../context'
import { extraerTextoDeImagen, normalizarTexto } from '../../services/visionService' // Importa las funciones de Vision CloudService
import cloudinary from '../../services/cloudinaryService';

// ============================================
// SERVICIO DE CLOUDINARY ACTIVADO
// ============================================

const subirACloudinary = async (localPath: string, folder: string): Promise<string> => {
  const result = await cloudinary.uploader.upload(localPath, {
    folder,
    resource_type: 'image',
  })
  return result.secure_url
}

// POST ___ /rpc/conductor.registroConductor ________________________________________
// NOTA: El cliente primero sube los archivos a POST /upload/conductor (Express),
// recibe los filenames, y los pasa aquí para validación + BD.
export const registroConductor = protectedProcedure
  .input(
    z.object({
      modelo: z.string().min(1),
      color: z.string().min(1),
      placas: z.string().min(1),
      capacidad_pasajeros: z.number().int().min(1),
      // URLs de Cloudinary devueltas por el endpoint de upload
      foto_licencia: z.string().min(1),
      foto_circulacion: z.string().min(1),
    })
  )
  .handler(async ({ input, context }) => {
    const rutaLicencia = path.join(process.cwd(), 'uploads', 'licencias', input.foto_licencia)
    const rutaCirculacion = path.join(process.cwd(), 'uploads', 'circulaciones', input.foto_circulacion)

    const borrarArchivos = () => {
      if (fs.existsSync(rutaLicencia))    fs.unlinkSync(rutaLicencia)
      if (fs.existsSync(rutaCirculacion)) fs.unlinkSync(rutaCirculacion)
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id_usuario: context.user.id },
    })
    if (!usuario) {
      borrarArchivos()
      throw new ORPCError('NOT_FOUND', { message: 'Usuario no encontrado' })
    }
    if (usuario.licencia_de_conducir) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'Ya tienes una solicitud de conductor en proceso o aprobada' })
    }

    const placaNormalizada = input.placas.trim().toUpperCase()

    const placaDuplicada = await prisma.conductores.findFirst({
      where: { placas: placaNormalizada },
    })
    if (placaDuplicada) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'Esas placas ya están registradas' })
    }

    // ==========================================================================
    // IA 1: VALIDAR LICENCIA DE CONDUCIR
    // ==========================================================================

    console.log('Validando Licencia de Conducir con IA...')
    const txtLicencia = normalizarTexto(await extraerTextoDeImagen(rutaLicencia))

    // Validar la estructura básica de la licencia de conducir
    if (!txtLicencia.includes('ESTADOSUNIDOSMEXICANOS') || !txtLicencia.includes('LICENCIAPARACONDUCIR')) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'El documento no parece ser una Licencia de Conducir oficial.' })
    }

    // Validar información del perfil con la licencia
    const nombreNorm  = normalizarTexto(usuario.nombre)
    const paternoNorm = normalizarTexto(usuario.apellido_paterno)
    const maternoNorm = normalizarTexto(usuario.apellido_materno)

    if (
      !txtLicencia.includes(nombreNorm) ||
      !txtLicencia.includes(paternoNorm) ||
      !txtLicencia.includes(maternoNorm)
    ) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'El nombre en la licencia no coincide con tu perfil de UNIRAITE.' })
    }

    // Validar vigencia de la licencia de conducir
    const caducidadRegex = /PERMANENTE|202[4-9]|203[0-9]/
    if (!caducidadRegex.test(txtLicencia)) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'La licencia parece estar vencida o no se detectó fecha de vigencia.' })
    }

    // ==========================================================================
    // IA 2: VALIDAR TARJETA DE CIRCULACIÓN
    // ==========================================================================

    console.log('Validando Tarjeta de Circulación con IA...')
    const txtCirculacion = normalizarTexto(await extraerTextoDeImagen(rutaCirculacion))

    // Validar la estructura básica de la tarjeta de circulación
    if (!txtCirculacion.includes('CIRCULA')) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'El documento no parece ser una Tarjeta de Circulación oficial.' })
    }
    // Validar que las placas y el color coincidan con la tarjeta de circulación
    if (!txtCirculacion.includes(placaNormalizada)) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'Las placas no coinciden con la Tarjeta de Circulación.' })
    }
    // Validar que el color del vehículo coincida con la tarjeta de circulación
    if (!txtCirculacion.includes(normalizarTexto(input.color))) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'El color del vehículo no coincide con la Tarjeta de Circulación.' })
    }
    // Validar que la marca/modelo del vehículo coincida con la tarjeta de circulación
    const modeloValido = input.modelo
      .split(' ')
      .some((p) => p.length > 2 && txtCirculacion.includes(normalizarTexto(p)))

    if (!modeloValido) {
      borrarArchivos()
      throw new ORPCError('BAD_REQUEST', { message: 'La marca o modelo no coinciden con la Tarjeta de Circulación.' })
    }

    // ==========================================================================
    // NOTA: Código comentado para guardar datos en BD (ADAPTADO A LOCAL TEMPORALMENTE)
    // ==========================================================================

    // console.log('Validación completada. Guardando en almacenamiento local...')
    
    // const licenciaUrl = `uploads/licencias/${input.foto_licencia}`
    // const circulacionUrl = `uploads/circulaciones/${input.foto_circulacion}`

    // ==========================================================================
    // Código para subir fotos a Cloudinary y guardar datos en BD
    // ==========================================================================
    
    console.log('Validación completada. Subiendo a Cloudinary...')
    const licenciaUrl = await subirACloudinary(rutaLicencia, 'uniraite/licencias')
    const circulacionUrl = await subirACloudinary(rutaCirculacion, 'uniraite/circulaciones')
    borrarArchivos()
    

    const id_licencia = `LIC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

    await prisma.usuarios.update({
      where: { id_usuario: context.user.id },
      data: {
        es_conductor: true,
        licencia_de_conducir: id_licencia,
      },
    })

    await prisma.conductores.create({
      data: {
        id_licencia,
        foto_licencia: licenciaUrl,
        foto_circulacion: circulacionUrl,
        modelo: input.modelo.trim(),
        color: input.color.trim(),
        placas: placaNormalizada,
        capacidad_pasajeros: input.capacidad_pasajeros,
      },
    })

    return { success: true, message: 'Ya eres conductor en UNIRAITE.' }
  })

// PUT ___ /api/vehiculo ________________________________________
export const actualizarVehiculo = protectedProcedure
  .input(
    z.object({
      modelo: z.string().min(1),
      color: z.string().min(1),
      placas: z.string().min(1),
      capacidad_pasajeros: z.number().int().min(1),
      foto_circulacion: z.string().min(1),
    })
  )
  .handler(async ({ input, context }) => {
    const rutaCirculacion = path.join(
      process.cwd(), 'uploads', 'circulaciones', input.foto_circulacion
    )

    const borrarArchivo = () => {
      if (fs.existsSync(rutaCirculacion)) fs.unlinkSync(rutaCirculacion)
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id_usuario: context.user.id },
    })
    if (!usuario?.licencia_de_conducir) {
      borrarArchivo()
      throw new ORPCError('NOT_FOUND', { message: 'No tienes un registro de conductor' })
    }

    const conductorActual = await prisma.conductores.findUnique({
      where: { id_licencia: usuario.licencia_de_conducir },
    })
    if (!conductorActual) {
      borrarArchivo()
      throw new ORPCError('NOT_FOUND', { message: 'Conductor no encontrado' })
    }

    const placaNormalizada = input.placas.trim().toUpperCase()

    const placaDuplicada = await prisma.conductores.findFirst({
      where: {
        placas:      placaNormalizada,
        id_licencia: { not: conductorActual.id_licencia },
      },
    })
    if (placaDuplicada) {
      borrarArchivo()
      throw new ORPCError('BAD_REQUEST', { message: 'Esas placas ya están registradas' })
    }

    // ==========================================================================
    // IA: VALIDAR TARJETA DE CIRCULACIÓN
    // ==========================================================================

    console.log('Validando Tarjeta de Circulación con IA...')
    const txtCirculacion = normalizarTexto(await extraerTextoDeImagen(rutaCirculacion))

    // Validar la estructura básica de la tarjeta de circulación
    if (!txtCirculacion.includes('CIRCULA')) {
      borrarArchivo()
      throw new ORPCError('BAD_REQUEST', { message: 'El documento no parece ser una Tarjeta de Circulación oficial.' })
    }
    // Validar que el color del vehículo coincida con la tarjeta de circulación
    if (!txtCirculacion.includes(placaNormalizada)) {
      borrarArchivo()
      throw new ORPCError('BAD_REQUEST', { message: 'Las placas no coinciden con la Tarjeta de Circulación.' })
    }
    // Validar que el color del vehículo coincida con la tarjeta de circulación
    if (!txtCirculacion.includes(normalizarTexto(input.color))) {
      borrarArchivo()
      throw new ORPCError('BAD_REQUEST', { message: 'El color del vehículo no coincide con la Tarjeta de Circulación.' })
    }
    // Validar que la marca/modelo del vehículo coincida con la tarjeta de circulación
    const modeloValido = input.modelo
      .split(' ')
      .some((p) => p.length > 2 && txtCirculacion.includes(normalizarTexto(p)))

    if (!modeloValido) {
      borrarArchivo()
      throw new ORPCError('BAD_REQUEST', { message: 'La marca o modelo no coinciden con la Tarjeta de Circulación.' })
    }

    // ==========================================================================
    // Subir nueva foto de circulación a Cloudinary y actualizar datos en BD
    // ==========================================================================

    // console.log('Validación completada. Guardando imagen actualizada localmente...')
    // const circulacionUrl = `uploads/circulaciones/${input.foto_circulacion}`

    // ==========================================================================
    // NOTA: Código comentado para subir foto a Cloudinary y actualizar datos en BD
    // ==========================================================================
    console.log('Validación completada. Subiendo a Cloudinary...')
    const circulacionUrl = await subirACloudinary(rutaCirculacion, 'uniraite/circulaciones')
    borrarArchivo()


    await prisma.conductores.update({
      where: { id_licencia: conductorActual.id_licencia },
      data: {
        modelo: input.modelo.trim(),
        color: input.color.trim(),
        placas: placaNormalizada,
        capacidad_pasajeros: input.capacidad_pasajeros,
        foto_circulacion: circulacionUrl,
      },
    })

    return { success: true, message: 'Vehículo actualizado correctamente' }
  })

  // GET ___ /rpc/conductor.getVehiculo ________________________________________
export const getVehiculo = protectedProcedure.handler(async ({ context }) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id_usuario: context.user.id },
    select: { licencia_de_conducir: true },
  })

  if (!usuario?.licencia_de_conducir) {
    throw new ORPCError('NOT_FOUND', { message: 'No tienes un vehículo registrado' })
  }

  const conductor = await prisma.conductores.findUnique({
    where: { id_licencia: usuario.licencia_de_conducir },
    select: {
      modelo: true,
      color: true,
      placas: true,
      capacidad_pasajeros: true,
    },
  })

  if (!conductor) {
    throw new ORPCError('NOT_FOUND', { message: 'Vehículo no encontrado' })
  }

  return { success: true, vehiculo: conductor }
})