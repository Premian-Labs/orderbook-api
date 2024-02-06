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
	call_bid: number | '-' | string
	call_ask: number | '-' | string
	call_iv: number | '-'
	call_delta: number | '-'
	call_size: number | '-'
	call_position: number | '-'
	strike: number | '-'
	put_bid: number | '-' | string
	put_ask: number | '-' | string
	put_iv: number | '-'
	put_delta: number | '-'
	put_size: number | '-'
	put_position: number | '-'
}
