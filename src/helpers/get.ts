import { PoolKey, TokenAddresses } from '../types/quote'
import { Contract, formatEther } from 'ethers'
import Logger from '../lib/logger'
import PoolFactoryABI from '../abi/IPoolFactory.json'
import {
	availableTokens,
	provider,
	tokenAddresses,
	walletAddr,
} from '../config/constants'
import arb from '../config/arbitrum.json'
import arbGoerli from '../config/arbitrumGoerli.json'
import { IERC20__factory } from '../typechain'
import { TokenBalance } from '../types/balances'

const poolFactoryAddr =
	process.env.ENV == 'production'
		? arb.core.PoolFactoryProxy.address
		: arbGoerli.core.PoolFactoryProxy.address
const poolFactory = new Contract(poolFactoryAddr, PoolFactoryABI, provider)

const poolMap: Map<PoolKey, string> = new Map()

export async function getPoolAddress(poolKey: PoolKey) {
	const memPoolAddress = poolMap.get(poolKey)
	if (memPoolAddress) return memPoolAddress

	let poolAddress: string
	let isDeployed: boolean

	try {
		;[poolAddress, isDeployed] = await poolFactory.getPoolAddress(poolKey)
	} catch (e) {
		try {
			;[poolAddress, isDeployed] = await poolFactory.getPoolAddress(poolKey)
		} catch (e) {
			Logger.error({
				message: `Can not get pool address`,
				error: JSON.stringify(e)
			})
			throw new Error(`Can not get pool address`)
		}
	}
	poolAddress = poolAddress.toLowerCase()
	if (!isDeployed) {
		Logger.warn({
			message: `Pool is not deployed`,
			poolKey: poolKey
		})
	}
	poolMap.set(poolKey, poolAddress)
	return poolAddress
}

export function getTokenByAddress(
	tokenObject: TokenAddresses,
	address: string
) {
	const tokenName = Object.keys(tokenObject).find(
		(key) => tokenObject[key] === address
	)
	if (tokenName == undefined) {
		return ''
	}
	return tokenName
}

export async function getBalances() {
	const promiseAll = await Promise.allSettled(
		availableTokens.map(async (token) => {
			const erc20 = IERC20__factory.connect(tokenAddresses[token], provider)
			const tokenBalance: TokenBalance = {
				token_address: tokenAddresses[token],
				symbol: token,
				// FIXME: fix decimals for non-standard coin (WBTC, USDC)
				balance: parseFloat(formatEther(await erc20.balanceOf(walletAddr))),
			}
			return tokenBalance
		})
	)
	const balances: TokenBalance[] = []
	const reasons: any[] = []
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			balances.push(result.value)
		}
		if (result.status === 'rejected') {
			reasons.push(result.reason)
		}
	})

	return [balances, reasons] as [TokenBalance[], any[]]
}
