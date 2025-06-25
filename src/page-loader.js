import fs from "fs/promises";
import path from "path";
import downloadResource from "./downloadResource.js";
import debug from 'debug';
import { urlToFilename, urlToDirname, getExtension, sanitizeOutputDir } from "./utils.js";

//inicializamos debug con un namespace personalizado
const log = debug('page-loader:main');

const downloadPage = (pageUrl, outputDirName = '') => { //Para ejemplo url: https://codica.la/cursos y ouputDir (ruta)
  log(`Iniciando page-loader para URL: ${pageUrl} en directorio: ${outputDirName}`);

  const sanitizedDir = sanitizeOutputDir(outputDirName);

  if (!sanitizedDir) {
    return Promise.reject(new Error(`❌ No se puede usar el directorio restringido: ${outputDirName || process.cwd()}`));
  }

  log('url', pageUrl);
  log('output', sanitizedDir);

  const url = new URL(pageUrl);
  const slug = `${url.hostname}${url.pathname}`; // 'codica.la/cursos'
  const filename = urlToFilename(slug); // 'codica-la-cursos.html'
  const fullOutputDirname = path.resolve(sanitizedDir); // rutaActual/outputDirName 
  const extension = getExtension(filename) === '.html' ? '' : '.html'; // ''
  const fullOutputFilename = path.join(fullOutputDirname, `${filename}${extension}`); // rutaActual/outputDirName/codica-la-cursos.html
  const assetsDirname = urlToDirname(slug); // 'codica-la-cursos_files'
  const fullOutputAssetsDirname = path.join(fullOutputDirname, assetsDirname); // rutaActual/outputDirName/codica-la-cursos_files

  return fs
    .access(fullOutputDirname)
    .catch(() => {
      throw new Error(`El directorio de salida no existe: ${fullOutputDirname}`);
    })
    .then(() => {
      log(`Descargando página desde ${pageUrl}`);
      return downloadResource(pageUrl, fullOutputAssetsDirname, assetsDirname);
    })
    .then((modifiedHTML) => {
      log(`Guardando HTML modificado en ${fullOutputFilename}`);
      return fs.writeFile(fullOutputFilename, modifiedHTML, "utf8").then(() => fullOutputFilename);
    });        
};

export default downloadPage;