-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_licencia_de_conducir_fkey";

-- AddForeignKey
ALTER TABLE "conductores" ADD CONSTRAINT "conductores_id_licencia_fkey" FOREIGN KEY ("id_licencia") REFERENCES "usuarios"("licencia_de_conducir") ON DELETE RESTRICT ON UPDATE CASCADE;
