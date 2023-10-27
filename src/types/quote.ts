import { BigNumberish } from 'ethers'
import { RSV } from './signature'
import { FillQuoteRequest, Option } from './validate'

export interface PoolKey {
	base: string // token address
	quote: string // token address
	oracleAdapter: string
	strike: BigNumberish
	maturity: BigNumberish
	isCallPool: boolean
}

export interface PoolKeySerialized {
	base: string
	quote: string
	oracleAdapter: string
	strike: string
	maturity: number
	isCallPool: boolean
}

export interface PublishQuoteProxyRequest extends SerializedQuote {
	chainId: string
}

export interface SerializedQuote {
	poolKey: PoolKeySerialized
	provider: string
	taker: string
	price: string
	size: string
	isBuy: boolean
	deadline: number
	salt: number
	signature: RSV
}

export interface GroupedDeleteRequest {
	[key: string]: OrderbookQuote[]
}

export enum TokenType {
	SHORT = 0,
	LONG = 1,
}

export interface QuoteOB {
	provider: string
	taker: string
	price: BigNumberish
	size: BigNumberish
	isBuy: boolean
	deadline: BigNumberish
	salt: BigNumberish
}

export interface PublishOBQuote extends QuoteOB {
	poolKey: PoolKey
	signature: RSV
}

export interface OrderbookQuoteDeserialized extends PublishOBQuote {
	chainId: string
	quoteId: string
	poolAddress: string
	fillableSize: BigNumberish
	ts: number
}

export interface OrderbookQuote {
	poolKey: PoolKeySerialized
	provider: string
	taker: string
	price: string
	size: string
	isBuy: boolean
	deadline: number
	salt: number
	chainId: string
	signature: RSV
	quoteId: string
	poolAddress: string
	fillableSize: string
	ts: number
}

export type FillableQuote = FillQuoteRequest & OrderbookQuote

export interface PoolKeySerialized {
	base: string
	quote: string
	oracleAdapter: string
	strike: string
	maturity: number
	isCallPool: boolean
}

export interface OrderbookQuoteTradeDeserialized
	extends OrderbookQuoteDeserialized {
	tradeSize: BigNumberish
}

export interface ReturnedOrderbookQuote extends Option {
	side: 'bid' | 'ask'
	size: number
	price: number
	deadline: number
	quoteId: string
	ts: number
}

export type InvalidOrderbookQuote = Omit<
	ReturnedOrderbookQuote,
	'quoteId' | 'ts'
>

export interface TokenAddresses {
	[key: string]: string
}

export type InvalidPostQuoteResponse = Omit<
	OrderbookQuote,
	'poolAddress' | 'quoteId' | 'fillableSize' | 'ts'
>

export interface PostQuotesResponse {
	created: OrderbookQuote[]
	failed: {
		reason: string
		quote: InvalidPostQuoteResponse
	}[]
	exists: OrderbookQuote[]
}
