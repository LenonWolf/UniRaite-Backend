import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import emailjs from '@emailjs/nodejs'
import path from 'path'
import fs from 'fs'
import { baseProcedure } from '../middleware'
import { prisma } from '../context'
import cloudinary from '../../services/cloudinaryService'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const isValidEmail = (email: string) => email.endsWith('@morelia.tecnm.mx')

const subirACloudinary = async (localPath: string, folder: string): Promise<string> => {
  const result = await cloudinary.uploader.upload(localPath, {
    folder,
    resource_type: 'image',
  })
  return result.secure_url
}

// ─── Procedures ──────────────────────────────────────────────────────────────

// GET /api/verificar-correo?correo=...
export const verificarCorreo = baseProcedure
  .input(z.object({ correo: z.string().email() }))
  .handler(async ({ input }) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { correo_inst: input.correo },
    })
    return { existe: !!usuario }
  })

// POST /api/login
export const login = baseProcedure
  .input(
    z.object({
      correo_inst: z.string().email(),
      password: z.string().min(1),
    })
  )
  .handler(async ({ input }) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { correo_inst: input.correo_inst },
    })

    if (!usuario) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Credenciales incorrectas' })
    }

    const valido = await bcrypt.compare(input.password, usuario.password_hash)
    if (!valido) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Credenciales incorrectas' })
    }

    const token = jwt.sign({ id: usuario.id_usuario }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    })

    return {
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido_paterno: usuario.apellido_paterno,
        apellido_materno: usuario.apellido_materno,
        correo_inst: usuario.correo_inst,
        num_control: usuario.num_control,
        es_conductor: usuario.es_conductor,
        verificado: usuario.verificado,
      },
    }
  })

// POST /api/forgot-password
export const forgotPassword = baseProcedure
  .input(z.object({ correo_inst: z.string().email() }))
  .handler(async ({ input }) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { correo_inst: input.correo_inst },
    })

    if (!usuario) {
      throw new ORPCError('NOT_FOUND', { message: 'El correo no está registrado' })
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString()

    await prisma.usuarios.update({
      where: { correo_inst: input.correo_inst },
      data: {
        reset_token: codigo,
        reset_expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    console.log(`📧 Código para ${input.correo_inst}: ${codigo}`)

    // Enviar correo con EmailJS
    try {
      const templateParams = {
        to_name: usuario.nombre,
        email: input.correo_inst,
        codigo: codigo,
        from_name: 'UNIRAITE',
      }

      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID!,
        process.env.EMAILJS_TEMPLATE_ID!,
        templateParams,
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY!,
          privateKey: process.env.EMAILJS_PRIVATE_KEY!,
        }
      )

      console.log('✅ Email enviado correctamente')
    } catch (emailError) {
      console.error('❌ Error al enviar email:', emailError)
      // No lanzamos error, el código igual se guardó
    }

    return { success: true, message: 'Código enviado a tu correo' }
  })

  // POST /api/verify-code
export const verifyCode = baseProcedure
  .input(z.object({
    correo_inst: z.string().email(),
    codigo: z.string(),
  }))
  .handler(async ({ input }) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { correo_inst: input.correo_inst },
    })

    if (!usuario) {
      throw new ORPCError('NOT_FOUND', { message: 'Usuario no encontrado' })
    }

    if (usuario.reset_token !== input.codigo) {
      throw new ORPCError('BAD_REQUEST', { message: 'Código incorrecto' })
    }

    if (usuario.reset_expires! < new Date()) {
      throw new ORPCError('BAD_REQUEST', { message: 'El código ha expirado' })
    }

    return { success: true, message: 'Código válido' }
  })

// POST /api/reset-password
export const resetPassword = baseProcedure
  .input(z.object({
    correo_inst: z.string().email(),
    newPassword: z.string().min(6, { message: 'La contraseña debe tener mínimo 6 caracteres' }),
  }))
  .handler(async ({ input }) => {
    const hashedPassword = await bcrypt.hash(input.newPassword, 10)

    await prisma.usuarios.update({
      where: { correo_inst: input.correo_inst },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_expires: null,
      },
    })

    return { success: true, message: 'Contraseña actualizada correctamente' }
  })

// POST /api/register
export const register = baseProcedure
  .input(
    z.object({
      nombre: z.string().min(1),
      apellido_paterno: z.string().min(1),
      apellido_materno: z.string().optional(),
      num_control: z.string().min(1),
      correo_inst: z.string().email(),
      password: z.string().min(6, { message: 'La contraseña debe tener mínimo 6 caracteres' }),
      carrera: z.string().optional(),
      // URLs de Cloudinary devueltas por el endpoint de upload
      foto_credencial: z.string().optional(),
      foto_perfil: z.string().optional(),
    })
  )
  .handler(async ({ input }) => {
    if (!isValidEmail(input.correo_inst)) {
      throw new ORPCError('BAD_REQUEST', { message: 'Usa tu correo @morelia.tecnm.mx' })
    }

    const existe = await prisma.usuarios.findFirst({
      where: {
        OR: [
          { correo_inst: input.correo_inst },
          { num_control: input.num_control },
        ],
      },
    })

    if (existe) {
      throw new ORPCError('CONFLICT', {
        message: 'El correo o número de control ya está registrado',
      })
    }

    let urlFotoPerfil: string | null = null;
    let urlFotoCredencial: string | null = null;

    if (input.foto_perfil) {
      const rutaPerfil = path.join(process.cwd(), 'uploads', 'perfiles', input.foto_perfil);

      if (fs.existsSync(rutaPerfil)) {
        console.log('Subiendo foto de perfil a Cloudinary...');
        urlFotoPerfil = await subirACloudinary(rutaPerfil, 'uniraite/perfiles');
        fs.unlinkSync(rutaPerfil); // Borramos el archivo local
      }
    }

    if (input.foto_credencial) {
      const rutaCredencial = path.join(process.cwd(), 'uploads', 'credentials', input.foto_credencial);
      
      if (fs.existsSync(rutaCredencial)) {
        console.log('Subiendo credencial a Cloudinary...');
        urlFotoCredencial = await subirACloudinary(rutaCredencial, 'uniraite/credenciales');
        fs.unlinkSync(rutaCredencial); // Borramos el archivo local
      }
    }

    const hashedPassword = await bcrypt.hash(input.password, 10)

    const usuario = await prisma.usuarios.create({
      data: {
        id_usuario: crypto.randomUUID(),
        nombre: input.nombre,
        apellido_paterno: input.apellido_paterno,
        apellido_materno: input.apellido_materno ?? null,
        num_control: input.num_control,
        correo_inst: input.correo_inst,
        password_hash: hashedPassword,
        carrera: input.carrera ?? null,
        foto_credencial: urlFotoCredencial,
        foto_perfil: urlFotoPerfil,
      },
    })

    const token = jwt.sign({ id: usuario.id_usuario }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    })

    return {
      success: true,
      message: 'Registro exitoso',
      token,
      user: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido_paterno: usuario.apellido_paterno,
        apellido_materno: usuario.apellido_materno,
        correo_inst: usuario.correo_inst,
        num_control: usuario.num_control,
      },
    }
  })
