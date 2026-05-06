import path from 'path'
import vision from '@google-cloud/vision'

const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../../google-key.json'),
})

export const extraerTextoDeImagen = async (rutaAbsoluta: string): Promise<string> => {
  try {
    const [resultado] = await client.textDetection(rutaAbsoluta)
    const anotaciones = resultado.textAnnotations
    if (anotaciones && anotaciones.length > 0) {
      return anotaciones[0].description?.toUpperCase() ?? ''
    }
    return ''
  } catch (error: any) {
    console.error('Error en Vision API:', error.message)
    throw new Error('Fallo al comunicarse con Google Cloud Vision')
  }
}

export const normalizarTexto = (str: string | null | undefined): string => {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}