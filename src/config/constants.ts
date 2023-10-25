import { ethers, ZeroAddress } from 'ethers'
import dotenv from 'dotenv'
import arb from './arbitrum.json'
import arbGoerli from './arbitrumGoerli.json'

dotenv.config()

// NOTE: orderbook_url is only used for posting/getting quotes from orderbook API
export const orderbook_url =
	process.env.ENV == 'production'
		? 'https://orderbook.premia.finance'
		: 'https://test.orderbook.premia.finance'
// undefined is checked in index
export const apiKey =
	process.env.ENV == 'production'
		? process.env.MAINNET_ORDERBOOK_API_KEY
		: process.env.TESTNET_ORDERBOOK_API_KEY

export const gasLimit: number = 1400000

export const referralAddress = ZeroAddress
export const rpcUrl =
	process.env.ENV == 'production'
		? process.env.MAINNET_RPC_URL!
		: process.env.TESTNET_RPC_URL!

export const privateKey = process.env.WALLET_PRIVATE_KEY!
export const walletAddr = process.env.WALLET_ADDRESS!
export const provider = new ethers.JsonRpcProvider(rpcUrl)
export const chainId = process.env.ENV == 'production' ? '42161' : '421613'
export const availableTokens =
	process.env.ENV === 'production'
		? Object.keys(arb.tokens)
		: Object.keys(arbGoerli.tokens)

export const tokenAddresses =
	process.env.ENV === 'production' ? arb.tokens : arbGoerli.tokens
export const signer = new ethers.Wallet(privateKey, provider)
export const routerAddress =
	process.env.ENV == 'production' ? arb.ERC20Router : arbGoerli.ERC20Router
