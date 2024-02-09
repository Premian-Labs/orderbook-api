import axios from 'axios'
import { SpotPrice, CollateralBalances, Market } from '../types'
import { PREMIA_API_URL } from '../config'
import { OptionPositions } from '../../../src/types/balances'
import { IVResponse, SpotResponse } from '../../../src/types/validate'

const APIKey = process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY!

export async function getIVOracle(market: Market, expiration: string) {
	const getIVResponse = await axios.get(PREMIA_API_URL + '/oracles/iv', {
		headers: {
			'x-apikey': APIKey,
		},
		params: {
			market: market,
			expiration: expiration,
		},
	})

	return getIVResponse.data as IVResponse[]
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

export async function getSpotPrice() {
	const getSpotResponse = await axios.get(PREMIA_API_URL + '/oracles/spot', {
		headers: {
			'x-apikey': APIKey,
		},
		params: {
			markets: ['WETH', 'WBTC', 'ARB'],
		},
	})

	const responseData = getSpotResponse.data as SpotResponse[]

	const prices: SpotPrice = {
		WETH: responseData[0].price,
		WBTC: responseData[1].price,
		ARB: responseData[2].price,
	}

	return prices
}
