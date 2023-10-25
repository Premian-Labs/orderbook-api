export interface Domain {
	name: string
	version: string
	chainId: string
	verifyingContract: string
}
export const EIP712Domain = [
	{ name: 'name', type: 'string' },
	{ name: 'version', type: 'string' },
	{ name: 'chainId', type: 'uint256' },
	{ name: 'verifyingContract', type: 'address' },
]
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

export interface JsonRpcRequest {
	jsonrpc: string
	method: string
	params: any[]
	id: number
}
