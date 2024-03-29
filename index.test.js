const pup = require("puppeteer");
const path = require("path");
const Openfrmt = require("./index");
const open = require("./open");
const { exec } = require("child_process");

const mock = [
  {
    id: '25fa123',
    creationDate: new Date(),
    type: '320',
    serialNumber: '1112',
    documentDate: '2018-01-02',
    currency: 'ILS',
    isCancelled: false,
    patient: {
      id: 'pasd123',
      authorizedId: '',
      name: 'Zigmond Freud',
      address: {
        country: 'Israel',
        countryCode: 'IL'
      },
      phone: "0775012340"
    },
    vatType: 1,
    payment: [
      {
        date: '2018-01-02',
        type: 4,
        price: 1200,
        currency: "ILS",
        bankName: 'Mizrahi Tefahot',
        bankNumber: 20,
        bankAccount: '201911',
        bankBranch: '420',
      },
      {
        date: '2018-01-05',
        type: 3,
        price: 300,
        currency: "ILS",
        cardType: 2,
        cardNum: '1234',
        dealType: 1,
      },
    ],
    income: [
      {
        price: 300.00,
        quantity: 4,
        currency: 'ILS',
        vatType: 1,
        description: 'טיפול קליני'
      },
      {
        price: 300.00,
        quantity: 1,
        currency: 'ILS',
        vatType: 0,
        description: 'ייעוץ והדרכה',
      }
    ]
  },
  {
    id: 'pqsd123',
    creationDate: new Date(),
    type: '400',
    serialNumber: '12345678',
    documentDate: '2018-01-11',
    currency: 'ILS',
    isCancelled: false,
    patient: {
      id: 'a1ed2123',
      name: 'מלאני קליין',
      address: {
        street: 'אלון',
        houseNumber: 20,
        city: 'תל אביב',
        zipCode: '6100100',
        country: 'ישראל',
        countryCode: 'IL'
      },
      phone: "97254231234"
    },
    vatType: 1,
    payment: [
      {
        date: '2018-01-10',
        type: 2,
        price: 600,
        currency: "ILS",
        bankName: 'Mizrahi Tefahot',
        bankNumber: 20,
        bankAccount: '201911',
        bankBranch: '420',
        chequeNum: '9102932',
      },
    ]
  },
  {
    id: 't891xd',
    creationDate: new Date(),
    type: '320',
    serialNumber: '2234',
    documentDate: '2018-01-07',
    currency: 'ILS',
    isCancelled: false,
    patient: {
      id: '60qrasf2',
      name: 'Alice Miller',
      address: {},
      phone: "0526262412"
    },
    vatType: 1,
    payment: [
      {
        date: '2018-01-08',
        currency: 'ILS',
        type: 1,
        price: 300
      }
    ],
    income: [
      {
        price: 250.00,
        quantity: 1,
        currency: 'ILS',
        vatType: 0,
        description: 'CBT'
      }
    ]
  }
];
const software = {
  name: "Betty",
  version: "0.0.1",
  id: "123",
  registrationNumber: "123456",
  mutliyear: true
};
const user = {
  companyId: "208600064",
  name: "Eyal Cohen",
  email: "eyalcohen4.ec@gmail.com",
  address: {
    street: "ארלוזורוב",
    houseNumber: "25",
    city: "תל אביב",
    zipCode: "6248802"
  }
};

const company = {
  name: "Some Psychologist",
  id: "208600064",
  registrationNumber: "208600064"
};

const dates = {
  fromDate: new Date(),
  toDate: new Date() + 10,
  processStartDate: new Date()
};

const openfrmt = new Openfrmt({
  destination: "./",
  software,
  company,
  company,
  invoices: mock,
  user,
  dates
});

const foldersPath = openfrmt.getFoldersFullPath();
const parentFoldersPath = path.normalize(foldersPath).split("/")[0];

openfrmt.generateReport();

open(`${foldersPath}/BKMVDATA.txt`);

async function uploadToTestModule(browser) {
  const page = await browser.newPage();
  await page.goto(
    "https://www.misim.gov.il/TmbakmmsmlNew/frmShowDialog.aspx?cur=3"
  );
  const charsetDropdown = await page.$("select#ddlEncoding");
  const iniInput = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$txtFile1"]'
  );
  const bkmInput = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$txtFile2"]'
  );
  const continueButton = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$btnCheck"]'
  );

  await page.select("select#ddlEncoding", "1");
  await iniInput.uploadFile(`${foldersPath}/INI.txt`);
  await bkmInput.uploadFile(`${foldersPath}/BKMVDATA.txt`);
  await continueButton.click();
}

(async () => {
  const browser = await pup.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.misim.gov.il/TmbakmmsmlNew/frmCheckFiles.aspx");
  const charsetDropdown = await page.$("select#ddlEncoding");
  const iniInput = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$txtFile1"]'
  );
  const bkmInput = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$txtFile2"]'
  );
  const continueButton = await page.$(
    'input[name="ctl00$ContentUsersPage$UcUploadFiles1$btnCheck"]'
  );

  await page.select("select#ddlEncoding", "1");
  await iniInput.uploadFile(`${foldersPath}/INI.txt`);
  await bkmInput.uploadFile(`${foldersPath}/BKMVDATA.txt`);
  await continueButton.click();
  await uploadToTestModule(browser);
  // await browser.close();
})();
