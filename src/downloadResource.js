import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import fs from "fs/promises";
import debug from 'debug';
import Listr from 'listr';


//Obtenemos el hostname
const prefixName = (url, fullUrl) => {
  //Ejem: prefixName("https://codica.la/cursos", "https://codica.la/assets/professions/nodejs.png")
  const { origin } = new URL(url); //Obtenemos el url origin "https://codica.la/cursos"
  const cleanOrigin = origin
    .replace(/^https?:\/\//, "") //Obtenemos este reemplazo: "codica.la"
    .replace(/[^a-zA-Z0-9]/g, "-"); //Obtenemos este reemplazo: "codica-la"
  const pathName = new URL(fullUrl).pathname; //Obtenemos "/assets/professions/nodejs.png"
  return `${cleanOrigin}${pathName.replace(/[^a-zA-Z0-9.]/g, "-")}`; // Armamos el nombre completo del archivo con el prefijo de la url
}; // ${codica-la}${-assets-professions-nodejs.png} quedaria asi 'codica-la-assets-professions-nodejs.png'


//Funcion para limpiar y generar el nombre de la carpeta
const directoryName = (url) => {
  // Ejemplo url: "https://codica.la/cursos"
  const deleteProtocol = url.replace(/^https?:\/\//, ""); //Obtenemos este reemplazo: "codica.la/cursos"
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, "-") + "_files"; //Obtenemos este reemplazo: "codica-la-cursos_files"
};

//inicializamos debug con un namespace personalizado
const log = debug('page-loader:resource');

const downloadResource = async (url, outputDir) => {
  const response = await axios.get(url); // Ejemplo: url = "https://codica.la/cursos"
  const html = response.data; // Lo que queremos obtener de respuesta del get url es el html que esta en .data
  log(`Iniciado descarga de HTML de ${url}`);
  const $ = cheerio.load(html); // Cargamos cheerio para usar JQuery en este html

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
      if (new URL(fullLinkUrl).origin === pageOrigin) { // Como no cumple "https://cdn2.codica.la/assets/menu.css"
        const filename = prefixName(url, fullLinkUrl); // No retorna nada
        const type = fullLinkUrl.endsWith(".css") ? "text" : "binary";
        return {
          url: fullLinkUrl,
          filename,
          type,
        };
      };
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
      if (new URL(fullScriptUrl).origin === pageOrigin) { // Como no cumple "https://js.stripe.com/v3/"
        const filename = prefixName(url, fullScriptUrl); // No retorna nada
        const type = fullScriptUrl.endsWith(".js") ? "text" : "binary";
        return {
          url: fullScriptUrl,
          filename,
          type,
        };
      };
      return null;
    })    
    .get();

  //Guardamos todos los array en uno solo, con get() se filtran los nulls
  const resources = [...images, ...links, ...scripts].filter(Boolean); // filter(Boolean) por si algún map devolvió null explícitamente

  //Creamos el directorio donde se guardaran los recursos
  const resultPath = path.join(outputDir, directoryName(url)); //Obtenemos la ruta donde se creara el directorio 'outputDir/codica-la-cursos_files'
  try {
    await fs.mkdir(resultPath)//, {recursive: true}); //Creamos el directorio outputDir/codica-la-cursos_files, y {recursive: true} ayuda para no generar problemas si ya existe ese directorio
  } catch (err) {
    throw new Error(`No se pudo crear el directorio de salida: ${resultPath}. Error: ${err.message}`);
  }  

  //Guardamos cada elemento del array en la ruta, recordar { url, filename} son propiedades del array resources
  const tasks = new Listr(
     resources.map(({ url: resourceUrl, filename, type }) => ({
        title: `Descargando ${resourceUrl}`,
        task: async () => {
          const fullPathFile = path.join(resultPath, filename) // fullpath = "/ruta-actual/codica-la-cursos_files/codica-la-nodejs.png"
          const responseType = type === "text" ? "text" : "arraybuffer"; // Determinamos el responseType basado en el 'type' que agregamos
          try {
            const response = await axios.get(resourceUrl, {responseType}); // Realizamos una solicitud get al url del array resources, url = "https://codica.la/assets/professions/nodejs.png"
            await fs.writeFile(fullPathFile, response.data); // Solo guardamos la .data en un directorio local "/ruta-actual/codica-la-cursos_files/codica-la-nodejs.png"
            log(`Recurso guardado: ${fullPathFile}`);
          } catch (e) {
            log(`Error en ${resourceUrl}: ${e.message}`);
            throw new Error(`Error descargando ${resourceUrl}: ${e.message}`);
          }
        }
      }))    
  ,{ concurrent: true});
  
  await tasks.run();

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
        log(`Modificamos el recurso ${attr} a la ruta local: ${resource.filename}`);
      }
    });
  }

  const updatedHtml = $.html(); 
  return updatedHtml;
};

export default downloadResource;
