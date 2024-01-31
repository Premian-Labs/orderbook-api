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
const multiCallProvider = MulticallWrapper.wrap(provider)

export const signer = new Wallet(privateKey, provider)

// NOTE: orderbook_url is only used for posting/getting quotes from orderbook API
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

export const routerAddr =
	process.env.ENV == 'production'
		? arb.core.ERC20Router.address
		: arbGoerli.core.ERC20Router.address

const chainlinkAdapterAddr =
	process.env.ENV == 'production'
		? arb.core.ChainlinkAdapterProxy.address
		: arbGoerli.core.ChainlinkAdapterProxy.address

const poolFactoryAddr =
	process.env.ENV == 'production'
		? arb.core.PoolFactoryProxy.address
		: arbGoerli.core.PoolFactoryProxy.address

export const poolFactory = IPoolFactory__factory.connect(
	poolFactoryAddr,
	signer
)

// NOTE: iv oracle only uses production rpc
const ivProvider = new JsonRpcProvider(process.env.MAINNET_RPC_URL!)
const ivMultiCallProvider = MulticallWrapper.wrap(ivProvider)
export const ivOracle = IVolatilityOracle__factory.connect(
	arb.core.VolatilityOracleProxy.address,
	ivMultiCallProvider
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

export const chainlink = IChainlinkAdapter__factory.connect(
	chainlinkAdapterAddr,
	multiCallProvider
)

export const availableTokens =
	process.env.ENV === 'production'
		? Object.keys(arb.tokens)
		: Object.keys(arbGoerli.tokens)

export const blockByTsEndpoint =
	process.env.ENV == 'production'
		? 'https://api.arbiscan.io/api'
		: 'https://api-goerli.arbiscan.io/api'
