import os from "os"; // Para trabajar con directorios temporales del sistema operativo
import path from "path"; // Para manejar rutas de archivos
import fs from "fs/promises"; // Para operaciones asíncronas de sistema de archivos
import fsExtra from "fs-extra"; // Utilidad para borrar directorios temporales (más robusta que fs.rm)
import downloadPage from "../src/page-loader"; // La función que vamos a probar
import * as cheerio from "cheerio"; // Para normalizar HTML y facilitar la comparación
import nock from "nock";

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
  // Crea un directorio temporal único para cada prueba.
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-test-"));
  // Esto asegura que ninguna solicitud HTTP real salga de tu máquina durante las pruebas.
  nock.disableNetConnect();
});

// `afterEach` se ejecuta después de cada prueba individual.
afterEach(async () => {
  // Elimina recursivamente el directorio temporal y todo su contenido.
  await fsExtra.remove(tempDir);
  // Esto previene que los mocks de una prueba afecten a la siguiente.
  nock.cleanAll();
  // Habilita las conexiones de red reales después de cada prueba.
  nock.enableNetConnect();
});

test("Descargar el HTML principal y todos sus recursos(Imágenes, CSS, scripts) correctamente", async () => {
  const urlToDownload = "https://codica.la/cursos"; // url a descargar  
  const assetsDirname = "codica-la-cursos_files"; // Nombre de la carpeta donde estaran los recursos
  const assetsDirPath = path.join(tempDir, assetsDirname); // Ruta completa al directorio

  // Rutas a los archivos de fixture (HTML original y HTML modificado)
  const originalHtmlFixturePath = path.join(fixturesPath, "test.html");
  const expectedModifiedHtmlFixturePath = path.join(fixturesPath, "expected.html");

  // Leemos el contenido de los fixtures
  const originalHtmlContent = await fs.readFile(originalHtmlFixturePath, "utf-8");
  const expectedModifiedHtmlContent = await fs.readFile(expectedModifiedHtmlFixturePath, "utf-8");

  // Datos falsos para los recursos
  // Para la imagen (binario), usamos un Buffer, un pixel transparente PNG
  const fakeImageData = Buffer.from(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  // Para CSS y JS (texto), usamos strings
  const fakeCssData = "body { background-color: #f0f0f0; } /* Fake CSS content */";
  const fakeScriptData = "console.log('Fake script executed'); /* Fake JS content */";
  const fakeCanonicalHtmlData = "<html><body>Canonical Link HTML</body></html>";

  // Configuración del mock de Nock para el HTML principal
  // Intercepta una solicitud GET a "https://codica.la" para la ruta "/cursos"
  nock("https://codica.la")
    // Intercepta la solicitud GET a "https://codica.la/cursos"
    .get("/cursos")
    .reply(200, originalHtmlContent) // Responde con estado 200 y el contenido HTML
    // Intercepta la solicitud GET a la imagen "https://codica.la/assets/professions/nodejs.png"
    .get("/assets/professions/nodejs.png")
    .reply(200, fakeImageData) // Nock maneja Buffers directamente
    // Intercepta la solicitud GET al CSS "https://codica.la/assets/application.css"
    .get("/assets/application.css")
    .reply(200, fakeCssData)
    // Intercepta la solicitud GET al JS "https://codica.la/packs/js/runtime.js"
    .get("/packs/js/runtime.js")
    .reply(200, fakeScriptData)
    // Intercepta la solicitud GET al JS "https://codica.la/cursos.html"
    .get("/cursos.html")
    .reply(200, fakeCanonicalHtmlData); // Responde con HTML básico

  // Llamamos a la función downloadPage
  await downloadPage(urlToDownload, tempDir);

  // Primero, lee el HTML que tu downloadPage guardó
  const downloadedFileContent = await fs.readFile(path.join(tempDir, "codica-la-cursos.html"), "utf-8"); 

  // Comprobamos que el archivo HTML principal tenga el contenido esperado
  expect(normalizeHtml(downloadedFileContent)).toBe(normalizeHtml(expectedModifiedHtmlContent));

  // Comprobamos que el directorio de recursos se creó correctamente
  await expect(fs.stat(assetsDirPath)).resolves.toBeTruthy(); // Verifica que el directorio exista
  
  // Comprobamos la existencia y el contenido de la imagen descargada
  const downloadedImagePath = path.join(assetsDirPath, "codica-la-assets-professions-nodejs.png");
  await expect(fs.stat(downloadedImagePath)).resolves.toBeTruthy(); // Verifica que el archivo existe
  const downloadedImageData = await fs.readFile(downloadedImagePath); // Lee el archivo descargado
  expect(downloadedImageData.equals(fakeImageData)).toBe(true); // Compara Buffers binarios

  // Comprobamos la existencia y el contenido del archivo CSS descargado
  const downloadedCssPath = path.join(assetsDirPath, "codica-la-assets-application.css");
  await expect(fs.stat(downloadedCssPath)).resolves.toBeTruthy(); // Verifica que el archivo existe
  const downloadedCssData = await fs.readFile(downloadedCssPath, "utf-8"); // Lee el archivo descargado
  expect(downloadedCssData).toBe(fakeCssData); // Compara strings de texto

  // Comprobamos la existencia y el contenido del archivo de script descargado
  const downloadedScriptPath = path.join(assetsDirPath, "codica-la-packs-js-runtime.js");
  await expect(fs.stat(downloadedScriptPath)).resolves.toBeTruthy(); // Verifica que el archivo existe
  const downloadedScriptData = await fs.readFile(downloadedScriptPath, "utf-8"); // Lee el archivo descargado
  expect(downloadedScriptData).toBe(fakeScriptData); // Compara strings de texto

  // Comprobamos la existencia y el contenido del archivo de canonical descargado
  const downloadedHtmlPath = path.join(assetsDirPath, "codica-la-cursos.html");
  await expect(fs.stat(downloadedHtmlPath)).resolves.toBeTruthy(); // Verifica que el archivo existe
  const downloadedHtmlData = await fs.readFile(downloadedHtmlPath, "utf-8"); // Lee el archivo descargado
  expect(downloadedHtmlData).toBe(fakeCanonicalHtmlData); // Compara strings de texto

  // Verificar si todos los mocks de Nock fueron usados
  expect(nock.isDone()).toBe(true);
});

test("Debería lanzar un error si la solicitud HTTP principal falla", async () => {
    const urlThatFails = "https://nonexistent.com/page";
    const errorMessage = "Simulated network error";
    
    // Configuración del mock de Nock para un error HTTP
    nock("https://nonexistent.com")
      .get("/page")
      .reply(500, errorMessage); // Simula un error 500 con un mensaje de error

    // Guarda la implementación original de console.error
    const originalConsoleError = console.error;
    // Sobreescribe console.error para que no haga nada durante este test
    console.error = jest.fn();

    await expect(downloadPage(urlThatFails, tempDir))
      .rejects
      .toThrow(`Request failed with status code 500`);

    expect(nock.isDone()).toBe(true);

    // Restaura la implementación original de console.error
    console.error = originalConsoleError;
});

test("Debería lanzar un error si no puede guardar el archivo HTML", async () => {
  // Revertimos la deshabilitación de red solo en este test
  nock.enableNetConnect();

  const urlToDownload = "https://codica.la/cursos";
  const htmlContent = "<html><body>Contenido de prueba</body></html>";
  
  // Mock de la respuesta HTTP
  nock("https://codica.la")
    .get("/cursos")
    .reply(200, htmlContent);

  const outputDir = "/root"; // Directorio que típicamente requiere permisos de superusuario

  // Guardamos y silenciamos temporalmente console.error para evitar ruido en consola
  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, outputDir))
    .rejects
    .toThrow(`EACCES: permission denied, mkdir '/root/codica-la-cursos_files'`);  

  console.error = originalConsoleError; // Restaurar console.error
});

test("Debería lanzar un error si no existe el directorio de recursos", async () => {
 
  const urlToDownload = "https://codica.la/cursos";
  const htmlContent = "<html><body>Contenido de prueba</body></html>";
  
  // Mock de la respuesta HTTP
  nock("https://codica.la")
    .get("/cursos")
    .reply(200, htmlContent);

  // Usamos jest.spyOn para sobrescribir temporalmente la implementación de mkdir.  
  const mkdirSpy = jest.spyOn(fs, 'mkdir');

  // Hacemos que la implementación mockeada de mkdir siempre lance un error
  // para la primera llamada (que será la de downloadResource creando el directorio).
  mkdirSpy.mockImplementationOnce(() => {
    const error = new Error("Simulated mkdir permission error");
    error.code = "EACCES"; // O 'ENOENT', dependiendo de lo que quieras simular
    throw error;
  });
  // Guardamos y silenciamos temporalmente console.error para evitar ruido en consola
  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, tempDir))
    .rejects
    .toThrow(`Simulated mkdir permission error`);  

  mkdirSpy.mockRestore(); // Restauramos mkdir
  console.error = originalConsoleError; // Restaurar console.error
});

test("Debería lanzar un error si el directorio de salida no existe", async () => {
  const nonExistentDir = path.join(tempDir, 'no-such-dir'); // directorio que no existe
  const htmlContent = "<html><body>Contenido de prueba</body></html>";
  const urlToDownload = "https://example.com/page";
  
  // Simulamos una página válida
  nock("https://example.com")
    .get("/page")
    .reply(200, htmlContent);

  // Silenciamos el error en consola para evitar ruido
  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, nonExistentDir))
    .rejects
    .toThrow(`ENOENT: no such file or directory, mkdir '${nonExistentDir}/example-com-page_files'`);

  // Restauramos console.error
  console.error = originalConsoleError;
});