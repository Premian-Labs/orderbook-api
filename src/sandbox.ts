import moment from 'moment';

// 2.2 parse product name and generate Pool Key
const parsedProduct: string[] = ['WETH', 'USDC', '22FEB19', '1600', 'C']

let expiration = moment(parsedProduct[2], 'DDMMMYY')

console.log(expiration)