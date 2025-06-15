import fs from "fs/promises";
import path from "path";
import downloadResource from "./downloadResource.js";
import debug from 'debug';
import { cleanFilename } from "./utils.js";

//inicializamos debug con un namespace personalizado
const log = debug('page-loader:main');

const pageLoader = (url, outputDir = process.cwd()) => { //Para ejemplo url: https://codica.la/cursos y ouputDir (ruta)
  log(`Iniciando page-loader para URL: ${url} en directorio: ${outputDir}`);
  const filename = cleanFilename(url, ".html"); // codica-la-cursos.html
  const filePath = path.join(outputDir, filename); // outputDir/codica-la-cursos.html
  
  log(`Verificando si el directorio de salida existe: ${outputDir}`);
  return fs.access(outputDir)
    .catch(() => {
      throw new Error(`El directorio de salida no existe: ${outputDir}`);
    })
    .then(() => {
      log(`Directorio verificado. Iniciando descarga HTML y recursos de ${filename}`);
      return downloadResource(url, outputDir);
    })
    .then((htmlModified) => {
      log(`Descarga de recursos completada. Guardando archivo en ${filePath}`);
      return fs.writeFile(filePath, htmlModified)
        .then(() => {
          log(`HTML modificado guardado en: ${filePath}`);
          return filePath;
        })
        .catch((err) => {
          console.error("Error detallado al guardar el archivo:", err.messag);
          throw new Error(`No se pudo guardar el archivo en ${filePath}. Error: ${err.message}`);
        });
    })
    .catch((err) => {
      console.error("Error detallado durante la descarga de recursos:", err.message);
      throw new Error(`Falló la solicitud HTTP para ${url}. Error: ${err.message}`);
    });
};

export default pageLoader;