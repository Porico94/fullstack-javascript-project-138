import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import fsExtra from 'fs-extra';
import * as cheerio from 'cheerio';
import nock from 'nock';
import downloadPage from '../src/page-loader';

const normalizeHtml = (html) => cheerio.load(html).html().replace(/\s+/g, ' ').trim();

let tempDir;
const fixturesPath = path.join(__dirname, '__fixtures__');

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-test-'));
  nock.disableNetConnect();
});

afterEach(async () => {
  await fsExtra.remove(tempDir);
  nock.cleanAll();
  nock.enableNetConnect();
});

test('Descargar el HTML principal y todos sus recursos(Imágenes, CSS, scripts)', async () => {
  const urlToDownload = 'https://codica.la/cursos';
  const assetsDirname = 'codica-la-cursos_files';
  const assetsDirPath = path.join(tempDir, assetsDirname);

  const originalHtmlFixturePath = path.join(fixturesPath, 'test.html');
  const expectedModifiedHtmlFixturePath = path.join(fixturesPath, 'expected.html');

  const originalHtmlContent = await fs.readFile(originalHtmlFixturePath, 'utf-8');
  const expectedModifiedHtmlContent = await fs.readFile(expectedModifiedHtmlFixturePath, 'utf-8');

  const fakeImageData = Buffer.from(
    'data:image/png;base64,'
    + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8A'
    + 'AAAASUVORK5CYII=',
    'base64',
  );
  const fakeCssData = 'body { background-color: #f0f0f0; } /* Fake CSS content */';
  const fakeScriptData = 'console.log(\'Fake script executed\'); /* Fake JS content */';
  const fakeCanonicalHtmlData = '<html><body>Canonical Link HTML</body></html>';

  nock('https://codica.la')
    .get('/cursos')
    .reply(200, originalHtmlContent)
    .get('/assets/professions/nodejs.png')
    .reply(200, fakeImageData)
    .get('/assets/application.css')
    .reply(200, fakeCssData)
    .get('/packs/js/runtime.js')
    .reply(200, fakeScriptData)
    .get('/cursos.html')
    .reply(200, fakeCanonicalHtmlData);

  await downloadPage(urlToDownload, tempDir);

  const downloadedFileContent = await fs.readFile(
    path.join(tempDir, 'codica-la-cursos.html'),
    'utf-8',
  );

  expect(normalizeHtml(downloadedFileContent)).toBe(normalizeHtml(expectedModifiedHtmlContent));

  await expect(fs.stat(assetsDirPath)).resolves.toBeTruthy();

  const downloadedImagePath = path.join(assetsDirPath, 'codica-la-assets-professions-nodejs.png');
  await expect(fs.stat(downloadedImagePath)).resolves.toBeTruthy();
  const downloadedImageData = await fs.readFile(downloadedImagePath);
  expect(downloadedImageData.equals(fakeImageData)).toBe(true);

  const downloadedCssPath = path.join(assetsDirPath, 'codica-la-assets-application.css');
  await expect(fs.stat(downloadedCssPath)).resolves.toBeTruthy();
  const downloadedCssData = await fs.readFile(downloadedCssPath, 'utf-8');
  expect(downloadedCssData).toBe(fakeCssData);

  const downloadedScriptPath = path.join(assetsDirPath, 'codica-la-packs-js-runtime.js');
  await expect(fs.stat(downloadedScriptPath)).resolves.toBeTruthy();
  const downloadedScriptData = await fs.readFile(downloadedScriptPath, 'utf-8');
  expect(downloadedScriptData).toBe(fakeScriptData);

  const downloadedHtmlPath = path.join(assetsDirPath, 'codica-la-cursos.html');
  await expect(fs.stat(downloadedHtmlPath)).resolves.toBeTruthy();
  const downloadedHtmlData = await fs.readFile(downloadedHtmlPath, 'utf-8');
  expect(downloadedHtmlData).toBe(fakeCanonicalHtmlData);

  expect(nock.isDone()).toBe(true);
});

test('Debería lanzar un error si la solicitud HTTP principal falla', async () => {
  const urlThatFails = 'https://nonexistent.com/page';
  const errorMessage = 'Simulated network error';

  nock('https://nonexistent.com')
    .get('/page')
    .reply(500, errorMessage);

  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlThatFails, tempDir))
    .rejects
    .toThrow('Request failed with status code 500');

  expect(nock.isDone()).toBe(true);
  console.error = originalConsoleError;
});

test('Debería lanzar un error si no puede guardar el archivo HTML', async () => {
  nock.enableNetConnect();
  const urlToDownload = 'https://codica.la/cursos';
  const htmlContent = '<html><body>Contenido de prueba</body></html>';

  nock('https://codica.la').get('/cursos').reply(200, htmlContent);

  const outputDir = '/root';

  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, outputDir))
    .rejects
    .toThrow('EACCES: permission denied, mkdir \'/root/codica-la-cursos_files\'');

  console.error = originalConsoleError;
});

test('Debería lanzar un error si no existe el directorio de recursos', async () => {
  const urlToDownload = 'https://codica.la/cursos';
  const htmlContent = '<html><body>Contenido de prueba</body></html>';

  nock('https://codica.la').get('/cursos').reply(200, htmlContent);

  const mkdirSpy = jest.spyOn(fs, 'mkdir');
  mkdirSpy.mockImplementationOnce(() => {
    const error = new Error('Simulated mkdir permission error');
    error.code = 'EACCES';
    throw error;
  });

  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, tempDir))
    .rejects
    .toThrow('Simulated mkdir permission error');

  mkdirSpy.mockRestore();
  console.error = originalConsoleError;
});

test('Debería lanzar un error si el directorio de salida no existe', async () => {
  const nonExistentDir = path.join(tempDir, 'no-such-dir');
  const htmlContent = '<html><body>Contenido de prueba</body></html>';
  const urlToDownload = 'https://example.com/page';

  nock('https://example.com').get('/page').reply(200, htmlContent);

  const originalConsoleError = console.error;
  console.error = jest.fn();

  await expect(downloadPage(urlToDownload, nonExistentDir))
    .rejects
    .toThrow(`ENOENT: no such file or directory, mkdir '${nonExistentDir}/example-com-page_files'`);

  console.error = originalConsoleError;
});
