-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- CreateEnum
CREATE TYPE "EstadoTrayecto" AS ENUM ('en_curso', 'finalizado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoEmergencia" AS ENUM ('accidente', 'acoso', 'falla_mecanica', 'otro');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT,
    "correo_inst" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "reset_token" TEXT,
    "reset_expires" TIMESTAMP(3),
    "num_control" TEXT NOT NULL,
    "carrera" TEXT,
    "universidad" TEXT,
    "foto_perfil" TEXT,
    "foto_credencial" TEXT,
    "es_conductor" BOOLEAN NOT NULL DEFAULT false,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "licencia_de_conducir" TEXT,
    "reputacion_promedio" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contacto_emergencia" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "conductores" (
    "id_licencia" TEXT NOT NULL,
    "foto_licencia" TEXT,
    "foto_circulacion" TEXT,
    "modelo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "capacidad_pasajeros" INTEGER NOT NULL,
    "foto_auto_url" TEXT,

    CONSTRAINT "conductores_pkey" PRIMARY KEY ("id_licencia")
);

-- CreateTable
CREATE TABLE "viajes_publicados" (
    "id_viaje_pub" SERIAL NOT NULL,
    "id_licencia_conductor" TEXT NOT NULL,
    "origen_texto" TEXT NOT NULL,
    "destino_texto" TEXT NOT NULL,
    "fecha_hora_salida" TIMESTAMP(3) NOT NULL,
    "asientos_disponibles" INTEGER NOT NULL,
    "costo_estimado" DOUBLE PRECISION NOT NULL,
    "es_recurrente" BOOLEAN NOT NULL,

    CONSTRAINT "viajes_publicados_pkey" PRIMARY KEY ("id_viaje_pub")
);

-- CreateTable
CREATE TABLE "solicitudes_viaje" (
    "id_solicitud" SERIAL NOT NULL,
    "id_viaje_pub" INTEGER NOT NULL,
    "id_pasajero" TEXT NOT NULL,
    "estado_solicitud" "EstadoSolicitud" NOT NULL,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_viaje_pkey" PRIMARY KEY ("id_solicitud")
);

-- CreateTable
CREATE TABLE "mensajes_chat" (
    "id_mensaje" SERIAL NOT NULL,
    "id_viaje_pub" INTEGER NOT NULL,
    "id_emisor" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha_envio" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensajes_chat_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "viajes_activos" (
    "id_viaje_activo" SERIAL NOT NULL,
    "id_viaje_pub" INTEGER NOT NULL,
    "hora_inicio_real" TIMESTAMP(3) NOT NULL,
    "hora_fin_real" TIMESTAMP(3),
    "estado_trayecto" "EstadoTrayecto" NOT NULL,

    CONSTRAINT "viajes_activos_pkey" PRIMARY KEY ("id_viaje_activo")
);

-- CreateTable
CREATE TABLE "incidentes_seguridad" (
    "id_incidente" SERIAL NOT NULL,
    "id_viaje_activo" INTEGER NOT NULL,
    "id_usuario_reporta" TEXT NOT NULL,
    "tipo_emergencia" "TipoEmergencia" NOT NULL,
    "descripcion_breve" TEXT NOT NULL,
    "ubicacion_lat_lng" TEXT NOT NULL,
    "fecha_reporte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_seguridad_pkey" PRIMARY KEY ("id_incidente")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id_calificacion" SERIAL NOT NULL,
    "id_viaje_activo" INTEGER NOT NULL,
    "id_evaluador" TEXT NOT NULL,
    "id_evaluado" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" SERIAL NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo_mensaje" TEXT NOT NULL,
    "tipo_notif" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_inst_key" ON "usuarios"("correo_inst");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_num_control_key" ON "usuarios"("num_control");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_licencia_de_conducir_key" ON "usuarios"("licencia_de_conducir");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_licencia_de_conducir_fkey" FOREIGN KEY ("licencia_de_conducir") REFERENCES "conductores"("id_licencia") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes_publicados" ADD CONSTRAINT "viajes_publicados_id_licencia_conductor_fkey" FOREIGN KEY ("id_licencia_conductor") REFERENCES "conductores"("id_licencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_viaje" ADD CONSTRAINT "solicitudes_viaje_id_viaje_pub_fkey" FOREIGN KEY ("id_viaje_pub") REFERENCES "viajes_publicados"("id_viaje_pub") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_viaje" ADD CONSTRAINT "solicitudes_viaje_id_pasajero_fkey" FOREIGN KEY ("id_pasajero") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_id_viaje_pub_fkey" FOREIGN KEY ("id_viaje_pub") REFERENCES "viajes_publicados"("id_viaje_pub") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes_activos" ADD CONSTRAINT "viajes_activos_id_viaje_pub_fkey" FOREIGN KEY ("id_viaje_pub") REFERENCES "viajes_publicados"("id_viaje_pub") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_seguridad" ADD CONSTRAINT "incidentes_seguridad_id_viaje_activo_fkey" FOREIGN KEY ("id_viaje_activo") REFERENCES "viajes_activos"("id_viaje_activo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_seguridad" ADD CONSTRAINT "incidentes_seguridad_id_usuario_reporta_fkey" FOREIGN KEY ("id_usuario_reporta") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_viaje_activo_fkey" FOREIGN KEY ("id_viaje_activo") REFERENCES "viajes_activos"("id_viaje_activo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_evaluador_fkey" FOREIGN KEY ("id_evaluador") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_evaluado_fkey" FOREIGN KEY ("id_evaluado") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
