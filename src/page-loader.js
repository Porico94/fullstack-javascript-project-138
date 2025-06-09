import fs from "fs/promises";
import path from "path";
import downloadResource from "./downloadResource.js";
import debug from 'debug';

const cleanFilename = (url) => {
  const deleteProtocol = url.replace(/^https?:\/\//, "");
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + ".html";
};

//inicializamos debug con un namespace personalizado
const log = debug('page-loader:main');

const pageLoader = async (url, outputDir = process.cwd()) => { //Para ejemplo url: https://codica.la/cursos y ouputDir (ruta)
  log(`Iniciando page-loader para URL: ${url} en directorio: ${outputDir}`);
  const filename = cleanFilename(url); // codica-la-cursos.html
  const filePath = path.join(outputDir, filename); // outputDir/codica-la-cursos.html
  
  // try {
  //   await fs.mkdir(outputDir) //,{recursive: true}); // Creamos el directorio outputDir/codica-la-cursos.html
  // } catch (err) {
  //   throw new Error(`No se pudo crear el directorio de salida: ${outputDir}. Error: ${err.message}`);
  // }
  // log(`Directorio de salida verificado/creado: ${outputDir}`);

  log(`Iniciando la descarga HTML y recursos de ${filename}`);
  let htmlModified;
  try {
    htmlModified = await downloadResource(url, outputDir); // Usamos la funcion dowloadResource("https://codica.la/cursos", outputDir)
  } catch (err) {
    console.error("Error detallado durante la descarga de recursos:", err.message);
    throw new Error(`Falló la solicitud HTTP para ${url}. Error: ${err.message}`);
  }

  log(`Descarga de recursos y HTML modificado completado`);
  try {
    await fs.writeFile(filePath, htmlModified); // Creamos o reemplazamos el archivo 'outputDir/codica-la-cursos.html' por el contenido del nuevo html
  } catch (err) {
    console.error("Error detallado al guardar el archivo:", err.message);
    throw new Error(`No se pudo guardar el archivo en ${filePath}. Error: ${err.message}`);
  }
  log(`HTML modificado guardado en: ${filePath}`);
  return filePath;
};

export default pageLoader;
