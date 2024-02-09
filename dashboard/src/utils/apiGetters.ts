import axios from 'axios'
import { CollateralBalances, Market } from '../types'
import { PREMIA_API_URL } from '../config'
import { OptionPositions } from '../../../src/types/balances'

const APIKey = process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY!

export async function getIVOracle(market: Market, spotPrice: number, strike: number, expiration: string) {
	const getIVResponse = await axios.get(PREMIA_API_URL + '/oracles/iv', {
		headers: {
			'x-apikey': APIKey,
		},
		params: {
			market: market,
			spotPrice: spotPrice,
			strike: strike,
			expiration: expiration,
		},
	})

	return getIVResponse.data as number
}

export async function getNativeBalance() {
	const getNativeBalanceResponse = await axios.get(PREMIA_API_URL + '/account/native_balance', {
		headers: {
			'x-apikey': APIKey,
		},
	})

	return getNativeBalanceResponse.data as number
}

export async function getCollateralBalance() {
	const getCollateralBalanceResponse = await axios.get(PREMIA_API_URL + '/account/collateral_balances', {
		headers: {
			'x-apikey': APIKey,
		},
	})

	const balance = getCollateralBalanceResponse.data as CollateralBalances
	return balance.success.filter(
		(tokenBalance) => tokenBalance.symbol === 'WBTC' || tokenBalance.symbol === 'WETH' || tokenBalance.symbol === 'ARB',
	)
}

export async function getOptionBalance() {
	const getOptionBalanceResponse = await axios.get(PREMIA_API_URL + '/account/option_balances', {
		headers: {
			'x-apikey': APIKey,
		},
	})

	return (getOptionBalanceResponse.data as OptionPositions).open
}
