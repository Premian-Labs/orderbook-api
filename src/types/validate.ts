// validateOptionEntity & validatePositionManagement
// NOTE: Returned Quote Objects include Option type
export interface Option {
	base: string //token name | token address
	quote: string //token name | token address
	expiration: string // i.e. 23NOV2023
	strike: number
	type: 'C' | 'P'
}

// validatePostQuotes
export interface PublishQuoteRequest extends Option {
	side: 'bid' | 'ask'
	size: number
	price: number
	deadline: number
	taker?: string
}

// validateGetAllQuotes
export interface GetOrdersRequest {
	poolAddress?: string
	size?: string
	side?: 'bid' | 'ask'
	provider?: string
	chainId?: string
	type?: 'invalid'
}

// validateFillQuotes
export interface FillQuoteRequest {
	tradeSize: number
	quoteId: string
}

// validateDeleteQuotes & validateGetAllQuotes
export interface QuoteIds {
	quoteIds: string[]
}

// validateGetFillableQuotes
export interface GetFillableQuotes extends Omit<Option, 'strike'> {
	strike: string
	size: string
	side: 'bid' | 'ask'
	provider?: string
	taker?: string
}

// validateApprovals & collateral_approvals
export interface TokenApproval {
	token: string
	amt: number | 'max'
}

export interface CollateralApprovalResponse {
	success: TokenApproval[]
	failed: any[]
}

export interface TokenApprovalError {
	message: string
	token: TokenApproval
	error: any
}

export interface GetPoolsParams {
	base?: string
	quote?: string
	expiration?: string
}

export interface GetBalance {
	walletAddr?: string
}

export interface StrikesRequestSymbol {
	market: string
}

export interface StrikesRequestSpot {
	spotPrice: string
}

export interface IVRequest {
	market: string
	expiration: string
	spotPrice?: string
}

export interface IVResponse {
	strike: number
	iv: number
}

export interface SpotRequest {
	markets: string[]
}

export interface SpotResponse {
	market: string
	price: number
}

export interface VaultQuoteRequest extends Omit<Option, 'strike'> {
	strike: string
	size: string
	direction: 'buy' | 'sell'
}
export interface VaultTradeRequest extends Option {
	size: number
	direction: 'buy' | 'sell'
	premiumLimit: number
}

export interface VaultMarket {
	vault: string
	strike: number
	expiration: string
	size: number
	direction: 'buy' | 'sell'
}
export interface VaultTradeResponse {
	market: VaultMarket
}

export interface VaultQuoteResponse {
	market: VaultMarket
	quote: number
	takerFee: number
}
