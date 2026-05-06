import { 
  verificarCorreo, 
  login, 
  register,
  forgotPassword,
  verifyCode,
  resetPassword
} from './routers/auth'
import { 
  getPerfil, 
  getUsuarioById, 
  actualizarFotoPerfil,
  cambiarPassword,
  actualizarPerfil,
  actualizarCarrera,
  actualizarContactoEmergencia
} from './routers/usuarios'
import { getVehiculo,
  registroConductor,
  actualizarVehiculo
} from './routers/conductor'
import { 
  listarViajes, 
  publicarViaje,
  obtenerViajesActivos,
  obtenerHistorialConductor,
  obtenerHistorialPasajero,
  cancelarViaje,
  finalizarViaje,
  obtenerViajePorId,
  iniciarViaje,
} from './routers/viajes'
import { 
  solicitarViaje, 
  responderSolicitud,
  obtenerSolicitudesRecibidas,
  obtenerEstadoPorViaje,
  misSolicitudes,
  obtenerSolicitudesActivas
} from './routers/solicitudes'
import { 
  getMensajes,
  enviarMensaje,
  misChats,
  getEstado,
  contarMensajesNoLeidos,
  marcarComoLeidos,
  eliminarHistorial
} from './routers/chat'
import { 
  obtenerTodas,
  marcarLeida,
  marcarTodasLeidas,
  eliminar
} from './routers/notificaciones'
import { 
  registrarIncidente
} from './routers/incidentes'
import {
  guardarCalificacion,
  obtenerCalificacionesRecibidas,
  obtenerMisCalificaciones
} from './routers/calificaciones'


export const router = {
  auth: {
    verificarCorreo,
    login,
    register,
    forgotPassword,
    verifyCode,
    resetPassword,
  },
  usuarios: {
    getPerfil,
    getUsuarioById,
    actualizarFotoPerfil,
    cambiarPassword,
    actualizarPerfil,
    actualizarCarrera,
    actualizarContactoEmergencia,
  },
  conductor: {
    registroConductor,
    actualizarVehiculo,
    getVehiculo,
  },
  viajes: {
    listar: listarViajes,
    publicar: publicarViaje,
    porId: obtenerViajePorId,
    activos: obtenerViajesActivos,
    historialConductor: obtenerHistorialConductor,
    historialPasajero: obtenerHistorialPasajero,
    cancelar: cancelarViaje,
    finalizarViaje: finalizarViaje,
    iniciarViaje: iniciarViaje,
  },
  solicitudes: {
    solicitar: solicitarViaje,
    responder: responderSolicitud,
    recibidas: obtenerSolicitudesRecibidas,
    obtenerEstadoPorViaje,
    misSolicitudes,
    activas: obtenerSolicitudesActivas,
  },
  chat: {
    getMensajes,
    enviarMensaje,
    misChats,
    getEstado,
    contarMensajesNoLeidos,
    marcarComoLeidos,
    eliminarHistorial,
  },
  notificaciones: {
    obtenerTodas,
    marcarLeida,
    marcarTodasLeidas,
    eliminar,
  },

incidentes: {
  registrar: registrarIncidente,
},
calificaciones: {
  guardar: guardarCalificacion,
  obtenerRecibidas: obtenerCalificacionesRecibidas,
  obtenerMias: obtenerMisCalificaciones,
},

}

export type AppRouter = typeof router