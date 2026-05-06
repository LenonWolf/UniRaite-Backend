// Importamos la función que acabamos de crear
import { estaCercaDeRuta } from './src/services/mapService';

// ============================================================================
// SIMULACIÓN DE DATOS
// ============================================================================

// 🚗 CONductor: Va desde el Centro histórico hasta el ITM (Instituto Tecnológico de Morelia)
const conductor = {
  origenLat: 19.7027,    // Centro
  origenLng: -101.1923,
  destinoLat: 19.7226,   // ITM
  destinoLng: -101.1858
};

// 🚶 PASAJERO 1: Está en la colonia Félix Ireta (Cerca de la ruta)
const pasajero1 = {
  lat: 19.7080,
  lng: -101.1890
};

// 🚶 PASAJERO 2: Está en Altozano (Súper lejos de la ruta)
const pasajero2 = {
  lat: 19.7080,
  lng: -101.1890
};

// ============================================================================
// EJECUCIÓN DE LAS PRUEBAS
// ============================================================================
console.log("=== INICIANDO PRUEBAS DE MATCH CON TURF.JS ===\n");

// Prueba 1: Pasajero Cerca (Límite 1km)
console.log("Prueba 1: Pasajero en Félix Ireta (Debería ser TRUE)");
const match1 = estaCercaDeRuta(
  pasajero1.lat, pasajero1.lng,
  conductor.origenLat, conductor.origenLng,
  conductor.destinoLat, conductor.destinoLng,
  1.0 // Límite de 1 kilómetro
);
console.log(`Resultado: ${match1 ? '✅ MATCH' : '❌ NO MATCH'}\n`);

// Prueba 2: Pasajero Lejos (Límite 1km)
console.log("Prueba 2: Pasajero en Altozano (Debería ser FALSE)");
const match2 = estaCercaDeRuta(
  pasajero2.lat, pasajero2.lng,
  conductor.origenLat, conductor.origenLng,
  conductor.destinoLat, conductor.destinoLng,
  1.0 // Límite de 1 kilómetro
);
console.log(`Resultado: ${match2 ? '✅ MATCH' : '❌ NO MATCH'}\n`);