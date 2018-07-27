const fs = require('fs');
const path = require('path');
const dayjs = require('./dayjs');
const leftpad = require('./left-pad');

class Openfrmt {
  /**
   * Openfrmt module for ITA registered software
   * 
   * @class Openfrmt
   * 
   * @typedef {Object} Software
   *  @property {string} name
   *  @property {string} version,
   *  @property {string} id

   * @typedef Company
   *  @property {string} name
   *  @property {string} version
   * 
   * @param {string} destination 
   * @param {Software} software 
   * @param {Company} company 
   */
  constructor(destination, software, company) {
    this.destination = destination || '';
    this.software = {
      name: software.name,
      version: software.version,
      id: software.id
    }
    this.company = {
      name: company.name,
      id: company.id
    }

    this.bkmFileStream = null;
    this.iniFileStream = null
  }

  async generateBkmFile(companyId, fromDate, toDate) {
    const { firstFolderName, secondFolderName } = this.getFilesPath();
    const foldersPath = `${this.destination}/${firstFolderName}/${secondFolderName}`;
    
    const headerId = 0;
    
    let currentLine = 1;
    let C100LinesCount = 0;
    let D110LinesCount = 0;
    let D120LinesCount = 0;

    try {
      const uniqueFileId = this.getUniqueValue();
      await this.createFolders(foldersPath);
      this.bkmFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'BKMVDATA.txt'));
      this.iniFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'INI.txt'));
      this.writeA100(uniqueFileId, currentLine, this.company);
    } catch (error) {

    }
    // const iniFile = '';
  }

  getFilesPath() {
    const companyId = this.company.id.substring(0, 8);
    const year = new Date().getFullYear().toString().substring(2, 4);
    const firstFolderName = `${this.company.id}.${year}`;
    const secondFolderName = dayjs().format('MMDDhhmm');
    
    return { firstFolderName, secondFolderName };
  }

  async createFolder(folderPath) {
    try {
      await fs.mkdirSync(folderPath);
    } catch (error) {
      if (error.code !== 'EEXIST')  { 
        console.log(error);
      }
    }
  }

  async createFolders(paths) {
    const parts = paths.split(path.sep)
    
    for (let i = 1; i <= parts.length; i++) {
      this.createFolder(path.join.apply(null, parts.slice(0, i)))
    }
  }

  getUniqueValue(seed) {
    return Math.floor((1 + Math.random()) * 1000000000000000)
  }



  async writeA100(uniqueFile, currentLine, company) {
    const A100 = 'A100';
    if (!this.bkmFileStream) {
      throw new Error('[writeA100] No bkmFileStream')
    }

    await this.writeToBkmStream(A100, A100.length, false)
    await this.writeToBkmStream(currentLine, 9, true)
    await this.writeToBkmStream(company.id, 9, true)
    await this.writeToBkmStream(uniqueFile.toString(), 15, true);
    await this.writeToBkmStream('&OF1.31&', 8, false);
    await this.writeToBkmStream('', 50, false);
  }

  writeToBkmStream(text, maxLength, isNumeric) {
    try { 
      if (text == null) {
        text = '';
      }

      if (text.length > maxLength) {
        text = text.substring(0, maxLength);
      }

      const paddedText = leftpad(text, maxLength, isNumeric ? '0' : ' ')
      this.bkmFileStream.write(paddedText);
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Openfrmt;
