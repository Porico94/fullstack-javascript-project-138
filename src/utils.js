import path from 'path';

// Función para crear el archivo html
export const cleanFilename = (url, ext) => {
  const deleteProtocol = url.replace(/^https?:\/\//, ""); // Quitamos https de la url
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + ext; // Reemplazamos todo lo que no sea letras y números por guión "-" y agregamos la extensión .html
};

// Función para crear el nombre del archivo con su extensión
export const prefixName = (url, fullUrl) => {
  //Ejem: prefixName("https://codica.la/cursos", "https://codica.la/assets/professions/nodejs.png")
  const { origin } = new URL(url); //Obtenemos el url origin "https://codica.la/cursos"
  const cleanOrigin = cleanFilename(origin, "");
  const pathName = new URL(fullUrl).pathname; //Obtenemos "/assets/professions/nodejs.png"
  return `${cleanOrigin}${pathName.replace(/[^a-zA-Z0-9.]/g, "-")}`; // Armamos el nombre completo del archivo con el prefijo de la url
}; // ${codica-la}${-assets-professions-nodejs.png} quedaria asi 'codica-la-assets-professions-nodejs.png'

// Funcion para limpiar y generar el nombre de la carpeta
export const directoryName = (url) => {
  // Ejemplo url: "https://codica.la/cursos"
  const deleteProtocol = url.replace(/^https?:\/\//, ""); //Obtenemos este reemplazo: "codica.la/cursos"
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + "_files"; //Obtenemos este reemplazo: "codica-la-cursos_files"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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