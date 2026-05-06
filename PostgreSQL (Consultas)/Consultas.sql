SELECT * FROM "usuarios";
/*Insertar datos de prueba*/
INSERT INTO usuarios (
  id_usuario,
  nombre,
  apellido_paterno,
  apellido_materno,
  correo_inst,
  password_hash,
  num_control,
  carrera,
  universidad,
  foto_perfil,
  foto_credencial,
  es_conductor,
  verificado,
  reputacion_promedio
) VALUES (
  'user_001',
  'José',
  'Vázquez',
  'Fuentes',
  'jose.vazquez@uni.edu',
  '123456_hash',
  '23120515',
  'Ingeniería en Sistemas',
  'Instituto Tecnológico',
  NULL,
  NULL,
  false,
  false,
  5.0
);