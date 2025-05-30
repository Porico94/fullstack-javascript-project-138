import { Command } from 'commander';
import pageLoader from './page-loader.js';

const program = new Command();

program
  .name('page-loader')
  .description('Page loader utility')
  .version('1.0.0')
  .option('-o, --output [dir]', 'output dir (default: current dir)', '.')
  .argument('<url>', 'URL to download')
  .action(async (url, options) => {
    try {
      const pathToFile = await pageLoader(url, options.output);
      console.log(`Page saved to: ${pathToFile}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

export default program;
