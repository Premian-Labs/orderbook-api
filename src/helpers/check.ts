import {
	OrderbookQuoteTradeDeserialized,
	PoolKey,
	TokenType,
} from '../types/quote'
import { TokenBalance } from '../types/balances'
import { Option } from '../types/validate'
import { IPool, IPool__factory } from '../typechain'
import { createExpiration, createPoolKey } from './create'
import {
	privateKey,
	rpcUrl,
	tokenAddresses,
	walletAddr,
} from '../config/constants'
import { ethers, formatEther, formatUnits, parseEther } from 'ethers'
import Logger from '../lib/logger'
import { getPoolAddress } from './get'
import moment from 'moment'

const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)

export async function preProcessAnnhilate(
	annihilateOption: Option
): Promise<[IPool, bigint]> {
	// NOTE: expiration is an incoming string only value but later converted to number
	const strExp = annihilateOption.expiration as string

	// 1. validate and convert option exp to timestamp
	annihilateOption.expiration = createExpiration(strExp)

	// 2. create poolKey
	const poolKey = createPoolKey(annihilateOption)

	// 3. get & check balances
	const poolAddr = await getPoolAddress(poolKey)
	const pool = IPool__factory.connect(poolAddr, signer)

	const shortBalance = parseFloat(
		formatEther(await pool.balanceOf(walletAddr, TokenType.SHORT))
	)
	const longBalance = parseFloat(
		formatEther(await pool.balanceOf(walletAddr, TokenType.LONG))
	)

	Logger.info({
		message: 'short token balance',
		balance: {
			shortBalance,
			longBalance,
		},
	})

	const annihilateSize = parseEther(
		Math.min(shortBalance, longBalance).toString()
	)

	if (annihilateSize > 0n) {
		return [pool, annihilateSize]
	} else {
		throw new Error(`No positions to annihilate`)
	}
}

export async function preProcessExpOption(
	expOption: Option,
	tokenType: number
) {
	// NOTE: expiration is an incoming string only value but later converted to number
	const strExp = expOption.expiration as string

	// 1. verified the option has expired
	const optionHasExpired = optionExpired(strExp)
	if (!optionHasExpired) {
		throw new Error('Option has not expired')
	}
	// 2. validate and convert option exp to timestamp
	expOption.expiration = createExpiration(strExp)

	// 3. check that there is a balance for the option being settled/exercised
	// NOTE: Option base/quote is the name
	const poolKey: PoolKey = createPoolKey(expOption)
	const poolAddr = await getPoolAddress(poolKey)
	const pool = IPool__factory.connect(poolAddr, signer)
	const balance = await pool.balanceOf(walletAddr, tokenType)
	Logger.info({
		message: `${tokenType === 0 ? 'Short' : 'Long'} Balance: `,
		balance: formatEther(balance),
	})

	if (balance === 0n) {
		throw new Error('No balance to settle')
	}

	return pool
}

export function optionExpired(exp: string) {
	const maturity = moment.utc(exp, 'DDMMMYYYY').set({
		hour: 8,
		minute: 0,
		second: 0,
		millisecond: 0,
	})
	const maturitySec = maturity.valueOf() / 1000
	const ts = moment.utc().unix()

	return maturitySec < ts
}

export async function validateBalances(
	tokenBalances: TokenBalance[],
	collateralTokenAddr: string,
	fillQuoteRequests: OrderbookQuoteTradeDeserialized[]
) {
	// Note: we only have balances for what is available in tokenAddresses constant
	// value of balance is a number from getBalances()
	const availableTokenBalance = tokenBalances.find(
		(tokenBalance) => tokenBalance.token_address === collateralTokenAddr
	)!.balance as number

	// Sums up fillQuoteRequests tradeSizes
	const tradesTotalSize = fillQuoteRequests
		.map((fillQuoteRequest) => fillQuoteRequest.tradeSize)
		.reduce((sum, x) => sum + x)

	//TODO: better to use token name here than address
	if (availableTokenBalance < tradesTotalSize) {
		throw new Error(
			`Not enough ${collateralTokenAddr} collateral to fill orders`
		)
	}
}
