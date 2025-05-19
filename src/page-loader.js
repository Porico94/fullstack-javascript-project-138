import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const cleanFilename = (url) => {
  const deleteProtocol = url.replace(/^https?:\/\//, '');
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, '-') + '.html';
};

const pageLoader = async (url, outputDir = process.cwd()) => {
  const filename = cleanFilename(url);
  const filePath = path.join(outputDir, filename);

  let data;
  try {
    const reponse = await axios.get(url);
    data = reponse.data;
  } catch {
    throw new Error('Falló la solicitud HTTP');
  }

  try {
    await fs.writeFile(filePath, data);
  } catch {
    throw new Error('no se pudo guardar el archivo');
  }  
     
  return filePath;
};

export default pageLoader;
