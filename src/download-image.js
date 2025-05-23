import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { basename } from "path";

const downloadImage = async (url) => {
  const response = await axios.get(url); //La url la obtendremos cuando pasemos esta funcion a la funcion page-loader
  const html = response.data;
  const $ = cheerio.load(html);

  //Creamos un array con las urls absoluta de cada imagen
  const images = $("img")
    .map((index, element) => {
      const src = $(element).attr("src");
      const fullUrl = new URL(url, src).href;

      //Obtenemos el hostname
      const {origin} = new URL(url);
      const cleanOrigin = origin.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "-");;
      const filename = `${cleanOrigin}-${basename(fullUrl).replace(/[^a-zA-Z0-9.]/g, "-")}`;

      return {
        url: fullUrl,
        filename,
      };
    })
    .get(); //El get se usa para convertir el objeto Cheerio en array JS.

  //Funcion para limpiar y generar el nombre de la carpeta
  const cleanFilename = (url) => {
    const deleteProtocol = url.replace(/^https?:\/\//, "");
    return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + "_files";
  };

  //creamos el directorio donde se guardaran las imagenes
  const resultPath = path.join(process.cwd(), cleanFilename(url));
  await fs.mkdir(resultPath, { recursive: true });

  //Guardamos cada imagen en la ruta
  for( const {url, filename} of images) {
    try {
      const fullPath = path.join(resultPath, filename);
      const response = await axios.get(url, { responseType: "arraybuffer" });
      await fs.writeFile(fullPath, response.data);
    } catch(e) {
      console.error(`Error al descargar o guardar la imagen ${url}:`, e.message);
    }
  };

  $("img").each((index, element) => {
    const src = $(element).attr("src");
    const fullUrl = new URL(src, url).href;

    const image = images.find((img) => img.url === fullUrl);
    if (image) {
      const localPath = path.join(cleanFilename(url), image.filename);
      $(element).attr("src", localPath);
    }
  });

  const updatedHtml = $.html();
  return updatedHtml;
};

export default downloadImage;
