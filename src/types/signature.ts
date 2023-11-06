export interface Domain {
	name: string
	version: string
	chainId: string
	verifyingContract: string
}
export interface RSV {
	r: string
	s: string
	v: number
}
export interface QuoteOBMessage {
	provider: string
	taker: string
	price: string
	size: string
	isBuy: boolean
	deadline: string
	salt: string
}

export interface SignedQuote extends QuoteOBMessage {
	r: string
	s: string
	v: number
}

export interface TypedSignQuoteRequest {
	types: {
		FillQuoteOB: [
			{ name: 'provider', type: 'address' },
			{ name: 'taker', type: 'address' },
			{ name: 'price', type: 'uint256' },
			{ name: 'size', type: 'uint256' },
			{ name: 'isBuy', type: 'bool' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'salt', type: 'uint256' },
		],
	},
	primaryType: 'FillQuoteOB',
	domain: Domain,
	message: QuoteOBMessage,
}
