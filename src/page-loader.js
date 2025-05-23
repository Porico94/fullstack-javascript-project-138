import fs from 'fs/promises';
import path from 'path';
import downloadImage from './download-image.js';

const cleanFilename = (url) => {
  const deleteProtocol = url.replace(/^https?:\/\//, '');
  return deleteProtocol.replace(/[^a-zA-Z0-9]/g, '-') + '.html';
};

const pageLoader = async (url, outputDir = process.cwd()) => {
  const filename = cleanFilename(url);
  const filePath = path.join(outputDir, filename);

  let htmlModified;
  try {
    htmlModified = await downloadImage(url);    
  } catch(err) {
    console.error('Error real:', err.message);
    throw new Error('Falló la solicitud HTTP');
  }

  try {
    await fs.writeFile(filePath, htmlModified);
  } catch(err) {
    console.error('Error real:', err.message);
    throw new Error('no se pudo guardar el archivo');
  }  
     
  return filePath;
};

export default pageLoader;
