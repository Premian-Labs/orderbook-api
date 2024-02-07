import { ReturnedOrderbookQuote } from '../../src/types/quote'

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
