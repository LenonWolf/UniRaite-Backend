import * as turf from '@turf/turf';

/**
 * Calcula si un pasajero está cerca de la ruta recta de un conductor.
 * IMPORTANTE: Turf.js y GeoJSON SIEMPRE usan el orden [Longitud, Latitud].
 * @param pasajeroLat Latitud del pasajero (Punto C)
 * @param pasajeroLng Longitud del pasajero (Punto C)
 * @param conductorOrigenLat Latitud de salida del conductor (Punto A)
 * @param conductorOrigenLng Longitud de salida del conductor (Punto A)
 * @param conductorDestinoLat Latitud de destino del conductor (Punto B)
 * @param conductorDestinoLng Longitud de destino del conductor (Punto B)
 * @param limiteKm Distancia máxima permitida en kilómetros (Por defecto 1 km)
 * @returns boolean indicando si hay "Match"
 */

export const estaCercaDeRuta = (
  pasajeroLat: number, 
  pasajeroLng: number,
  conductorOrigenLat: number, 
  conductorOrigenLng: number,
  conductorDestinoLat: number, 
  conductorDestinoLng: number,
  limiteKm: number = 0.5
): boolean => {
  
  const puntoPasajero = turf.point([pasajeroLng, pasajeroLat]);

  const rutaConductor = turf.lineString([
    [conductorOrigenLng, conductorOrigenLat],
    [conductorDestinoLng, conductorDestinoLat]
  ]);
  
  const distancia = turf.pointToLineDistance(puntoPasajero, rutaConductor, { units: 'kilometers' });

  return distancia <= limiteKm;
};