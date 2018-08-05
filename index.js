const fs = require('fs');
const path = require('path');
const dayjs = require('./dayjs');
const leftpad = require('./left-pad');

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
  constructor(destination, software, company, invoices) {
    this.invoices = invoices;
    this.destination = destination || '';
    this.vatRate = 17;
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

    this.currentFile = 0;
    this.currentLine = 1;
    this.C100LinesCount = 0;
    this.D110LinesCount = 0;
    this.D120LinesCount = 0;
  }

  async generateBkmFile(companyId, fromDate, toDate) {
    const {
      firstFolderName,
      secondFolderName
    } = this.getFilesPath();
    const foldersPath = `${this.destination}/${firstFolderName}/${secondFolderName}`;
    const uniqueFileId = this.getUniqueValue();

    const headerId = 0;

    try {
      await this.createFolders(foldersPath);
      await this.createStreams(foldersPath);

      await this.writeA100(uniqueFileId, this.currentLine, this.company);

      this.currentLine += 1;

      await this.writeInvoicesTitleRow();
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

    return {
      firstFolderName,
      secondFolderName
    };
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
    const parts = paths.split(path.sep)

    for (let i = 1; i <= parts.length; i++) {
      this.createFolder(path.join.apply(null, parts.slice(0, i)))
    }
  }

  getUniqueValue(seed) {
    return Math.floor((1 + Math.random()) * 1000000000000000)
  }

  async writeInvoicesTitleRow() {
    for (let i = 0; i < this.invoices.length; i++) {
      let itemNumber = 1;
      await this.writeC100(this.currentLine, this.invoices[i]);
      console.count('C100')
      this.C100LinesCount += 1;
      this.currentLine += 1;

      await this.writeD110(this.currentLine, this.invoices[i]);
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
        text: company.id,
        maxLength: 9,
        isNumeric: true
      });
      await this.writeToBkmStream({
        text: uniqueFile.toString(),
        maxLength: 15,
        isNumeric: true
      });;
      await this.writeToBkmStream({
        text: '&OF1.31&',
        maxLength: 8,
        isNumeric: false
      });;
      await this.writeToBkmStream({
        text: '',
        maxLength: 50,
        isNumeric: false
      });;
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });;
    } catch (error) {
      console.log(`[writeA100] Error: ${error}`);
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
      const incomeBeforeDiscount = this.getTotalIncomeBeforeDiscount(invoice.income);
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
      });;
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
      });;
      await this.writeToBkmStream({
        text: currentLine,
        maxLength: 9,
        isNumeric: true
      });;
      await this.writeToBkmStream({
        text: this.company.id,
        maxLength: 9,
        isNumeric: true,
        withoutPad: true
      });;
      await this.writeToBkmStream({
        text: invoice.type,
        maxLength: 9,
        isNumeric: true,
        withoutPad: true
      });;
      await this.writeToBkmStream({
        text: invoice.serialNumber,
        maxLength: 20,
        isNumeric: true
      });;
      await this.writeToBkmStream({
        text: creationDate,
        maxLength: 8,
        isNumeric: true
      });;
      await this.writeToBkmStream({
        text: creationTime,
        maxLength: 4,
        isNumeric: true
      });;
      
      /* 1207 */
      await this.writeToBkmStream({
        text: invoice.patient.name,
        maxLength: 50,
        isNumeric: false
      });;

      this.conditonalWritingToBkmStream(street && street.length, {
        text: street,
        maxLength: 50,
        isNumeric: false
      });;
      this.conditonalWritingToBkmStream(houseNumber && houseNumber.length, {
        text: houseNumber,
        maxLength: 10,
        isNumeric: false
      });;
      this.conditonalWritingToBkmStream(city && city.length, {
        text: city,
        maxLength: 30,
        isNumeric: false
      });;
      this.conditonalWritingToBkmStream(zipCode && zipCode.length, {
        text: zipCode,
        maxLength: 8,
        isNumeric: false
      });;
      this.conditonalWritingToBkmStream(country && country.length, {
        text: country,
        maxLength: 30,
        isNumeric: false
      });;
      this.conditonalWritingToBkmStream(countryCode && countryCode.length, {
        text: countryCode,
        maxLength: 30,
        isNumeric: false
      });;

      await this.writeToBkmStream({
        text: invoice.patient.phone,
        maxLength: 15,
        isNumeric: false
      });;
      await this.writeToBkmStream({
        text: invoice.patient.id,
        maxLength: 9,
        isNumeric: true
      });;
    
      /* 1216 */
      await this.writeToBkmStream({
        text: documentDate,
        maxLength: 8,
        isNumeric: false
      });;

      // Foreign exchange value - Currently unused.
      await this.writeToBkmStream({
        text: '+00000000000000',
        maxLength: 15,
        isNumeric: true
      });;
      await this.writeToBkmStream({
        text: 'ILS',
        maxLength: 3,
        isNumeric: false,
        withoutPad: true
      });;

      await this.writeToBkmStream({
        text: incomeBeforeDiscount,
        maxLength: 15,
        isNumeric: true,
        withSign: true,
        sign: '+'
      });;

      /* 1220 */
      await this.writeToBkmStream({
        text: discountAmount || 0,
        maxLength: 15,
        isNumeric: true,
        withSign: true,
        sign: discountSign
      });;
      
      await this.writeToBkmStream({
        text: incomeAfterDiscount,
        maxLength: 15,
        isNumeric: true,
        withSign: true,
        sign: '+'
      });;

      await this.writeToBkmStream({
        text: vat,
        maxLength: 15,
        isNumeric: true,
        withSign: true,
        sign: '+'
      });;

      /* 1223 */
      await this.writeToBkmStream({
        text: totalIncomePlusVat,
        maxLength: 15,
        isNumeric: true,
        withSign: true,
        sign: '+'
      });;

      
      await this.writeToBkmStream({
        text: '0',
        maxLength: 12,
        isNumeric: true,
        withSign: true,
        sign: '+'
      });;

      /* 1225 */
      await this.writeToBkmStream({
        text: invoice.patient.id,
        maxLength: 15,
        rightPad: true,
        isNumeric: false,
      });;

      await this.writeToBkmStream({
        text: ' ',
        maxLength: 10,
        isNumeric: false,
      });;

      await this.writeToBkmStream({
        text: invoice.isCancelled ? 1 : 0,
        maxLength: 1,
        isNumeric: false,
      });;

      /* 1230 */
      await this.writeToBkmStream({
        text: creationDate,
        maxLength: 8,
        isNumeric: true,
      });;

      await this.writeToBkmStream({
        text: ' ',
        maxLength: 7,
        isNumeric: false,
      });;

      await this.writeToBkmStream({
        text: invoice.serialNumber,
        maxLength: 7,
        isNumeric: true,
      });;
      
      await this.writeToBkmStream({
        text: ' ',
        maxLength: 60,
        isNumeric: false,
      });;

      // Last Row
      await this.writeToBkmStream({
        text: '\r\n',
        withoutPad: true
      });;


    } catch (error) {
      console.log(error);
    }
  }

  async writeD110(currentLine, invoice) {
    if (!this.bkmFileStream) {
      throw new Error('[writeD110] No bkmFileStream');
    }

    const { income } = invoice;

    if (!income || (income && !income.length)) {
      console.log('[writeD110] No income rows in invoice');
      return;
    }

    
    for (let index = 0; index < income.length; index++) {
      // Loop & write d110 line for each item
      const currentIncome = income[index];

      try { 
        await this.writeToBkmStream({
          text: 'D110',
          withoutPad: true
        });;
        await this.writeToBkmStream({
          text: currentLine,
          maxLength: 9,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: this.company.id,
          maxLength: 9,
          isNumeric: true
        });;
        await this.writeToBkmStream({
          text: invoice.type,
          maxLength: 9,
          isNumeric: true,
          withoutPad: true
        });;

        /* 1254 */
        await this.writeToBkmStream({
          text: invoice.serialNumber,
          maxLength: 20,
          isNumeric: true
        });;
        await this.writeToBkmStream({
          text: index,
          maxLength: 4,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: ' ',
          maxLength: 3,
          isNumeric: true
        });
        await this.writeToBkmStream({
          text: ' ',
          maxLength: 20,
          isNumeric: true
        });

        /* 1260 */
        await this.writeToBkmStream({
          text: currentIncome.description,
          maxLength: 30,
          isNumeric: true
        });
      } catch (error) {
        console.log(`[writeD100] Error: ${error}`);
      }
    }
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

  calculateIncomeAfterDiscount(discount, total) {
    const incomeAfterDiscount = total - this.calculateDiscount(discount, total);
    return this.financial(incomeAfterDiscount)
  }

  getTotalIncomeBeforeDiscount(incomes) {
    let total = 0;

    for (let i = 0; i < incomes.length; i++) {
      const {
        price,
        quantity
      } = incomes[i];

      if (!price) {
        throw new Error('[getTotalIncomeBeforeDiscount] No price provided in income');
      }

      total += price * (quantity || 1)
    }

    return this.financial(total);
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

  async writeToBkmStream({
    text,
    maxLength,
    isNumeric,
    withoutPad = false,
    withSign = false,
    rightPad = false,
    sign = ''
  }) {
    try {
      if (text == null) {
        text = '';
      }

      if (!withoutPad && text.length > maxLength) {
        text = text.substring(0, maxLength);
      }

      // For floating numbers
      if (text && `${text}`.includes('.')) {
        text = `${text}`.replace('.', '');
      }

      if (!withoutPad) {
        if (rightPad) {
          text = text.padEnd(text, withSign ? maxLength - 1 : maxLength, isNumeric ? '0' : ' '); 
        } else {
          text = leftpad(text, withSign ? maxLength - 1 : maxLength , isNumeric ? '0' : ' ')
        }
      }

      await this.bkmFileStream.write(withSign ? `${sign}${text}` : text);
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Openfrmt;



