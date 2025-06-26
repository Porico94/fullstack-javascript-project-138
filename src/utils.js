import path from 'path';

const processName = (name, replacer = '-') => name
  .replace(/[?&=]/g, '') // Elimina caracteres especiales ? & =
  .match(/\w+/gi) // Extrae solo palabras (letras, números y _)
  .join(replacer); // Une las palabras con el separador

export const urlToFilename = (link, defaultFormat = '.html') => {
  const { dir, name, ext } = path.parse(link); // Parsea la URL en componentes
  const slug = processName(path.join(dir, name)); // Procesa la ruta y nombre
  const format = ext || defaultFormat; // Usa la extensión de la URL o la por defecto
  return `${slug}${format}`; // Combina nombre procesado con extensión
};

export const urlToDirname = (link, postfix = '_files') => {
  const { dir, name, ext } = path.parse(link); // Parsea la URL en componentes
  const slug = processName(path.join(dir, name, ext)); // Procesa toda la URL
  return `${slug}${postfix}`; // Añade el sufijo para el directorio de assets
};

export const getExtension = (fileName) => path.extname(fileName);

export const sanitizeOutputDir = (dir) => {
  const restrictedPaths = ['/sys', '/etc', '/bin', '/usr', '/lib']; // Rutas del sistema prohibidas
  const finalDir = dir || process.cwd(); // Usa el directorio actual si no se especifica
  return restrictedPaths.includes(finalDir) ? null : finalDir; // Verifica si es ruta restringida
};
