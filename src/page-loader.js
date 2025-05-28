import fs from "fs/promises";
import path from "path";
import downloadResource from "./downloadResource.js";

const cleanFilename = (url) => {
  const deleteProtocol = url.replace(/^https?:\/\//, "");
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + ".html";
};

const pageLoader = async (url, outputDir = process.cwd()) => {
  const filename = cleanFilename(url);
  const filePath = path.join(outputDir, filename);

  let htmlModified;
  try {
    htmlModified = await downloadResource(url, outputDir);
  } catch (err) {
    console.error("Error detallado durante la descarga de recursos:", err.message);
    throw new Error(`Falló la solicitud HTTP para ${url}. Original: ${err.message}`);
  }

  try {
    await fs.writeFile(filePath, htmlModified);
  } catch (err) {
    console.error("Error detallado al guardar el archivo:", err.message);
    throw new Error(`No se pudo guardar el archivo en ${filePath}. Original: ${err.message}`);
  }

  return filePath;
};

export default pageLoader;
