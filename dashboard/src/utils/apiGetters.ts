import axios from 'axios'
import {
	SpotPrice,
	CollateralBalances,
	Market,
	OptionPositions,
	IVResponse,
	SpotResponse,
	QuoteResponse,
} from '../types'
import { APIKey, availableTokens, PREMIA_API_URL } from '../config'
import moment from 'moment'
import { blackScholes, ONE_YEAR_SEC } from './blackScholes'
import _ from 'lodash'

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
			markets: availableTokens,
		},
	})

	const responseData = getSpotResponse.data as SpotResponse[]

	const prices: SpotPrice = {
		WETH: responseData.find((x) => x.market === 'WETH')?.price!,
		WBTC: responseData.find((x) => x.market === 'WBTC')?.price!,
		ARB: responseData.find((x) => x.market === 'ARB')?.price!,
	}

	return prices
}

// Min DTE 3 days
// Max DTE 35 days
// Min Delta 0.2
// Max Delta 0.7
export async function getVaults(base: Market, spotPrice: number) {
	const maturitiesResponse = await axios.get(PREMIA_API_URL + '/pools/maturities', {
		headers: {
			'x-apikey': APIKey,
		},
	})
	const maturities = maturitiesResponse.data as string[]
	const threeDaysAhead = moment.utc().startOf('day').add(8, 'hours').add(3, 'days')
	const thirtyFiveDaysAhead = moment.utc().startOf('day').add(8, 'hours').add(35, 'days')
	const vaultsMaturities = maturities.filter((maturity) => {
		const poolMaturity = moment.utc(maturity).add(8, 'hours')
		return poolMaturity.isAfter(threeDaysAhead, 'days') && poolMaturity.isBefore(thirtyFiveDaysAhead, 'days')
	})

	const strikesResponse = await axios.get(PREMIA_API_URL + '/pools/strikes', {
		headers: {
			'x-apikey': APIKey,
		},
		params: {
			spotPrice: spotPrice,
		},
	})
	const strikes = strikesResponse.data as number[]

	const validStrikesMaturitiesPromise = vaultsMaturities.map(async (maturity) => {
		const vaultsStrikes = []
		const TTEAnnualised = (moment(maturity, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC
		const IV = await getIVOracle(base, maturity)

		for (const strike of strikes) {
			for (const type of ['C', 'P']) {
				const iv = IV.find((x) => x.strike === strike)?.iv!
				const delta = blackScholes(iv, spotPrice, TTEAnnualised, strike, type === 'C' ? 'call' : 'put').delta
				if (Math.abs(delta) > 0.2 && Math.abs(delta) < 0.7) {
					for (const direction of ['buy']) vaultsStrikes.push([strike, maturity, type, direction])
				}
			}
		}

		return vaultsStrikes
	})

	const validStrikesMaturities = await Promise.all(validStrikesMaturitiesPromise)

	const getVaultQuotesPromise = Promise.allSettled(
		_.flatten(validStrikesMaturities).map(async ([strike, maturity, type, direction]) => {
			try {
				const vaultQuote = await axios.get(PREMIA_API_URL + '/vaults/quote', {
					headers: {
						'x-apikey': APIKey,
					},
					params: {
						base: base,
						quote: 'USDC',
						expiration: maturity,
						type: type,
						strike: strike.toString(),
						size: 1,
						direction: direction,
					},
				})

				const vaultData = vaultQuote.data as QuoteResponse
				vaultData.quote = type === 'C' ? vaultData.quote * spotPrice : vaultData.quote

				return vaultData
			} catch (e) {
				return Promise.reject(e)
			}
		}),
	)

	return (await getVaultQuotesPromise)
		.filter((x) => x.status === 'fulfilled')
		.map((x) => (x as PromiseFulfilledResult<QuoteResponse>).value)
}
