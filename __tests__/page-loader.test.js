import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import fsExtra from 'fs-extra';
import pageLoader from '../src/page-loader';

//Activo el mock de Jest para simular interceptar solicitudes HTTP de axios
jest.mock('axios');

let tempDir;

beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

afterEach(async () => {
  await fsExtra.remove(tempDir);
});

test('descarga una página y la guarda en una ruta especificada', async () => {
    //Simulamos la respuesta de axios.get
    axios.get.mockResolvedValue({ data: '<h1>Hello</h1>' });   

    //Llamamos a pageLoader
    const resultPath = await pageLoader('https://example.com', tempDir);
    
    //Verificamos que el archivo fue creado    
    const fileContent = await fs.readFile(resultPath, 'utf-8');
    expect(fileContent).toBe('<h1>Hello</h1>');
});


test('descarga una página y la guarda en una ruta por default', async () => {
    //Simulamos la respuesta de axios.get
    axios.get.mockResolvedValue({ data: '<h1>Hello</h1>' });

    //Creamos una carpeta temporal en la ruta de los archivos temporales
    const tempDirDefault = await fs.mkdtemp(path.join(process.cwd(), 'page-loader-'));

    //Eliminamos la carpeta temporal en caso ya exista de pruebas anteriores
    await fsExtra.remove(tempDirDefault);
    
    //Llamamos a pageLoader
    const resultPath = await pageLoader('https://example.com');
    
    //Verificamos que el archivo fue creado    
    const fileContent = await fs.readFile(resultPath, 'utf-8');
    expect(fileContent).toBe('<h1>Hello</h1>');

    //Eliminamos la carpeta temporal al terminar el test
    await fsExtra.remove(tempDirDefault);
});

test('Prueba para la falla de solicitud HTTP', async () => {
    //Simulamos la respuesta de axios.get
    axios.get.mockRejectedValue(new Error('Request failed'));
   
    //Esperamos que pageLoader falle       
    expect(await pageLoader('https://example.com', tempDir)).reject.toThrow('Falló la solicitud HTTP')
    
});

test('Prueba para la falla al guardar el archivo', async () => {
    //Simulamos la respuesta de axios.get
    axios.get.mockResolvedValue({ data: '<h1>Hello</h1>' });

    //Esperamos que pageLoader falle
    await expect(pageLoader('https://example.com', '')).rejects.toThrow('No se pudo guardar el archivo');  
});