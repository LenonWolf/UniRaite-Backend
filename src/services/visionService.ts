import path from 'path';
import vision from '@google-cloud/vision';

const getVisionClient = () => {
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
      const decodedText = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
      const credentialsJson = JSON.parse(decodedText);
      
      return new vision.ImageAnnotatorClient({ 
        credentials: {
          client_email: credentialsJson.client_email,
          private_key: credentialsJson.private_key,
        } 
      });
    } catch (error) {
      console.error('❌ Error crítico decodificando las credenciales de Google:', error);
      throw new Error('Credenciales de Google Cloud Vision inválidas en el entorno.');
    }
  }
  
  return new vision.ImageAnnotatorClient({
    keyFilename: path.join(__dirname, '../../google-key.json'),
  });
};

const client = getVisionClient();

export const extraerTextoDeImagen = async (rutaAbsoluta: string): Promise<string> => {
  try {
    const [resultado] = await client.textDetection(rutaAbsoluta);
    const anotaciones = resultado.textAnnotations;
    
    if (anotaciones && anotaciones.length > 0) {
      return anotaciones[0].description?.toUpperCase() ?? '';
    }
    
    return '';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error en Vision API:', errorMessage);
    throw new Error('Fallo al comunicarse con Google Cloud Vision');
  }
};

export const normalizarTexto = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
};