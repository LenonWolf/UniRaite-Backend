-- AlterTable
ALTER TABLE "solicitudes_viaje" ADD COLUMN     "latitud_recogida" DOUBLE PRECISION,
ADD COLUMN     "longitud_recogida" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "viajes_activos" ADD COLUMN     "historial_ruta" JSONB;
