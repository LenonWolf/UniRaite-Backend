import { z } from "zod";
import { baseProcedure } from "../middleware";
import { prisma } from "../context";

export const registrarIncidente = baseProcedure
  .input(
    z.object({
      tipo: z.enum(["accidente", "acoso", "falla_mecanica", "otro"]),
    })
  )
  .handler(async ({ input }) => {
   console.log("INPUT RECIBIDO:", input);

    const incidente = await prisma.incidentes_seguridad.create({
      data: {
        tipo_emergencia: input.tipo,
        id_usuario_reporta: "usuariotest", // temporal
        id_viaje_activo: 1, 
        descripcion_breve: "Botón de emergencia activado",
        ubicacion_lat_lng: "0,0",
        fecha_reporte: new Date(),
      },
    });

    return {
      success: true,
      incidente,
    };
  });