import { BigNumberish, TypedDataDomain, AddressLike } from 'ethers';

export interface PublishQuoteRequest {
	base: string
	quote: string
	expiration: string
	strike: number
	type: 'C' | 'P'
	side: 'buy' | 'sell'
	size: number
	price: number
	deadline: number
}

export interface SignatureDomain extends TypedDataDomain {
	name: string;
	version: string;
	chainId: string;
	verifyingContract: string;
}

export interface PoolKey {
	base: string;
	quote: string;
	oracleAdapter: string;
	strike: BigNumberish;
	maturity: BigNumberish;
	isCallPool: boolean;
}

export interface Quote {
	poolKey: PoolKey;
	provider: string;
	taker: string;
	price: bigint;
	size: bigint;
	isBuy: boolean;
	deadline: bigint;
	salt: bigint;
}

//TODO: Possible for 'v' to be a 'number'. Double check typing is correct
export interface RSV {
	r: string;
	s: string;
	v: number;
}

export interface PublishQuoteProxyRequest extends SerializedQuote {
	chainId: string;
}

export interface DeleteRequest {
	quoteId: string;
}

export interface FillRequest {
	quoteId: string;
	size: string;
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
	signature: {
		r: string;
		s: string;
		v: number;
	};
}

export interface GetFillableQuoteRequest {
	poolAddress: string;
	size: string;
	side: string;
	chainId: string;
	provider?: string;
	taker?: string;
}

export interface GetRFQRequest {
	poolAddress: string;
	side: string;
	chainId: string;
	taker: string;
	provider?: string;
}

export interface UnkeyAuthRequest {
	key: string;
}

export interface UnkeyAuthResponse {
	valid: boolean;
	ownerId: string;
	meta: any;
}

export interface GetAllQuotesRequest {
	chainId: string;
	poolAddress?: string;
	side?: string;
	provider?: string;
	size?: string;
}

export enum TokenType {
	SHORT = 0,
	LONG = 1,
}
export enum OrderType {
	CSUP,
	CS,
	LC,
}
export interface PoolKey {
	base: string;
	quote: string;
	oracleAdapter: string;
	strike: BigNumberish;
	maturity: BigNumberish;
	isCallPool: boolean;
}

export interface PosKey {
	owner: AddressLike;
	operator: AddressLike;
	lower: BigNumberish;
	upper: BigNumberish;
	orderType: OrderType; // Collateral <-> Long Option
}

export interface EventSignatures {
	[index: string]: string;
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

export interface Domain {
	name: string;
	version: string;
	chainId: string;
	verifyingContract: string;
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

export interface TokenIdParams {
	version: number;
	orderType: OrderType;
	operator: string;
	upper: BigNumberish;
	lower: BigNumberish;
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

export interface ExpiredOption {
	base: string
	quote: string
	expiration: string
	strike: number
	type: 'C' | 'P'
}