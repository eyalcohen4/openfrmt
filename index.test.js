const Openfrmt = require('./index');
const mock = [
  {
    companyId: '123',
    date: '2018-01-08',
    item: '',
    quantity: 1,
    price: ''
  },
  {
    companyId: '123',
    date: '2018-01-08',
    item: '',
    quantity: 2,
    price: ''
  },
  {
    companyId: '123',
    date: '2018-01-08',
    item: '',
    quantity: 3,
    price: ''
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