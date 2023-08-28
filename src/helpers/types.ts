import { BigNumberish } from 'ethers';

export interface Domain {
	name: string;
	version: string;
	chainId: string;
	verifyingContract: string;
}

export interface PublishQuoteRequest {
	base: string;
	quote: string;
	expiration: string;
	strike: number;
	type: 'C' | 'P';
	side: 'buy' | 'sell';
	size: number;
	price: number;
	deadline: number;
	taker?: string;
}

export interface PoolKey {
	base: string;
	quote: string;
	oracleAdapter: string;
	strike: BigNumberish;
	maturity: BigNumberish;
	isCallPool: boolean;
}

export interface RSV {
	r: string;
	s: string;
	v: number;
}

export interface PublishQuoteProxyRequest extends SerializedQuote {
	chainId: string;
}

export interface DeleteRequest {
	poolAddress: string;
	quoteId: string;
}

export interface SerializedQuote {
	poolKey: {
		base: string;
		quote: string;
		oracleAdapter: string;
		strike: string;
		maturity: number;
		isCallPool: boolean;
	};
	provider: string;
	taker: string;
	price: string;
	size: string;
	isBuy: boolean;
	deadline: number;
	salt: number;
	signature: RSV;
}

export interface UnkeyAuthRequest {
	key: string;
}

export interface UnkeyAuthResponse {
	valid: boolean;
	ownerId: string;
	meta: any;
}

export enum TokenType {
	SHORT = 0,
	LONG = 1,
}
export interface PoolKey {
	base: string;
	quote: string;
	oracleAdapter: string;
	strike: BigNumberish;
	maturity: BigNumberish;
	isCallPool: boolean;
}

export interface QuoteOB {
	provider: string;
	taker: string;
	price: BigNumberish;
	size: BigNumberish;
	isBuy: boolean;
	deadline: BigNumberish;
	salt: BigNumberish;
}
export interface QuoteOBMessage {
	provider: string;
	taker: string;
	price: string;
	size: string;
	isBuy: boolean;
	deadline: string;
	salt: string;
}

export const EIP712Domain = [
	{ name: 'name', type: 'string' },
	{ name: 'version', type: 'string' },
	{ name: 'chainId', type: 'uint256' },
	{ name: 'verifyingContract', type: 'address' },
];

export interface PublishOBQuote {
	poolKey: PoolKey;
	provider: string;
	taker: string;
	price: BigNumberish;
	size: BigNumberish;
	isBuy: boolean;
	deadline: BigNumberish;
	salt: BigNumberish;
	signature: RSV;
}

export interface SignedQuote {
	provider: string;
	taker: string;
	price: string;
	size: string;
	isBuy: boolean;
	deadline: string;
	salt: string;
	r: string;
	s: string;
	v: number;
}

export interface Option {
	base: string;
	quote: string;
	expiration: string;
	strike: number;
	type: 'C' | 'P';
}

export interface NFTBalance {
	token_address: string;
	amount: string;
	name: string;
}

export interface OptionPositions {
	open: NFTBalance[];
	expired: NFTBalance[];
}

export interface MoralisTokenBalance extends TokenBalance {
	name: string;
	logo?: string | undefined;
	thumbnail?: string | undefined;
	decimals: number;
	possible_spam: boolean;
}

export interface TokenBalance {
	token_address: string;
	symbol: string;
	balance: string;
}
