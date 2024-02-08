export const COINCAP_API = 'https://api.coincap.io/v2/rates'
export const PREMIA_API_URL = 'http://localhost:3000'

if (!process.env.REACT_APP_WALLET_ADDRESS) throw Error('REACT_APP_WALLET_ADDRESS env. var must be set')
export const WALLET_ADDRESS = process.env.REACT_APP_WALLET_ADDRESS
