import { ReturnedOrderbookQuote } from '../../src/types/quote'
import { RejectedTokenBalance, TokenBalance } from '../../src/types/balances'

export interface CoinPrice {
	WBTC: number
	WETH: number
	ARB: number
}

export type Market = 'WETH' | 'WBTC' | 'ARB'

export interface OptionsTableData {
	expiration: string
	positions: {
		quotes: ReturnedOrderbookQuote[]
		strike: number
	}[]
}

export interface OrderbookRows {
	// call_delta: number | '-'
	call_bid_size: number | '-'
	call_bid_iv: number | '-' | string
	call_bid: number | '-' | string
	call_mark: number | '-' | string
	call_ask: number | '-' | string
	call_ask_iv: number | '-' | string
	call_ask_size: number | '-'
	call_positions: number | '-'
	strike: number
	// put_delta: number | '-'
	put_bid_size: number | '-'
	put_bid_iv: number | '-' | string
	put_bid: number | '-' | string
	put_mark: number | '-' | string
	put_ask: number | '-' | string
	put_ask_iv: number | '-' | string
	put_ask_size: number | '-'
	put_positions: number | '-'
}

export interface OwnOrdersRows {
	instrument: string
	side: 'bid' | 'ask'
	amount: number | string
	price: number | string
	expiration: string
}

export interface CollateralBalances {
	success: TokenBalance[]
	failed: RejectedTokenBalance[]
}

export interface OpenPosition {
	base: string
	quote: string
	expiration: string
	strike: number
	type: string
	amount: number
}
