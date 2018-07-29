const Openfrmt = require('./index');
const mock = [
  {
    creationDate: 1470819922 * 1000,
    type: '300',
    serialNumber: '7712',
    documentDate: '2018-09-02',
    currency: 'ILS',
    patient: {
      name: 'Zigmond Freud',
      address: {
        country: 'Israel'
      },
      phone: "0775012340"
    },
    vatType: 2,
    income: [
      {
        price: 300,
        quantity: 4,
        currency: 'ILS',
        vatType: 1
      },
      {
        price: 300,
        quantity: 1,
        currency: 'ILS',
        vatType: 0
      }
    ]
  },
  {
    creationDate: 1537524660 * 1000,
    type: '320',
    serialNumber: '22345648912345678113',
    documentDate: '2018-01-11',
    currency: 'ILS',
    patient: {
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
    income: [
      {
        price: 300,
        quantity: 2,
        currency: 'ILS',
        vatType: 0
      }
    ]
  },
  {
    creationDate: 1532786504 * 1000,
    item: '',
    price: '',
    type: '320',
    serialNumber: '2234',
    documentDate: '2018-12-12',
    currency: 'ILS',
    patient: {
      name: 'Alice Miller',
      address: {},
      phone: "0526262412"
    },
    income: [
      {
        price: 250,
        quantity: 1,
        currency: 'ILS',
        vatType: 0
      }
    ]
  }
]

const software = {
  name: 'Betty',
  version: '0.0.1',
  id: '123'
}
const company = {
  name: 'Some Psychologist',
  id: '12345678'
}

const openfrmt = new Openfrmt('./', software, company, mock);

console.log(openfrmt.generateBkmFile());