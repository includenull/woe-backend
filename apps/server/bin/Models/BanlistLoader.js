import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { delay } from '@utils/utils.js'
import logger from '@utils/logger.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default class BanlistLoader {
  constructor(origin) {
    this.origin = origin
    this.filePath = path.join(serverRoot, 'banlist.js');
    this.lastModifiedTime = 0;
    this.loadedContent = null;
    this.isLoading = false
  }

  async loadFile() {
    try {
      const stats = fs.statSync(this.filePath);
      const modifiedTime = stats.mtimeMs;

      if (modifiedTime != this.lastModifiedTime) {
        this.isLoading = true
        // Clear the module cache by using a dynamic import with a cache buster
        const modulePath = `${this.filePath}?update=${Date.now()}`;
        const newModule = await import(`file://${modulePath}`);

        this.loadedContent = newModule.default;
        this.lastModifiedTime = modifiedTime;
        this.isLoading = false;

        logger.info(`Reloaded banlist of ${this.origin } from ${this.filePath}`);
      }

      return this.loadedContent;
    } catch (err) {
      logger.warn(`Failed to reload file: ${err.message}`);
      return this.loadedContent;
    }
  }

  async getContent() {
    while(this.isLoading)
      await delay(50);

    return await this.loadFile();
  }
}
