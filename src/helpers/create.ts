import moment from 'moment'
import { formatEther, parseEther, toBigInt } from 'ethers'

import {
	FillableQuote,
	InvalidOrderbookQuote,
	InvalidPostQuoteResponse,
	OrderbookQuote,
	OrderbookQuoteTradeDeserialized,
	PoolKey,
	ReturnedOrderbookQuote,
} from '../types/quote'
import { Option, VaultRequest } from '../types/validate'
import { PublishQuoteRequest } from '../types/validate'
import { spotOracleAddr, tokenAddr } from '../config/constants'
import { getTokenByAddress } from './get'
import { RFQMessage, RFQMessageParsed } from '../types/ws'

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
	const hoursToExpiration = expirationMoment
		.clone()
		.add('8', 'hours')
		.diff(moment().utc(), 'hours')

	// 1.1 check if option already expired
	if (daysToExpiration <= 0 && hoursToExpiration <= 0) {
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
		base: getTokenByAddress(tokenAddr, orderbookQuote.poolKey.base),
		quote: getTokenByAddress(tokenAddr, orderbookQuote.poolKey.quote),
		expiration: moment
			.unix(orderbookQuote.poolKey.maturity)
			.format('DDMMMYY')
			.toUpperCase(),
		strike: parseFloat(formatEther(orderbookQuote.poolKey.strike)),
		type: orderbookQuote.poolKey.isCallPool ? 'C' : 'P',
		side: orderbookQuote.isBuy ? 'bid' : 'ask',
		remainingSize: parseFloat(formatEther(orderbookQuote.size)),
		price: parseFloat(formatEther(orderbookQuote.price)),
		provider: orderbookQuote.provider,
		taker: orderbookQuote.taker,
		deadline: orderbookQuote.deadline,
	}
}

export function createReturnedQuotes(
	orderbookQuote: OrderbookQuote
): ReturnedOrderbookQuote {
	return {
		base: getTokenByAddress(tokenAddr, orderbookQuote.poolKey.base),
		quote: getTokenByAddress(tokenAddr, orderbookQuote.poolKey.quote),
		expiration: moment
			.unix(orderbookQuote.poolKey.maturity)
			.format('DDMMMYY')
			.toUpperCase(),
		strike: parseFloat(formatEther(orderbookQuote.poolKey.strike)),
		type: orderbookQuote.poolKey.isCallPool ? 'C' : 'P',
		side: orderbookQuote.isBuy ? 'bid' : 'ask',
		remainingSize: parseFloat(formatEther(orderbookQuote.fillableSize)),
		price: parseFloat(formatEther(orderbookQuote.price)),
		provider: orderbookQuote.provider,
		taker: orderbookQuote.taker,
		deadline: orderbookQuote.deadline - orderbookQuote.ts,
		quoteId: orderbookQuote.quoteId,
		ts: orderbookQuote.ts,
	}
}
export function createPoolKey(
	quote: PublishQuoteRequest | Option | VaultRequest,
	expiration?: number
): PoolKey {
	return {
		base: tokenAddr[quote.base],
		quote: tokenAddr[quote.quote],
		oracleAdapter: spotOracleAddr,
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
		tradeSize: quote.tradeSize,
		fillableSize: toBigInt(quote.fillableSize),
		ts: quote.ts,
	}
}

export function mapRFQMessage(
	rfqMessage: RFQMessage['body']
): RFQMessageParsed['body'] {
	return {
		base: getTokenByAddress(tokenAddr, rfqMessage.poolKey.base),
		quote: getTokenByAddress(tokenAddr, rfqMessage.poolKey.quote),
		expiration: moment
			.unix(rfqMessage.poolKey.maturity)
			.format('DDMMMYY')
			.toUpperCase(),
		strike: parseFloat(formatEther(rfqMessage.poolKey.strike)),
		type: rfqMessage.poolKey.isCallPool ? 'C' : 'P',
		side: rfqMessage.side,
		size: parseFloat(formatEther(rfqMessage.size)),
		taker: rfqMessage.taker,
	}
}
