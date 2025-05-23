import os from "os";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import fsExtra from "fs-extra";
import pageLoader from "../src/page-loader";
import { fail } from "assert";

//Activo el mock de Jest para simular interceptar solicitudes HTTP de axios
jest.mock("axios");

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader"));
});

afterEach(async () => {
  await fsExtra.remove(tempDir);
});

test("Probamos si el contenido y la ruta del archivo es el correcto", async () => {
  //Simulamos la respuesta de axios.get
  const htmlPath = path.join(__dirname, "__fixtures__", "test.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  axios.get.mockResolvedValue({ data: html });

  //Llamamos a pageLoader
  const resultPath = await pageLoader("https://example.com", tempDir);
  const fileContent = await fs.readFile(resultPath, "utf-8");

  //Llamamos al archivo que esperemos recibir como resultado
  const expectedHtmlPath = path.join(
    __dirname,
    "__fixtures__",
    "expected.html"
  );
  const expectedHtml = await fs.readFile(expectedHtmlPath, "utf-8");
  //Comprobamos si el contenido del archivo es el correcto
  expect(fileContent).toBe(expectedHtml);

  //Comprobaremos si la ruta donde esta guardado el archivo es correcta
  const expectedPath = path.join(tempDir, "example-com.html");
  expect(resultPath).toBe(expectedPath);
});

test("Probamos si el contenido y la ruta del archivo por default es el correcto", async () => {
  // Simulamos process.cwd() para que devuelva una ruta temporal controlada
  const mockCwd = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-cwd-"));
  const originalCwd = process.cwd;
  process.cwd = () => mockCwd;

  //Usamos la ruta para ingresar a fixtures y usar test.html
  const htmlPath = path.join(__dirname, "__fixtures__", "test.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  axios.get.mockResolvedValue({ data: html });

  //Llamamos a pageLoader
  const resultPath = await pageLoader("https://example.com");

  //Llamamos al archivo que esperemos recibir como resultado
  const expectedHtmlPath = path.join(
    __dirname,
    "__fixtures__",
    "expected.html"
  );
  const expectedHtml = await fs.readFile(expectedHtmlPath, "utf-8");

  //Verificamos que el contenido del archivo sea el mismo
  const fileContent = await fs.readFile(resultPath, "utf-8");
  expect(fileContent).toBe(expectedHtml);

  //Comprobamos si la ruta donde esta guardado el archivo es correcta
  const expectedPath = path.join(mockCwd, "example-com.html");
  expect(resultPath).toBe(expectedPath);

  //Regresamos la funcion de process.cwd a su funcion original
  await fsExtra.remove(mockCwd);
  process.cwd = originalCwd; // restauramos el original
});

test("Probamos si se crea la carpeta y se descargan las imagenes de la manera correcta", async () => {
  //Simulamos la respuesta de axios.get
  const htmlPath = path.join(__dirname, "__fixtures__", "test.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  //Simulamos la respuesta del HTML y luego de la imagen
  axios.get
    .mockResolvedValueOnce({ data: html }) // 1° llamada: HTML
    .mockResolvedValueOnce({ data: Buffer.from("fake-image-content") }); // 2° llamada: imagen

  //Ejecutamos pageLoader
  await pageLoader("https://codica.la/cursos", tempDir);

  //Verificamos que se haya creado la carpeta
  const expectedFolder = path.join(tempDir, "codica-la-cursos_files");
  let folderExists;

  try {
    folderExists = await fs.stat(expectedFolder);
  } catch (e) {
    if (e.code === "ENOENT") {
      fail("La carpeta no existe");
    } else {
      throw e;
    }
  }

  //Verificamos que el directorio si existe
  expect(folderExists.isDirectory()).toBe(true);

  //Verificamos que la imagen esté dentro con el contenido correcto
  const imagePath = path.join(
    expectedFolder,
    "codica-la-assets-professions-nodejs.png"
  );
  const imageContent = await fs.readFile(imagePath, "utf-8");
  expect(imageContent).toBe("fake-image-content");
});

test("Probamos si se crea la carpeta y se descargan las imagenes de la manera correcta", async () => {
  //Simulamos la respuesta de axios.get
  const htmlPath = path.join(__dirname, "__fixtures__", "test.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  //Simulamos la respuesta del HTML y luego de la imagen
  axios.get
    .mockResolvedValueOnce({ data: html }) // 1° llamada: HTML
    .mockRejecteddValueOnce(new Error("Fallo la descarga de la imagen")); // 2° llamada: falló descarga imagen

  //Ejecutamos pageLoader
  const resultPath = await pageLoader("https://codica.la/cursos", tempDir);
  //Leemos el archivo resultante
  const resultHtml = await fs.readFile(resultPath, "utf-8");

  const expectedHtmlPath = path.join(
    __dirname,
    "__fixtures__",
    "expected.html"
  );
  const expectedHtml = await fs.readFile(expectedHtmlPath, "utf-8");

  //Comparamos que el html sea el correcto
  expect(resultHtml).toBe(expectedHtml);

  //Verificamos que se creo la carpeta
  const expectedFolder = path.join(tempDir, "codica-la-cursos_files");
  let folderExists;
  try {
    folderExists = await fs.stat(expectedFolder);
  } catch (e) {
    if (e.code === "ENOENT") {
      fail("La carpeta no existe");
    } else {
      throw e;
    }
  }
  expect(folderExists.isDirectory()).toBe(true);
});

test("Prueba para la falla de solicitud HTTP", async () => {
  //Simulamos la respuesta de axios.get
  axios.get.mockRejectedValue(new Error("Request failed"));

  //Esperamos que pageLoader falle
  expect(await pageLoader("https://example.com", tempDir)).reject.toThrow(
    "Falló la solicitud HTTP"
  );
});

test("Prueba para la falla al guardar el archivo", async () => {
  //Simulamos la respuesta de axios.get
  axios.get.mockResolvedValue({ data: "<h1>Hello</h1>" });

  //Esperamos que pageLoader falle
  await expect(pageLoader("https://example.com", "")).rejects.toThrow(
    "No se pudo guardar el archivo"
  );
});
