// validateOptionEntity & validatePositionManagement
// NOTE: Returned Quote Objects include Option type
export interface Option {
	base: string;
	quote: string;
	expiration: string | number;
	strike: number;
	type: 'C' | 'P';
}

// validatePostQuotes
export interface PublishQuoteRequest {
	base: string;
	quote: string;
	expiration: string;
	strike: number;
	type: 'C' | 'P';
	side: 'bid' | 'ask';
	size: number;
	price: number;
	deadline: number;
	taker?: string;
}

// validateFillQuotes
export interface FillQuoteRequest {
	tradeSize: number;
	quoteId: string;
}

// validateDeleteQuotes & validateGetAllQuotes
export interface QuoteIds {
	quoteIds: string[];
}

// validateGetFillableQuotes
export interface GetFillableQuotes extends Option {
	size: number;
	side: 'bid' | 'ask';
	provider?: string;
	taker?: string;
}

// validateApprovals
export interface TokenApproval {
	token: string;
	amt: number | 'max';
}