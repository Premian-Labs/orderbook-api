import { BlackScholes } from '@uqee/black-scholes'
import { ReturnedOrderbookQuote } from '../../../src/types/quote'
import moment from 'moment'

const BSchInstance = new BlackScholes()

const ONE_YEAR_SEC = 60 * 60 * 24 * 365

export function getDeltaAndIV(option: ReturnedOrderbookQuote, price: number, spot: number) {
	// deep ITM IV
	if (option.type === 'C' && spot - option.strike > 0.1 * spot) return 0
	if (option.type === 'P' && option.strike - spot > 0.1 * spot) return 0

	const TTEAnnualised = (moment(option.expiration, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC
	const iv = bisections(price, option.strike, TTEAnnualised, option.type === 'C' ? 'call' : 'put', spot)
	return iv * 100
}

export function blackScholes(iv: number, spot: number, expiration: number, strike: number, type: 'call' | 'put') {
	return BSchInstance.option({
		sigma: iv,
		rate: 0.05,
		strike: strike,
		time: expiration,
		type: type,
		underlying: spot,
	})
}

function bisections(price: number, strike: number, time: number, type: 'call' | 'put', underlying: number): number {
	const ACCURACY = 1e-2

	let sigmaLeft = 0
	let sigmaRight = 2
	const MAX_ITERATIONS = 20

	let sigma
	let option
	let dprice

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		sigma = (sigmaLeft + sigmaRight) / 2
		option = blackScholes(sigma, underlying, time, strike, type)
		dprice = option.price - price

		if (Math.abs(dprice) < ACCURACY) return sigma
		else if (dprice > 0) sigmaRight = sigma
		else sigmaLeft = sigma
	}

	return 0
}
