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

const pageLoader = async (url, outputDir = process.cwd()) => {
  log(`Iniciando page-loader para URL: ${url} en directorio: ${outputDir}`);
  const filename = cleanFilename(url);
  const filePath = path.join(outputDir, filename);

  log(`Iniciando la descarga HTML y recursos de ${filename}`);
  let htmlModified;
  try {
    htmlModified = await downloadResource(url, outputDir);
  } catch (err) {
    console.error("Error detallado durante la descarga de recursos:", err.message);
    throw new Error(`Falló la solicitud HTTP para ${url}. Original: ${err.message}`);
  }

  log(`Descarga de recursos y HTML modificado completado`);
  try {
    await fs.writeFile(filePath, htmlModified);
  } catch (err) {
    console.error("Error detallado al guardar el archivo:", err.message);
    throw new Error(`No se pudo guardar el archivo en ${filePath}. Original: ${err.message}`);
  }
  log(`HTML modificado guardado en: ${filePath}`);
  return filePath;
};

export default pageLoader;
