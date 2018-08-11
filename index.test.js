const Openfrmt = require('./index');
const open = require('./open');

const mock = [
  {
    id: '25fa123',
    creationDate: 1470819922 * 1000,
    type: '300',
    serialNumber: '7712',
    documentDate: '2018-09-02',
    currency: 'ILS',
    isCancelled: false,
    patient: {
      id: '60qrasf2',
      name: 'Zigmond Freud',
      address: {
        country: 'Israel'
      },
      phone: "0775012340"
    },
    vatType: 0,
    payment: [
      {
        date: '2018-09-01',
        type: 4,
        price: 1200,
        currency: "ILS",
        bankName: 'Mizrahi Tefahot',
        bankNumber: 20,
        bankAccount: '201911',
        bankBranch: '420',
      },
      {
        date: '2018-01-10',
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
    creationDate: 1537524660 * 1000,
    type: '320',
    serialNumber: '22345648912345678113',
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
      phone: "+97254231234"
    },
    vatType: 0,
    discount: {
      amount: 20,
      type: 'percentage'
    },
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
    ],
    income: [
      {
        price: 300.00,
        quantity: 2,
        currency: 'ILS',
        vatType: 0,
        description: 'פסיכותרפיה'
      }
    ]
  },
  {
    id: 't891xd',
    creationDate: 1532786504 * 1000,
    item: '',
    price: '',
    type: '320',
    serialNumber: '2234',
    documentDate: '2018-12-12',
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
        date: '2018-11-25',
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
  name: 'Betty',
  version: '0.0.1',
  id: '123',
  registrationNumber: '123456',
  mutliyear: true,
}
const user = {
  companyId: '12345678',
  name: 'Eyal Cohen',
  address: {
    street: 'ארלוזורוב',
    houseNumber: '25',
    city: 'תל אביב',
    zipCode: '6248802',
  }
}
const company = {
  name: 'Some Psychologist',
  id: '12345678',
  registrationNumber: '9346',
}

console.log(user);
const openfrmt = new Openfrmt({
  destination: './', 
  software, 
  company, 
  company, 
  invoices: mock, 
  user
});

const path = openfrmt.getFoldersFullPath();
console.log(openfrmt.generateReport());

open(`${path}/INI.txt`);

