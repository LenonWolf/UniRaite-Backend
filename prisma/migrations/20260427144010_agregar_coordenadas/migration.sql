/*
  Warnings:

  - Added the required column `latitud_destino` to the `viajes_publicados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `latitud_origen` to the `viajes_publicados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitud_destino` to the `viajes_publicados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitud_origen` to the `viajes_publicados` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "viajes_publicados" ADD COLUMN     "latitud_destino" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "latitud_origen" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitud_destino" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitud_origen" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "polyline" TEXT;
