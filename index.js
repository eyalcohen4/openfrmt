const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const dayjs = require('./dayjs');
const leftpad = require('./left-pad');
// const child_process = require("child_process");
// child_process.execSync(`zip -r DESIRED_NAME_OF_ZIP_FILE_HERE *`, {
//   cwd: PATH_TO_FOLDER_YOU_WANT_ZIPPED_HERE
// });

class Openfrmt {
  /*
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
  constructor({
    destination, 
    software, 
    company, 
    invoices, 
    user,
    dates
  }) {
    this.invoices = invoices;
    this.destination = destination || '';
    this.user = user;
    this.software = software;
    this.company = company;
    this.dates = dates;
    this.b110UserIds = [];

    this.vatRate = 17;

    this.bkmFileStream = null;
    this.iniFileStream = null;

    this.currentFile = 0;
    this.currentBkmvFileLine = 1;
    this.C100LinesCount = 0;
    this.D110LinesCount = 0;
    this.D120LinesCount = 0;
  }

  async generateReport(companyId, fromDate, toDate) {
    console.time();
    this.foldersPath = this.getFoldersFullPath();
    
    const uniqueFileId = this.getUniqueValue();
    const headerId = 0;

    try {
      await this.createFolders(this.foldersPath);
      await this.createStreams(this.foldersPath);

      await this.writeA100(uniqueFileId, this.currentBkmvFileLine, this.user);
      this.currentBkmvFileLine += 1;
      const rows = await this.writeInvoicesRows();
      await this.writeZ900(uniqueFileId, this.currentBkmvFileLine, this.user);

      await this.writeIniFile(uniqueFileId, rows);
    } catch (error) {

    }
  }
  
  getFoldersFullPath() {
    const {
      firstFolderName,
      secondFolderName
    } = this.getFilesPath();

    return `${this.destination}/${firstFolderName}/${secondFolderName}`;
  }

  createStreams(foldersPath) {
    try { 
      this.bkmFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'BKMVDATA.txt'));
      this.iniFileStream = fs.createWriteStream(path.resolve(__dirname, foldersPath, 'INI.txt'));
    } catch (error) {
      console.log(`[createStreams] Error ${error}`);
    }
  }

  getFilesPath() {
    const companyId = this.user.companyId.substring(0, 8);
    const year = new Date().getFullYear().toString().substring(2, 4);
    const firstFolderName = `${companyId}.${year}`;
    const secondFolderName = dayjs().format('MMDDhhmm');

    return {
      firstFolderName,
      secondFolderName
    };
  }

  async writeIniFile(uniqueFileId, rows) {
    try {
      await this.writeA000(uniqueFileId, this.foldersPath)
      await this.writeIniRowsSummaries(rows);
      console.timeEnd();
    } catch (error) {
      console.log(`[writeIniFile] Error: ${error}`);
    }
  }

  async createFolder(folderPath) {
    try {
      await fs.mkdirSync(folderPath);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.log(error);
      }
    }
  }

  async createFolders(paths) {
    const parts = paths.split(path.sep);

    for (let i = 1; i <= parts.length; i++) {
      this.createFolder(path.join.apply(null, parts.slice(0, i)))
    }
  }

  async writeInvoicesRows() {
    try { 
      const invoicesBKMVMetaData = [];

      for (let i = 0; i < this.invoices.length; i++) {
        const currentInvoice = this.invoices[i];
        if (
          currentInvoice && 
          currentInvoice.patient && 
          !this.b110UserIds.includes(currentInvoice.patient.id)
        ) {
          await this.writeB110(this.currentBkmvFileLine, currentInvoice.patient);
          this.b110UserIds.push(currentInvoice.patient.id);
        }

        this.currentBkmvFileLine += 1;

        await this.writeC100(this.currentBkmvFileLine, currentInvoice);
        this.C100LinesCount += 1;
        this.currentBkmvFileLine += 1;

        const d110LinesCount = await this.writeD110(currentInvoice);
        const d120LinesCount = await this.writeD120(currentInvoice);

        invoicesBKMVMetaData[i] = {
          D110: d110LinesCount,
          D120: d120LinesCount
        };
      }

      return invoicesBKMVMetaData;
    } catch (error) {
      console.log(error);
    }
  }

  async writeIniRowsSummaries(rows) {
    try {
      if (!rows || rows && !rows.length) {
        console.log('[writeIniRowsSummaries] No Rows');
        return; 
      }

      const d110Total = rows.reduce((prev, curr) => prev + curr['D110'], 0);
      const d120Total = rows.reduce((prev, curr) => prev + curr['D120'], 0);
      const b110Total = this.b110UserIds && this.b110UserIds.length || 0;

      await this.writeToIniStream({
        text: 'C100',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: this.C100LinesCount,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '\r\n',
        withoutPad: true
      });
      await this.writeToIniStream({
        text: 'B110',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: b110Total,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '\r\n',
        withoutPad: true
      });
      await this.writeToIniStream({
        text: 'D110',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: d110Total,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '\r\n',
        withoutPad: true
      });
      await this.writeToIniStream({
        text: 'D120',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: d120Total,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '\r\n',
        withoutPad: true
      });
    } catch (error) {
      console.log(error);
    }
  }

  async writeA000(uniqueFile, foldersPath) {
    if (!this.iniFileStream) {
      throw new Error('[writeA000] No iniFileStream');
    }

    const {
      street,
      houseNumber,
      city,
      zipCode
    } = this.user.address;
    const fromDate = this.dates && this.dates.fromDate ? dayjs(this.dates.fromDate).format("YYYYMMDD") : '';
    const toDate = this.dates && this.dates.toDate ? dayjs(this.dates.toDate).format("YYYYMMDD") : '';
    const processStartDate = this.dates && this.dates.processStartDate ? dayjs(this.dates.processStartDate).format("YYYYMMDD") : '';
    const processStartHour = this.dates && this.dates.processStartDate ? dayjs(this.dates.processStartDate).format("HHmm") : '';

    try {
      await this.writeToIniStream({
        text: 'A000',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: '',
        maxLength: 5,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: this.currentBkmvFileLine,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: this.company.registrationNumber,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: uniqueFile.toString(),
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '&OF1.31&',
        maxLength: 8,
        isNumeric: false,
        ignoreDot: true
      });
      /** 1006 */
      await this.writeToIniStream({
        text: this.software.registrationNumber,
        maxLength: 8,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: this.software.name,
        maxLength: 20,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: this.software.version,
        maxLength: 20,
        isNumeric: false,
        ignoreDot: true
      });
      await this.writeToIniStream({
        text: this.company.registrationNumber,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: this.company.name,
        maxLength: 20,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: this.software.multyear ? 2 : 1,
        maxLength: 1,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: foldersPath,
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: 0,
        maxLength: 1,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: 0,
        maxLength: 1,
        isNumeric: true
      });
      /** 1015 */
      await this.writeToIniStream({
        text: this.user.companyId,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '',
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '',
        maxLength: 10,
        isNumeric: false
      });

      await this.writeToIniStream({
        text: this.user.name,
        maxLength: 50,
        isNumeric: false
      });

      await this.writeToIniStream({
        text: street || '',
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: houseNumber || '',
        maxLength: 10,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: city || '',
        maxLength: 30,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: zipCode || '',
        maxLength: 8,
        isNumeric: false
      });

      await this.writeToIniStream({
        text: dayjs().format('YYYY'),
        maxLength: 4,
        isNumeric: true
      });

      await this.writeToIniStream({
        text: fromDate,
        maxLength: 8,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: toDate,
        maxLength: 8,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: processStartDate,
        maxLength: 8,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: processStartHour,
        maxLength: 4,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '0',
        maxLength: 1,
        isNumeric: true
      });
      /* 1029 */
      await this.writeToIniStream({
        text: '1',
        maxLength: 1,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: 'zip',
        maxLength: 20,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: 'ILS',
        maxLength: 3,
        isNumeric: false
      });
      await this.writeToIniStream({
        text: '0',
        maxLength: 1,
        isNumeric: true
      });
      await this.writeToIniStream({
        text: '',
        maxLength: 46,
        isNumeric: false
      });

      await this.writeToIniStream({
        text: '\r\n',
        withoutPad: true
      });
    } catch (error) {
      console.log(`[writeA000] Error: ${error}`);
    }
  }

  async writeA100(uniqueFile, currentLine, company) {
    const A100 = 'A100';

    if (!this.bkmFileStream) {
      throw new Error('[writeA100] No bkmFileStream')
    }

    try {
      await this.writeToBkmStream({
        text: A100,
        maxLength: A100.length,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: this.user.companyId,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: uniqueFile.toString(),
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: '&OF1.31&',
        maxLength: 8,
        isNumeric: false,
        ignoreDot: true
      });
      await this.writeToBkmStream({
        text: '',
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });
    } catch (error) {
      console.log(`[writeA100] Error: ${error}`);
    }
  }

  async writeZ900(uniqueFile, currentLine) {
    if (!this.bkmFileStream) {
      throw new Error('[writeZ900] No bkmFileStream')
    }

    try {
      await this.writeToBkmStream({
        text: 'Z900',
        maxLength: 4,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: this.user.companyId,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: uniqueFile.toString(),
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: '&OF1.31&',
        maxLength: 8,
        isNumeric: false,
        ignoreDot: true,
      });
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 15,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: '',
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });
    } catch (error) {
      console.log(`[writeA100] Error: ${error}`);
    }
  }

  async writeB110(currentLine, patient) {
    if (!this.bkmFileStream) {
      throw new Error('[writeB110] No bkmFileStream')
    }

    const {
      street,
      houseNumber,
      city,
      zipCode,
      country,
      countryCode
    } = patient.address;

    try {
      /* 1400 */
      await this.writeToBkmStream({
        text: 'B110',
        withoutPad: true
      });
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: this.user.companyId,
        maxLength: 9,
        isNumeric: true,
        withoutPad: true
      });
      await this.writeToBkmStream({
        text: patient.id,
        maxLength: 15,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: patient.name,
        maxLength: 50,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: 'קוד מאזן בוחן',
        maxLength: 15,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: patient.name,
        maxLength: 30,
        isNumeric: false,
      });

      await this.writeToBkmStream({
        text: street || '',
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: houseNumber || '',
        maxLength: 10,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: city || '',
        maxLength: 30,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: zipCode || '',
        maxLength: 8,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: country || '',
        maxLength: 30,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: countryCode || '',
        maxLength: 2,
        isNumeric: false
      });

      /* 1413 */
      await this.writeToBkmStream({
        text: '',
        maxLength: 15,
        isNumeric: false
      });

      await this.writeToBkmStream({
        text: 0.00,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });
      await this.writeToBkmStream({
        text: 0.00,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });
      await this.writeToBkmStream({
        text: 0.00,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });
      await this.writeToBkmStream({
        text: null,
        maxLength: 4,
        isNumeric: true,
      });
      await this.writeToBkmStream({
        text: patient.authorizedId || patient.id,
        maxLength: 9,
        isNumeric: true,
      });
      await this.writeToBkmStream({
        text: null,
        maxLength: 7,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: 0.00,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });
      await this.writeToBkmStream({
        text: 'ILS',
        maxLength: 3,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: '',
        maxLength: 16,
        isNumeric: false,
      });

      // Last Row
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });
      
    } catch (error) {
      console.log(`[writeB110] Error ${error}`)
    }
  }

  async writeC100(currentLine, invoice) {
    if (!this.bkmFileStream) {
      throw new Error('[writeC100] No bkmFileStream')
    }

    try {
      const creationDate = invoice.creationDate ? dayjs(invoice.creationDate).format("YYYYMMDD") : '';
      const creationTime = invoice.creationDate ? dayjs(invoice.creationDate).format("HHmm") : '';
      const documentDate = invoice.documentDate ? dayjs(invoice.documentDate).format("YYYYMMDD") : '';
      const incomeBeforeDiscount = this.getTotalIncomeBeforeDiscount(invoice);
      console.log(incomeBeforeDiscount);

      const discountAmount = (
        invoice.discount ? 
        this.calculateDiscount(invoice.discount, incomeBeforeDiscount) : 
        0
      );
      const discountSign = discountAmount && discountAmount > 0 ? '-' : '+';
      const incomeAfterDiscount = this.financial(incomeBeforeDiscount - discountAmount);
      const vat = this.calculateVat({ 
        incomes: invoice.incomes, 
        total: incomeAfterDiscount,
        vatType: invoice.vatType
      });
      const totalIncomePlusVat = this.financial(parseInt(incomeAfterDiscount) + parseInt(vat));

      const {
        street,
        houseNumber,
        city,
        zipCode,
        country,
        countryCode
      } = invoice.patient.address;

      await this.writeToBkmStream({
        text: 'C100',
        withoutPad: true
      });
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: this.user.companyId,
        maxLength: 9,
        isNumeric: true,
        withoutPad: true
      });
      await this.writeToBkmStream({
        text: invoice.type,
        maxLength: 3,
        isNumeric: true,
        withoutPad: true
      });
      await this.writeToBkmStream({
        text: invoice.serialNumber,
        maxLength: 20,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: creationDate,
        maxLength: 8,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: creationTime,
        maxLength: 4,
        isNumeric: true
      });
      
      /* 1207 */
      await this.writeToBkmStream({
        text: invoice.patient.name,
        maxLength: 50,
        isNumeric: false
      });

      
      await this.writeToBkmStream({
        text: street || '',
        maxLength: 50,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: houseNumber || '',
        maxLength: 10,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: city || '',
        maxLength: 30,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: zipCode || '',
        maxLength: 8,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: country || '',
        maxLength: 30,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: countryCode || '',
        maxLength: 2,
        isNumeric: false
      });

      await this.writeToBkmStream({
        text: invoice.patient.phone,
        maxLength: 15,
        isNumeric: false
      });
      await this.writeToBkmStream({
        text: invoice.patient.authorizedId || '',
        maxLength: 9,
        isNumeric: true
      });
    
      /* 1216 */
      await this.writeToBkmStream({
        text: documentDate,
        maxLength: 8,
        isNumeric: true
      });

      await this.writeToBkmStream({
        text: '',
        maxLength: 15,
        isNumeric: false,
      });
      await this.writeToBkmStream({
        text: 'ILS',
        maxLength: 3,
        isNumeric: false,
        withoutPad: true
      });

      await this.writeToBkmStream({
        text: incomeBeforeDiscount,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });

      /* 1220 */
      await this.writeToBkmStream({
        text: discountAmount || 0,
        maxLength: 15,
        isNumeric: true,
        sign: discountSign
      });

      await this.writeToBkmStream({
        text: incomeAfterDiscount,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });

      await this.writeToBkmStream({
        text: vat,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });

      /* 1223 */
      await this.writeToBkmStream({
        text: totalIncomePlusVat,
        maxLength: 15,
        isNumeric: true,
        sign: '+'
      });

      
      await this.writeToBkmStream({
        text: '0',
        maxLength: 12,
        isNumeric: true,
        sign: '+'
      });

      /* 1225 */
      await this.writeToBkmStream({
        text: invoice.patient.id,
        maxLength: 15,
        isNumeric: false,
      });

      await this.writeToBkmStream({
        text: '',
        maxLength: 10,
        isNumeric: false,
      });

      await this.writeToBkmStream({
        text: invoice.isCancelled ? 1 : 0,
        maxLength: 1,
        isNumeric: false,
      });

      /* 1230 */
      await this.writeToBkmStream({
        text: documentDate,
        maxLength: 8,
        isNumeric: true,
      });

      await this.writeToBkmStream({
        text: null,
        maxLength: 7,
        isNumeric: false,
      });
      
      await this.writeToBkmStream({
        text: null,
        maxLength: 9,
        isNumeric: false,
      });

      await this.writeToBkmStream({
        text: invoice.serialNumber,
        maxLength: 7,
        isNumeric: true,
      });
      
      await this.writeToBkmStream({
        text: ' ',
        maxLength: 60,
        isNumeric: false,
      });

      // Last Row
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });


    } catch (error) {
      console.log(error);
    }
  }

  async writeD110(invoice) {
    if (!this.bkmFileStream) {
      throw new Error('[writeD110] No bkmFileStream');
    }

    const { income } = invoice;
    let linesCount = 0;

    if (!income || (income && !income.length)) {
      console.log('[writeD110] No income rows in invoice');
      return 0;
    }

    
    for (let index = 0; index < income.length; index++) {
      // Loop & write d110 line for each item
      const currentIncome = income[index];
      const paddedQuantity = currentIncome.quantity && currentIncome.quantity.toString().padEnd(6 - currentIncome.quantity.toString().length , '0');
      const documentDate = invoice.documentDate ? dayjs(invoice.documentDate).format("YYYYMMDD") : '';

      try { 
        await this.writeToBkmStream({
          text: 'D110',
          withoutPad: true
        });
        await this.writeToBkmStream({
          text: this.currentBkmvFileLine,
          maxLength: 9,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: this.user.companyId,
          maxLength: 9,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: invoice.type,
          maxLength: 9,
          isNumeric: true,
          withoutPad: true
        });

        /* 1254 */
        await this.writeToBkmStream({
          text: invoice.serialNumber,
          maxLength: 20,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: index + 1,
          maxLength: 4,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 3,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 20,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: 1,
          maxLength: 1,
          isNumeric: true
        });

        await this.writeToBkmStream({
          text: '',
          maxLength: 20,
          isNumeric: false
        });

        /* 1260 */
        await this.writeToBkmStream({
          text: currentIncome.description,
          maxLength: 30,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 50,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 30,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: 'יחידה',
          maxLength: 20,
          isNumeric: false
        });

        await this.writeToBkmStream({
          text: paddedQuantity,
          maxLength: 17,
          isNumeric: true,
          sign: '+'
        });

        await this.writeToBkmStream({
          text: this.financial(currentIncome.price),
          maxLength: 15,
          isNumeric: true,
          sign: '+'
        });

        await this.writeToBkmStream({
          text: '',
          maxLength: 15,
          isNumeric: true,
          sign: '-'
        });

        /** 1267 */
        await this.writeToBkmStream({
          text: this.financial(currentIncome.price * currentIncome.quantity) || 0.00,
          maxLength: 15,
          isNumeric: true,
          sign: '+'
        });
        await this.writeToBkmStream({
          text: this.financial(this.vatRate),
          maxLength: 4,
          isNumeric: true,
          withoutPad: true
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 7,
          isNumeric: false,
        });
        await this.writeToBkmStream({
          text: documentDate,
          maxLength: 8,
          isNumeric: true,
        });
        await this.writeToBkmStream({
          text: invoice.serialNumber,
          maxLength: 7,
          isNumeric: true,
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 21,
          isNumeric: false,
        });

        // Last Row
        await this.writeToBkmStream({
          text: '\r\n',
          withoutPad: true
        });

        linesCount += 1;
        this.currentBkmvFileLine += 1;
      } catch (error) {
        console.log(`[writeD100] Error: ${error}`);
      }
    }

    return linesCount;
  }

  async writeD120(invoice) {
    if (!this.bkmFileStream) {
      throw new Error('[writeD120] No bkmFileStream');
    }

    const { payment } = invoice;
    let linesCount = 0;

    if (!payment || (payment && !payment.length)) {
      console.log('[writeD120] No payment rows in invoice');
      return 0;
    }

    
    for (let index = 0; index < payment.length; index++) {
      // Loop & write d120 line for each paymnet

      const currentPayment = payment[index];
      const documentDate = invoice.documentDate ? dayjs(invoice.documentDate).format("YYYYMMDD") : '';
      const paymentDate = currentPayment.date ? dayjs(currentPayment.date).format("YYYYMMDD") : '';

      try { 
        await this.writeToBkmStream({
          text: 'D120',
          withoutPad: true
        });
        await this.writeToBkmStream({
          text: this.currentBkmvFileLine,
          maxLength: 9,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: this.user.companyId,
          maxLength: 9,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: invoice.type,
          maxLength: 3,
          isNumeric: true,
          withoutPad: true
        });
        await this.writeToBkmStream({
          text: invoice.serialNumber,
          maxLength: 20,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: index + 1,
          maxLength: 4,
          isNumeric: true
        });
        /** 1306 */
        await this.writeToBkmStream({
          text: currentPayment.type,
          maxLength: 1,
          isNumeric: true
        });

        await this.writeToBkmStream({
          text: currentPayment.bankNumber || '',
          maxLength: 10,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: currentPayment.bankBranch || '',
          maxLength: 10,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: currentPayment.bankAccount || '',
          maxLength: 15,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: currentPayment.chequeNum || '',
          maxLength: 10,
          isNumeric: true
        });

        await this.writeToBkmStream({
          text: currentPayment.type === 2 || currentPayment.type === 3 ? paymentDate : '',
          maxLength: 8,
          isNumeric: true
        });

        /* 1312 */
        await this.writeToBkmStream({
          text: this.financial(currentPayment.price),
          maxLength: 15,
          isNumeric: true,
          sign: '+'
        });

        await this.writeToBkmStream({
          text: currentPayment.cardType || '',
          maxLength: 1,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 20,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: currentPayment.dealType || '',
          maxLength: 1,
          isNumeric: true
        });

        await this.writeToBkmStream({
          text: '',
          maxLength: 7,
          isNumeric: false
        });
        await this.writeToBkmStream({
          text: documentDate,
          maxLength: 8,
          isNumeric: true
        });

        await this.writeToBkmStream({
          text: invoice.serialNumber,
          maxLength: 7,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: '',
          maxLength: 60,
          isNumeric: false
        });

        // Last Row
        await this.writeToBkmStream({
          text: '\r\n',
          withoutPad: true
        });

        this.currentBkmvFileLine += 1;
        linesCount += 1;
      } catch (error) {
        console.log(`[writeD120] Error: ${error}`);
      }
    }

    return linesCount;
  }

  calculateDiscount(discount, total) {
    if (!discount || !discount.type) {
      throw new Error('[calculateDiscount] No discount / discount type')
    }

    if (discount.type === 'percentage') {
      return this.financial(((total / 100) * discount.amount))
    }

    // Fixed Value
    return this.financial(discount.amount);
  }

  getUniqueValue(seed) {
    return Math.floor((1 + Math.random()) * 1000000000000000)
  }

  calculateIncomeAfterDiscount(discount, total) {
    const incomeAfterDiscount = total - this.calculateDiscount(discount, total);
    return this.financial(incomeAfterDiscount)
  }

  getTotalIncomeBeforeDiscount(invoice) {
    if (invoice.income && invoice.income.length) {
      let total = 0;

      for (let i = 0; i < invoice.income.length; i++) {
        const { price, quantity } = invoice.income[i];

        if (!price) {
          throw new Error('[getTotalIncomeBeforeDiscount] No price provided in income');
        }

        total += price * (quantity || 1)
      }

      return this.financial(total);
    } 

    if (invoice.payment && invoice.payment.length) {
      let total = invoice.payment.reduce((prev, current) => prev + current.price, 0);

      return this.financial(total);
    }
  }

  calculateVat({
    incomes = [],
    total = 0,
    vatType = 0
  }) {
    // Exampt (VAT Free)
    if (vatType === 1) {
      return 0.00;
    }

    if (vatType === 0) {
      return this.financial(((total / 100) * this.vatRate));
    }

    /* TODO: Figure out how to calculate vat per row */
    // calculate vat per income row and type
    if (vatType === 2) {
      const vatToPercent = ((parseFloat(this.vatRate) + 100) / 100);
      return total - (total - (total / vatToPercent));
    }
  }
  
  financial(num) {
    return Number.parseFloat(num).toFixed(2);
  }

  async conditonalWritingToBkmStream(condition, settings) {
    try {
      if (condition) {
        await this.writeToBkmStream(settings);
      }
    } catch (error) {
      console.log(`[conditionalWritingToBkmStream] Error: ${error}`)
    }
  }

  async conditionalWritingToIniStream(condition, settings) {
    try {
      if (condition) {
        await this.writeToIniStream(settings);
      }
    } catch (error) {
      console.log(`[conditionalWritingToIniStream] Error: ${error}`)
    }
  }

  async writeToBkmStream({
    text,
    maxLength,
    isNumeric,
    withoutPad = false,
    rightPad = false,
    ignoreDot = false,
    sign = '',
    logDebug = false
  }) {
    try {
      if (logDebug) {
        console.log(text);
      }

      if (text === null || typeof text === 'undefined' || text === undefined) {
        text = '';
      }

      if (!withoutPad && text && text.length > maxLength) {
        text = text.substring(0, maxLength);
      }

      // For floating numbers
      if (!ignoreDot && text && `${text}`.includes('.')) {
        text = `${text}`.replace('.', '');
      }

      if (!withoutPad) {
        if (rightPad) {
          text = text.padEnd(text, sign ? maxLength - 1 : maxLength, isNumeric ? '0' : ' '); 
        } else {
          text = leftpad(text, sign ? maxLength - 1 : maxLength , isNumeric ? '0' : ' ')
        }
      }

      const encoded = iconv.encode(sign ? `${sign}${text}` : text, 'ISO-8859-8');
      await this.bkmFileStream.write(encoded);
    } catch (error) {
      console.log(error);
    }
  }

  async writeToIniStream({
    text,
    maxLength,
    isNumeric,
    withoutPad = false,
    rightPad = false,
    ignoreDot = false,
    sign = ''
  }) {
    try {
      if (text === null || typeof text === 'undefined' || text === undefined) {
        text = '';
      }

      if (!withoutPad && text && text.length > maxLength) {
        text = text.substring(0, maxLength);
      }

      // For floating numbers
      if (!ignoreDot && text && `${text}`.includes('.')) {
        text = `${text}`.replace('.', '');
      }

      if (!withoutPad) {
        if (rightPad) {
          text = text.padEnd(text, sign ? maxLength - 1 : maxLength, isNumeric ? '0' : ' '); 
        } else {
          text = leftpad(text, sign ? maxLength - 1 : maxLength , isNumeric ? '0' : ' ')
        }
      }

      const encoded = iconv.encode(sign ? `${sign}${text}` : text, 'ISO-8859-8');
      await this.iniFileStream.write(encoded);
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Openfrmt;
