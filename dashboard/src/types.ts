export interface IVResponse {
	strike: number
	iv: number
}

export interface SpotResponse {
	market: string
	price: number
}

export interface SpotPrice {
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

export interface RejectedTokenBalance {
	token: string
	reason: any
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

export interface IVResponseExtended {
	expiration: string
	market: string
	ivs: IVResponse[]
}

export interface NFTBalance {
	token_address: string
	amount: number
	name: string
	exposure: 'SHORT' | 'LONG'
}

export interface OptionPositions {
	open: NFTBalance[]
	expired: NFTBalance[]
}

export interface TokenBalance {
	token_address: string
	symbol: string
	balance: number | string
}

export interface Option {
	base: string //token name | token address
	quote: string //token name | token address
	expiration: string // i.e. 23NOV2023
	strike: number
	type: 'C' | 'P'
}

export interface ReturnedOrderbookQuote extends Option {
	side: 'bid' | 'ask'
	remainingSize: number
	price: number
	provider: string
	taker: string
	deadline: number
	quoteId: string
	ts: number
}
