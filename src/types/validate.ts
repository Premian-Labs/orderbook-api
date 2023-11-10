// validateOptionEntity & validatePositionManagement
// NOTE: Returned Quote Objects include Option type
export interface Option {
	base: string //token name | token address
	quote: string //token name | token address
	expiration: string | number
	strike: number
	type: 'C' | 'P'
}

// validatePostQuotes
export interface PublishQuoteRequest {
	base: string // token name
	quote: string // token name
	expiration: string
	strike: number
	type: 'C' | 'P'
	side: 'bid' | 'ask'
	size: number
	price: number
	deadline: number
	taker?: string
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
export interface GetFillableQuotes extends Option {
	size: number
	side: 'bid' | 'ask'
	provider?: string
	taker?: string
}

// validateApprovals & collateral_approvals
export interface TokenApproval {
	token: string
	amt: number | 'max'
}

export interface TokenApprovalError {
	message: string
	token: TokenApproval
	error: any
}
