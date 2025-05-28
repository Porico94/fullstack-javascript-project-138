import os from "os"; // Para trabajar con directorios temporales del sistema operativo
import path from "path"; // Para manejar rutas de archivos
import fs from "fs/promises"; // Para operaciones asíncronas de sistema de archivos
import axios from "axios"; // La librería que mockearemos
import fsExtra from "fs-extra"; // Utilidad para borrar directorios temporales (más robusta que fs.rm)
import pageLoader from "../src/page-loader"; // La función que vamos a probar
import * as cheerio from "cheerio"; // Para normalizar HTML y facilitar la comparación

// Mockea completamente el módulo 'axios'. Esto significa que cualquier llamada a axios.get, axios.post, etc., será interceptada por Jest
jest.mock("axios");

// Función para normalizar el HTML antes de compararlo elimina espacios extra y saltos de línea para evitar fallos de prueba
// por diferencias triviales de formato.
const normalizeHtml = (html) => {
  return cheerio
    .load(html)
    .html()
    .replace(/\s+/g, " ") // reemplaza múltiples espacios por uno solo
    .trim();
};

let tempDir; // Variable para almacenar la ruta del directorio temporal
const fixturesPath = path.join(__dirname, "__fixtures__"); // Ruta base para los archivos de prueba (fixtures)

beforeEach(async () => {
  // `beforeEach` se ejecuta antes de cada prueba individual.
  // Limpia todos los mocks de Jest. Esto es crucial para asegurar que cada prueba tenga un estado de mock "limpio"
  // y no herede configuraciones de pruebas anteriores.
  jest.clearAllMocks();
  // Crea un directorio temporal único para cada prueba.
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-test-"));
});

// `afterEach` se ejecuta después de cada prueba individual.
afterEach(async () => {
  // Elimina recursivamente el directorio temporal y todo su contenido.
  await fsExtra.remove(tempDir);
});

test("debería guardar el archivo HTML con el nombre y contenido correctos en el directorio especificado", async () => {
  const urlToDownload = "https://codica.la/cursos";
  const expectedFilename = "codica-la-cursos.html"; // Nombre esperado del archivo HTML descargado
  const expectedFilePath = path.join(tempDir, expectedFilename); // Ruta completa esperada del archivo

  // Rutas a los archivos de fixture (HTML original y HTML esperado/modificado)
  const originalHtmlFixturePath = path.join(fixturesPath, "test.html");
  const expectedModifiedHtmlFixturePath = path.join(
    fixturesPath,
    "expected.html"
  );

  // Leemos el contenido de los fixtures
  const originalHtmlContent = await fs.readFile(
    originalHtmlFixturePath,
    "utf-8"
  );
  const expectedModifiedHtmlContent = await fs.readFile(
    expectedModifiedHtmlFixturePath,
    "utf-8"
  );

  // Configuramos el mock de axios.get, cuando axios.get sea llamado con la URL 'https://codica.la/cursos'
  // debe resolver con un objeto que contenga la data del HTML original.
  axios.get.mockResolvedValue({ data: originalHtmlContent });

  // Llamamos a la función que estamos probando pageLoader(url, outputdir) debería descargar el HTML
  // modificarlo y guardarlo en `tempDir`.
  const resultPath = await pageLoader(urlToDownload, tempDir);

  // Comprobamos que la función pageLoader devolvió la ruta esperada del archivo
  expect(resultPath).toBe(expectedFilePath);

  // Intentamos leer el contenido del archivo que pageLoader debería haber creado
  const downloadedFileContent = await fs.readFile(resultPath, "utf-8");

  // Usamos `normalizeHtml` para asegurar una comparación robusta.
  expect(normalizeHtml(downloadedFileContent)).toBe(
    normalizeHtml(expectedModifiedHtmlContent)
  );
});

test("debería descargar los recursos (imágenes, CSS, scripts) y guardarlos correctamente con data falsa", async () => {
  const urlToDownload = "https://codica.la/cursos";
  const assetsDirname = "codica-la-cursos_files"; // Nombre esperado del directorio de recursos

  // Rutas al fixture del HTML original (el mismo que usaste en el primer test)
  const originalHtmlFixturePath = path.join(fixturesPath, "test.html");
  const originalHtmlContent = await fs.readFile(
    originalHtmlFixturePath,
    "utf-8"
  );

  // Datos falsos para los recursos
  // Para la imagen (binario), usamos un Buffer
  const fakeImageData = Buffer.from(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
  ); // Un pixel transparente PNG
  // Para CSS y JS (texto), usamos strings
  const fakeCssData =
    "body { background-color: #f0f0f0; } /* Fake CSS content */";
  const fakeScriptData =
    "console.log('Fake script executed'); /* Fake JS content */";

  // 1. Configurar el mock de axios.get para múltiples llamadas
  axios.get.mockImplementation((url) => {
    switch (url) {
      case urlToDownload:
        return Promise.resolve({ data: originalHtmlContent });
      case "https://codica.la/assets/professions/nodejs.png":
        return Promise.resolve({
          data: fakeImageData,
          request: { responseURL: url },
        });
      case "https://codica.la/assets/application.css":
        return Promise.resolve({
          data: fakeCssData,
          request: { responseURL: url },
        });
      case "https://codica.la/packs/js/runtime.js":
        return Promise.resolve({
          data: fakeScriptData,
          request: { responseURL: url },
        });
      case "https://codica.la/cursos.html":
        return Promise.resolve({
          data: "<html><body></body></html>",
          request: { responseURL: url },
        });

      default:
        // Para URLs que tu pageLoader intenta descargar pero que no mockeamos porque
        // esperamos que sean filtradas (ej. js.stripe.com) o que la prueba no necesita verificar su descarga.
        console.warn(
          `Axios intentó descargar una URL no mockeada explícitamente en el test de recursos (o que se espera que sea filtrada): ${url}`
        );
        return Promise.resolve({ data: "", request: { responseURL: url } });
    }
  });

  // 2. Llamar a la función que estamos probando
  await pageLoader(urlToDownload, tempDir);

  // 3. Comprobar que el directorio de recursos se creó
  const assetsDirPath = path.join(tempDir, assetsDirname);
  await expect(fs.stat(assetsDirPath)).resolves.toBeTruthy();

  // 4. Comprobar la existencia y el contenido de la imagen descargada
  const downloadedImagePath = path.join(
    assetsDirPath,
    "codica-la-assets-professions-nodejs.png"
  );
  await expect(fs.stat(downloadedImagePath)).resolves.toBeTruthy(); // Verifica que el archivo existe
  const downloadedImageData = await fs.readFile(downloadedImagePath); // Lee el archivo descargado
  expect(downloadedImageData.equals(fakeImageData)).toBe(true); // Compara Buffers binarios

  // 5. Comprobar la existencia y el contenido del archivo CSS descargado
  const downloadedCssPath = path.join(
    assetsDirPath,
    "codica-la-assets-application.css"
  );
  await expect(fs.stat(downloadedCssPath)).resolves.toBeTruthy();
  const downloadedCssData = await fs.readFile(downloadedCssPath, "utf-8");
  expect(downloadedCssData).toBe(fakeCssData); // Compara strings de texto

  // 6. Comprobar la existencia y el contenido del archivo de script descargado
  const downloadedScriptPath = path.join(
    assetsDirPath,
    "codica-la-packs-js-runtime.js"
  );
  await expect(fs.stat(downloadedScriptPath)).resolves.toBeTruthy();
  const downloadedScriptData = await fs.readFile(downloadedScriptPath, "utf-8");
  expect(downloadedScriptData).toBe(fakeScriptData);

  // Opcional: Comprobar cuántas veces se llamó a axios.get
  // Debería ser 1 (para el HTML) + 3 (para los recursos que mockeamos y deberían descargarse) = 4 llamadas.
  // Si tu test.html tiene más recursos que tu lógica de subdominios descarga, ajusta este número.
  expect(axios.get).toHaveBeenCalledTimes(5);
});
