import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import fs from "fs/promises";
import debug from "debug";
import Listr from "listr";
import { prefixName, directoryName } from "./utils";

//inicializamos debug con un namespace personalizado
const log = debug("page-loader:resource");

const downloadResource = (url, outputDir) => {
  const resultPath = path.join(outputDir, directoryName(url));
  let resources;
  let $;

  return axios
    .get(url)
    .then((response) => {
      const html = response.data;
      log(`Iniciado descarga de HTML de ${url}`);
      $ = cheerio.load(html); // Cargamos cheerio para usar JQuery en este html

      // Obtenemos el origen de la página, ej: "https://codica.la/cursos"
      const pageOrigin = new URL(url).origin; // pageOrigin = "https://codica.la"

      //Creamos un array con las urls de cada imagen
      const images = $("img") //Por ejemplo: <img src="/assets/professions/nodejs.png">
        .map((index, element) => {
          const src = $(element).attr("src"); //variable src = "/assets/professions/nodejs.png"
          if (!src) return null; //Si no existe src se devuelve null

          const fullImageUrl = new URL(src, url).href; //new URL("https://codica.la/cursos", "/assets/professions/nodejs.png").href
          //Devuelve fullImageUrl = "https://codica.la/assets/professions/nodejs.png"

          // Filtramos solo los recursos que pertenecen al mismo origen
          if (new URL(fullImageUrl).origin === pageOrigin) {
            const filename = prefixName(url, fullImageUrl); // filename tendria como resultado = "codica-la-nodejs.png"

            return {
              url: fullImageUrl, // "https://codica.la/assets/professions/nodejs.png"
              filename, // "codica-la-assets-professions-nodejs.png"
              type: "binary",
            };
          }
          return null;
        })
        .get(); // Convertimos colección de objetos de cheerios en un array nativo de JS, ejemplo: [ 'img1.png', 'img2.png' ]

      const links = $("link") //Por ejemplo: <link rel="stylesheet" media="all" href="https://cdn2.codica.la/assets/menu.css">
        .map((index, element) => {
          const href = $(element).attr("href"); // variable href = "https://cdn2.codica.la/assets/menu.css"
          if (!href) return null;

          const fullLinkUrl = new URL(href, url).href; //new URL("https://codica.la/cursos", "https://cdn2.codica.la/assets/menu.css").href
          //Devuelve "https://cdn2.codica.la/assets/menu.css" porque predomina la url absoluta

          // Filtramos solo los recursos que pertenecen al mismo origen
          if (new URL(fullLinkUrl).origin === pageOrigin) {
            // Como no cumple "https://cdn2.codica.la/assets/menu.css"
            const filename = prefixName(url, fullLinkUrl); // No retorna nada
            const type = fullLinkUrl.endsWith(".css") ? "text" : "binary";
            return {
              url: fullLinkUrl,
              filename,
              type,
            };
          }
          return null;
        })
        .get();

      const scripts = $("script") //Por ejemplo: <script src="https://js.stripe.com/v3/"></script>
        .map((index, element) => {
          const src = $(element).attr("src"); //src = "https://js.stripe.com/v3/"
          if (!src) return null;

          const fullScriptUrl = new URL(src, url).href; //new URL("https://codica.la/cursos", "https://js.stripe.com/v3/").href
          //Devuelve "https://js.stripe.com/v3/" porque predomina la url absoluta

          // Filtramos solo los recursos que pertenecen al mismo origen
          if (new URL(fullScriptUrl).origin === pageOrigin) {
            // Como no cumple "https://js.stripe.com/v3/"
            const filename = prefixName(url, fullScriptUrl); // No retorna nada
            const type = fullScriptUrl.endsWith(".js") ? "text" : "binary";
            return {
              url: fullScriptUrl,
              filename,
              type,
            };
          }
          return null;
        })
        .get();

      //Guardamos todos los array en uno solo, con get() se filtran los nulls
      resources = [...images, ...links, ...scripts].filter(Boolean); // filter(Boolean) por si algún map devolvió null explícitamente
      return fs.mkdir(resultPath, { recursive: true }); //Creamos el directorio outputDir/codica-la-cursos_files, y {recursive: true} ayuda para no generar problemas si ya existe ese directorio
    })
    .then(() => {
      //Guardamos cada elemento del array en la ruta, recordar { url, filename} son propiedades del array resources
      const tasks = new Listr(
        resources.map(({ url: resourceUrl, filename, type }) => ({
          title: `Descargando ${resourceUrl}`,
          task: () => {
            const fullPathFile = path.join(resultPath, filename); // fullpath = "/ruta-actual/codica-la-cursos_files/codica-la-nodejs.png"
            const responseType = type === "text" ? "text" : "arraybuffer"; // Determinamos el responseType basado en el 'type' que agregamos
            return axios
              .get(resourceUrl, { responseType })
              .then((res) => {
                const rawBuffer = res.data;

                if (type === "text") {
                  const buffer = Buffer.from(rawBuffer);
                  const bom = buffer.slice(0, 3).toString("hex");
                  const hasBom = bom === "efbbbf";
                  const cleanBuffer = hasBom ? buffer.slice(3) : buffer;
                  const cleanText = cleanBuffer
                    .toString("utf8")
                    .replace(/\r/g, "");
                  return fs.writeFile(fullPathFile, cleanText, "utf8");
                }

                // Para binarios, guardamos el buffer sin modificar
                return fs.writeFile(fullPathFile, rawBuffer);
              })
              .catch((e) => {
                log(`Error en ${resourceUrl}: ${e.message}`);
                throw new Error(
                  `Error descargando ${resourceUrl}: ${e.message}`
                );
              });
          },
        })),
        { concurrent: true }
      );
      return tasks.run();
    })
    .then(() => {
      //Creamos una array de objetos que seran las etiquetas y los atributos que vamos a modificar
      const tagTypes = [
        { selector: "img", attr: "src" },
        { selector: "script", attr: "src" },
        { selector: "link", attr: "href" },
      ];

      //Pasamos cada objeto del array tagTypes por un for of y buscamos cual coincide para asi cambiarlo en el html original
      for (const { selector, attr } of tagTypes) {
        $(selector).each((index, element) => {
          const originalUrl = $(element).attr(attr);
          if (!originalUrl) return; // Si no tiene el atributo, no hacer nada

          // Buscar si hay un recurso que coincida con esta URL
          const resource = resources.find(
            (res) => res.url === new URL(originalUrl, url).href
          );

          if (resource) {
            const localPath = path.join(directoryName(url), resource.filename);
            $(element).attr(attr, localPath);
            log(
              `Modificamos el recurso ${attr} a la ruta local: ${resource.filename}`
            );
          }
        });
      }
      return $.html();
    })
    .catch((err) => {
      throw err;
    });
};

export default downloadResource;
