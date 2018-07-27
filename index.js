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
  constructor(destination, software, company, invoices) {
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
    this.iniFileStream = null;
    this.invoices = invoices;
  }

  async generateBkmFile(companyId, fromDate, toDate) {
    const { firstFolderName, secondFolderName } = this.getFilesPath();
    const foldersPath = `${this.destination}/${firstFolderName}/${secondFolderName}`;
    const uniqueFileId = this.getUniqueValue();
    
    const headerId = 0;    
    let currentLine = 1;
    let C100LinesCount = 0;
    let D110LinesCount = 0;
    let D120LinesCount = 0;

    try {
      await this.createFolders(foldersPath);
      await this.createStreams(foldersPath);

      this.writeA100(uniqueFileId, currentLine, this.company);

      currentLine += 1;

      this.invoices.map((invoice) => {
        this.writeC100();
        C100LinesCount += 1;
        currentLine += 1;
        itemNumber = 1;
      })
    } catch (error) {

    }
  }

  createStreams(foldersPath) {
    this.bkmFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'BKMVDATA.txt'));
    this.iniFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'INI.txt'));
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

    try { 
      await this.writeToBkmStream({ text: A100, maxLength: A100.length, isNumeric: false })
      await this.writeToBkmStream({ text: currentLine,  maxLength: 9,  isNumeric: true })
      await this.writeToBkmStream({ text: company.id, maxLength: 9, isNumeric: true })
      await this.writeToBkmStream({ text: uniqueFile.toString(), maxLength: 15, isNumeric: true });
      await this.writeToBkmStream({ text: '&OF1.31&',  maxLength: 8,  isNumeric: false });
      await this.writeToBkmStream({ text: '', maxLength: 50, isNumeric: false });
      await this.writeToBkmStream({ text: '\r\n', withoutPad: true });
    } catch (error) {
      console.log(`[writeA100] Error: ${error}`);
    }
  }

  async writeC100() {
    if (!this.bkmFileStream) {
      throw new Error('[writeC100] No bkmFileStream')
    }

    try {
      await this.writeToBkmStream({ text: 'C100', withoutPad: true });
      await this.writeToBkmStream({
        
      })
    } catch (error) {

    }
  }

  writeToBkmStream({ 
    text, 
    maxLength, 
    isNumeric, 
    withoutPad = false
  }) {
    try { 
      if (text == null) {
        text = '';
      }

      if (!withoutPad && text.length > maxLength) {
        text = text.substring(0, maxLength);
      }

      const paddedText = withoutPad ? text : leftpad(text, maxLength, isNumeric ? '0' : ' ')
      this.bkmFileStream.write(paddedText);
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Openfrmt;
