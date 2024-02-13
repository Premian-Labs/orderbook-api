if (!process.env.REACT_APP_PREMIA_API_URL) throw Error('REACT_APP_PREMIA_API_URL env. var must be set')
export const PREMIA_API_URL = process.env.REACT_APP_PREMIA_API_URL

if (!process.env.REACT_APP_WALLET_ADDRESS) throw Error('REACT_APP_WALLET_ADDRESS env. var must be set')
export const WALLET_ADDRESS = process.env.REACT_APP_WALLET_ADDRESS

if (!process.env.REACT_APP_PREMIA_WS_URL) throw Error('REACT_APP_PREMIA_WS_URL env. var must be set')
export const PREMIA_WS_URL = process.env.REACT_APP_PREMIA_WS_URL

export const chainId = '42161'

if (!process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY)
	throw Error('REACT_APP_MAINNET_ORDERBOOK_API_KEY env. var must be set')
export const APIKey = process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY!
