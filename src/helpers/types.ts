import { BigNumberish, TypedDataDomain } from 'ethers';

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

export interface RSV {
	r: string;
	s: string;
	v: bigint;
}

// typings used to publish quote on-chain
export interface DeSerializedOBQuote extends Quote {
	signature: RSV;
}

export interface AJVQuote extends OBQuoteSerialized {
	chainId: string;
}

// typings used in req body for POST '/quotes'
export interface PostQuoteRequest extends AJVQuote {
	poolAddress: string;
}

export interface RedisPostQuoteRequest extends PostQuoteRequest {
	quoteId: string;
}
// final Typings to submit quotes to redis
export interface RedisQuote extends RedisPostQuoteRequest {
	fillableSize: string;
	ts: number;
}

export interface DeleteRequest {
	quoteId: string;
}

export interface FillRequest {
	quoteId: string;
	size: string;
}

export interface OBQuoteSerialized {
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
