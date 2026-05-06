import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { Server } from 'socket.io'
import { RPCHandler } from '@orpc/server/node'
import { onError } from '@orpc/server'
import { router } from './orpc/index'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

require('dotenv').config()


const app = express()
const serverHttp = http.createServer(app)
const io = new Server(serverHttp, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// Guardar io para usarlo en otros archivos
export { io }

// ─── Directorios de uploads ───────────────────────────────────────────────────

const uploadDirs = [
  './uploads',
  './uploads/credentials',
  './uploads/perfiles',
  './uploads/licencias',
  './uploads/circulaciones',
]
uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

// ─── Multer ───────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinos: Record<string, string> = {
      foto_credencial: './uploads/credentials',
      foto_perfil: './uploads/perfiles',
      foto_licencia: './uploads/licencias',
      foto_circulacion: './uploads/circulaciones',
    }
    cb(null, destinos[file.fieldname] ?? './uploads')
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, unique + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Solo JPG/PNG'))
    }
  },
})

// ─── Middleware de autenticación para Socket.IO ───────────────────────────────

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token requerido'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    const usuario = await prisma.usuarios.findUnique({
      where: { id_usuario: (decoded as any).id }
    });
    
    if (!usuario) {
      return next(new Error('Usuario no encontrado'));
    }
    
    (socket as any).user = usuario;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});

// ─── Eventos de Socket.IO ─────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('⚡ Usuario conectado:', (socket as any).user?.id_usuario);
  
  socket.on('join_chat', (chatId: string) => {
    socket.join(`chat_${chatId}`);
    console.log(`📱 Usuario unido al chat ${chatId}`);
  });
  
  socket.on('send_message', async (data: { chatId: string; message: string; receiverId: string }) => {
    const user = (socket as any).user;
    try {
      const mensaje = await prisma.mensajes_chat.create({
        data: {
          id_viaje_pub: parseInt(data.chatId),
          id_emisor: user.id_usuario,
          contenido: data.message,
          fecha_envio: new Date(),
        },
        include: { emisor: { select: { nombre: true, foto_perfil: true } } }
      });
      
      io.to(`chat_${data.chatId}`).emit('new_message', mensaje);
    } catch (error) {
      console.error('Error al guardar mensaje:', error);
      socket.emit('message_error', 'No se pudo enviar el mensaje');
    }
  });

  socket.on('driver_location', async (data: {
    viajeActivoId: number;
    viajeId: number;
    lat: number;
    lng: number;
  }) => {
    console.log(`📍 driver_location recibido de ${(socket as any).user?.id_usuario} para viaje ${data.viajeId}`);
    
    const roomName = `viaje_${data.viajeId}`;
    const socketsEnRoom = await io.in(roomName).fetchSockets();
    console.log(`   Enviando a ${socketsEnRoom.length} socket(s) en ${roomName}`);
    
    io.to(roomName).emit('driver_location_update', {
      lat: data.lat,
      lng: data.lng,
      viajeId: data.viajeId,
      timestamp: new Date().toISOString(),
      conductorId: (socket as any).user?.id_usuario,
    });

    // Guardar en historial_ruta cada N puntos (opcional, para no saturar la BD)
    try {
      const viajeActivo = await prisma.viajes_activos.findUnique({
        where: { id_viaje_activo: data.viajeActivoId },
      });
      if (viajeActivo) {
        const historial = (viajeActivo.historial_ruta as any[]) || [];
        // Guardar cada 10 puntos para no saturar
        if (historial.length % 10 === 0) {
          historial.push({ lat: data.lat, lng: data.lng, ts: Date.now() });
          await prisma.viajes_activos.update({
            where: { id_viaje_activo: data.viajeActivoId },
            data: { historial_ruta: historial },
          });
        }
      }
    } catch (e) {
      // No bloquear si falla el guardado
    }
  });

  // Pasajero/conductor se une a la sala del viaje
  socket.on('join_viaje', (viajeId: number) => {
    socket.join(`viaje_${viajeId}`);
    console.log(`🗺️ Usuario unido al viaje ${viajeId}`);
  });

  socket.on('leave_viaje', (viajeId: number) => {
    socket.leave(`viaje_${viajeId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('⚡ Usuario desconectado');
  });
});

// ─── oRPC Handler ─────────────────────────────────────────────────────────────

app.use(cors())
app.use('/uploads', express.static('uploads'))

const orpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('[oRPC error]', error)
    }),
  ],
})

app.use('/rpc', async (req, res, next) => {
  console.log('📡 Petición recibida en /rpc:', req.method, req.url)
  const { matched } = await orpcHandler.handle(req, res, {
    prefix: '/rpc',
    context: { headers: req.headers },
  })
  if (!matched) next()
})

// Upload foto de perfil
app.post('/upload/perfil', upload.single('foto_perfil'), (req, res) => {
  res.json({ foto_perfil: req.file?.filename || null });
});

// express.json()
app.use(express.json())

// ─── Rutas de upload (Express + Multer) ──────────────────────────────────────

app.post(
  '/upload/registro',
  upload.fields([
    { name: 'foto_credencial', maxCount: 1 },
    { name: 'foto_perfil', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]>
    res.json({
      foto_credencial: files?.foto_credencial?.[0]?.filename ?? null,
      foto_perfil: files?.foto_perfil?.[0]?.filename ?? null,
    })
  }
)

app.post(
  '/upload/conductor',
  upload.fields([
    { name: 'foto_licencia', maxCount: 1 },
    { name: 'foto_circulacion', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]>
    res.json({
      foto_licencia: files?.foto_licencia?.[0]?.filename ?? null,
      foto_circulacion: files?.foto_circulacion?.[0]?.filename ?? null,
    })
  }
)

app.post('/upload/circulacion', upload.single('foto_circulacion'), (req, res) => {
  res.json({
    foto_circulacion: req.file?.filename ?? null,
  })
})

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor UNIRAITE funcionando' })
})

// ─── Arranque ─────────────────────────────────────────────────────────────────

serverHttp.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`)
  console.log(`oRPC    → /rpc/*`)
  console.log(`Uploads → POST /upload/registro | /upload/conductor | /upload/circulacion`)
  console.log(`Health  → GET  /health`)
  console.log(`WebSocket Server corriendo en el mismo puerto`)
})