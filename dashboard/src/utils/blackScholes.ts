import { BlackScholes } from '@uqee/black-scholes'
import { ReturnedOrderbookQuote } from '../../../src/types/quote'
import moment from 'moment'

const BSchInstance = new BlackScholes({
	priceToSigmaMethod: 'bisection',
	priceToSigmaAccuracy: 1e-3,
})

const ONE_YEAR_SEC = 60 * 60 * 24 * 365

export function getDeltaAndIV(option: ReturnedOrderbookQuote, price: number, spot: number) {
	const TTEAnnualised = (moment(option.expiration, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC
	const iv = BSchInstance.sigma({
		price: parseFloat(price.toFixed(6)),
		rate: 0.05,
		strike: option.strike,
		time: parseFloat(TTEAnnualised.toFixed(6)),
		type: option.type === 'C' ? 'call' : 'put',
		underlying: parseFloat(spot.toFixed(6)),
	})

	return Math.max(iv, 0) * 100
}

export function blackScholes(iv: number, price: number, spot: number, expiration: string, strike: number, type: "C" | "P") {
	const TTEAnnualised = (moment(expiration, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC
	const option = BSchInstance.option({
		sigma: iv / 100,
		rate: 0.05,
		strike: strike,
		time: parseFloat(TTEAnnualised.toFixed(6)),
		type: type === 'C' ? 'call' : 'put',
		underlying: parseFloat(spot.toFixed(6)),
	})

	return option
}
