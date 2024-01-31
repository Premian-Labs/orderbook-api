import { JsonRpcProvider, Wallet, ZeroAddress } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import dotenv from 'dotenv'
import {
	IChainlinkAdapter__factory,
	IPoolFactory__factory,
	IVolatilityOracle__factory,
} from '@premia/v3-abi/typechain'

import arb from './arbitrum.json'
import arbGoerli from './arbitrumGoerli.json'

dotenv.config()

export const privateKey = process.env.WALLET_PRIVATE_KEY!
export const walletAddr = process.env.WALLET_ADDRESS!
export const rpcUrl =
	process.env.ENV == 'production'
		? process.env.MAINNET_RPC_URL!
		: process.env.TESTNET_RPC_URL!
export const chainId = process.env.ENV == 'production' ? '42161' : '421613'

export const provider = new JsonRpcProvider(rpcUrl, Number(chainId), {
	staticNetwork: true,
})

export const signer = new Wallet(privateKey, provider)

export const orderbook_url =
	process.env.ENV == 'production'
		? 'https://orderbook.premia.finance'
		: 'https://test.orderbook.premia.finance'
export const ws_url =
	process.env.ENV == 'production'
		? 'wss://quotes.premia.finance'
		: 'wss://test.quotes.premia.finance'
// undefined is checked in index
export const apiKey =
	process.env.ENV == 'production'
		? process.env.MAINNET_ORDERBOOK_API_KEY
		: process.env.TESTNET_ORDERBOOK_API_KEY

export const referralAddress = process.env.REFERRAL_ADDRESS ?? ZeroAddress

export const tokenAddr =
	process.env.ENV === 'production' ? arb.tokens : arbGoerli.tokens
export const supportedTokens = Object.keys(tokenAddr)
export const productionTokenAddr: Record<string, string> = arb.tokens
const prodProvider = new JsonRpcProvider(process.env.MAINNET_RPC_URL!)
const prodMultiCallProvider = MulticallWrapper.wrap(prodProvider)

export const routerAddr =
	process.env.ENV == 'production'
		? arb.core.ERC20Router.address
		: arbGoerli.core.ERC20Router.address

const poolFactoryAddr =
	process.env.ENV == 'production'
		? arb.core.PoolFactoryProxy.address
		: arbGoerli.core.PoolFactoryProxy.address

export const poolFactory = IPoolFactory__factory.connect(
	poolFactoryAddr,
	signer
)

// NOTE: we use production instance
export const ivOracle = IVolatilityOracle__factory.connect(
	arb.core.VolatilityOracleProxy.address,
	prodMultiCallProvider
)

export const productionTokensWithIVOracles = [
	'WETH',
	'WBTC',
	'ARB',
	'LINK',
	'WSTETH',
	'GMX',
	'MAGIC',
	'SOL',
	'FXS',
]

// NOTE: we use production
export const chainlink = IChainlinkAdapter__factory.connect(
	arb.core.ChainlinkAdapterProxy.address,
	prodMultiCallProvider
)

export const availableTokens =
	process.env.ENV === 'production'
		? Object.keys(arb.tokens)
		: Object.keys(arbGoerli.tokens)

export const blockByTsEndpoint =
	process.env.ENV == 'production'
		? 'https://api.arbiscan.io/api'
		: 'https://api-goerli.arbiscan.io/api'

export const SECONDS_IN_YEAR = 365 * 24 * 60 * 60
