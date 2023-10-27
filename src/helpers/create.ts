import moment from 'moment'
import {
	FillableQuote,
	InvalidOrderbookQuote,
	InvalidPostQuoteResponse,
	OrderbookQuote,
	OrderbookQuoteTradeDeserialized,
	PoolKey,
	ReturnedOrderbookQuote,
} from '../types/quote'
import { Option } from '../types/validate'
import { PublishQuoteRequest } from '../types/validate'
import { tokenAddresses } from '../config/constants'
import { formatEther, parseEther, toBigInt } from 'ethers'
import { getTokenByAddress } from './get'
import arb from '../config/arbitrum.json'
import arbGoerli from '../config/arbitrumGoerli.json'

/*
Expiration Rules:
All options expire at 8 AM UTC.
Maturities over 2 days expire on a Friday (weekly maturities).
Maturities over 30 days expire on the last Friday of the calendar month (monthly maturities).
Max maturity is 1 year.
 */
export function createExpiration(exp: string): number {
	const expirationMoment = moment.utc(exp, 'DDMMMYY')

	// 1.0 check if option expiration is a valid date
	if (!expirationMoment.isValid()) {
		throw new Error(`Invalid expiration date: ${exp}`)
	}

	const today = moment.utc().startOf('day')
	// NOTE: this returns a floor integer value for day (ie 1.9 days -> 1)
	const daysToExpiration = expirationMoment.diff(today, 'days')

	// 1.1 check if option alread expired
	if (daysToExpiration <= 0) {
		throw new Error(`Invalid expiration date: ${exp} is in the past`)
	}

	// 1.2 check if option expiration is more than 1 year out
	if (expirationMoment.diff(today, 'years') > 0) {
		throw new Error(`Invalid expiration date: ${exp} is more then in 1 year`)
	}

	// 2. DAILY OPTIONS: if option expiration is tomorrow or the day after tomorrow, return as vaild
	if (daysToExpiration === 1 || daysToExpiration === 2) {
		// Set time to 8:00 AM
		return expirationMoment.add(8, 'hours').unix()
	}

	// 3. WEEKLY OPTIONS: check if option expiration is Friday
	if (expirationMoment.day() !== 5) {
		throw new Error(`${expirationMoment.toJSON()} is not Friday!`)
	}

	// 4. MONTHLY OPTIONS: if option maturity > 30 days, validate expire is last Friday of the month
	if (daysToExpiration > 30) {
		const lastDay = expirationMoment.clone().endOf('month').startOf('day')
		lastDay.subtract((lastDay.day() + 2) % 7, 'days')

		if (!lastDay.isSame(expirationMoment)) {
			throw new Error(
				`${expirationMoment.toJSON()} is not the last Friday of the month!`
			)
		}
	}

	// Set time to 8:00 AM
	return expirationMoment.add(8, 'hours').unix()
}

export function parseInvalidQuotes(
	orderbookQuote: InvalidPostQuoteResponse
): InvalidOrderbookQuote {
	return {
		base: getTokenByAddress(tokenAddresses, orderbookQuote.poolKey.base),
		quote: getTokenByAddress(tokenAddresses, orderbookQuote.poolKey.quote),
		expiration: moment
			.unix(orderbookQuote.poolKey.maturity)
			.format('DDMMMYY')
			.toUpperCase(),
		strike: parseInt(formatEther(orderbookQuote.poolKey.strike)),
		type: orderbookQuote.poolKey.isCallPool ? 'C' : 'P',
		side: orderbookQuote.isBuy ? 'bid' : 'ask',
		size: parseFloat(formatEther(orderbookQuote.size)),
		price: parseFloat(formatEther(orderbookQuote.price)),
		deadline: orderbookQuote.deadline,
	}
}

export function createReturnedQuotes(
	orderbookQuote: OrderbookQuote
): ReturnedOrderbookQuote {
	return {
		base: getTokenByAddress(tokenAddresses, orderbookQuote.poolKey.base),
		quote: getTokenByAddress(tokenAddresses, orderbookQuote.poolKey.quote),
		expiration: moment
			.unix(orderbookQuote.poolKey.maturity)
			.format('DDMMMYY')
			.toUpperCase(),
		strike: parseInt(formatEther(orderbookQuote.poolKey.strike)),
		type: orderbookQuote.poolKey.isCallPool ? 'C' : 'P',
		side: orderbookQuote.isBuy ? 'bid' : 'ask',
		size: parseFloat(formatEther(orderbookQuote.fillableSize)),
		price: parseFloat(formatEther(orderbookQuote.price)),
		deadline: orderbookQuote.deadline - orderbookQuote.ts,
		quoteId: orderbookQuote.quoteId,
		ts: orderbookQuote.ts,
	}
}
export function createPoolKey(
	quote: PublishQuoteRequest | Option,
	expiration?: number
): PoolKey {
	return {
		base:
			process.env.ENV == 'production'
				? arb.tokens[quote.base]
				: arbGoerli.tokens[quote.base],
		quote:
			process.env.ENV == 'production'
				? arb.tokens[quote.quote]
				: arbGoerli.tokens[quote.quote],
		oracleAdapter:
			process.env.ENV == 'production'
				? arb.ChainlinkAdapterProxy
				: arbGoerli.ChainlinkAdapterProxy,
		strike: parseEther(quote.strike.toString()),
		maturity: expiration ? expiration : quote.expiration,
		isCallPool: quote.type === 'C',
	}
}

export function deserializeOrderbookQuote(
	quote: FillableQuote
): OrderbookQuoteTradeDeserialized {
	const deSerializedPoolKey = {
		base: quote.poolKey.base,
		quote: quote.poolKey.quote,
		oracleAdapter: quote.poolKey.oracleAdapter,
		strike: toBigInt(quote.poolKey.strike),
		maturity: toBigInt(quote.poolKey.maturity),
		isCallPool: quote.poolKey.isCallPool,
	}

	return {
		poolKey: deSerializedPoolKey,
		provider: quote.provider,
		taker: quote.taker,
		price: toBigInt(quote.price),
		size: toBigInt(quote.size),
		isBuy: quote.isBuy,
		deadline: toBigInt(quote.deadline),
		salt: toBigInt(quote.salt),
		chainId: quote.chainId,
		signature: quote.signature,
		quoteId: quote.quoteId,
		poolAddress: quote.poolAddress,
		tradeSize: toBigInt(quote.tradeSize),
		fillableSize: toBigInt(quote.fillableSize),
		ts: quote.ts,
	}
}
