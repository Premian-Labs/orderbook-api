import {
	QuoteOB,
	PoolKey,
	PublishOBQuote,
	SerializedQuote,
} from '../types/quote'
import {
	Domain,
	EIP712Domain,
	RSV,
	QuoteOBMessage,
	SignedQuote,
} from '../types/signature'
import { Signer, ZeroAddress } from 'ethers'
import { chainId } from '../config/constants'
import moment from 'moment'

const randomId = () => Math.floor(Math.random() * 10000000000)

export function getQuote(
	makerAddr: string,
	tradeSize: bigint,
	isBuy: boolean,
	price: bigint,
	deadline: number,
	takerAddr = ZeroAddress
): QuoteOB {
	const ts = moment.utc().unix()
	return {
		provider: makerAddr,
		taker: takerAddr,
		price: price,
		size: tradeSize,
		isBuy: isBuy,
		deadline: BigInt(deadline),
		salt: BigInt(ts),
	}
}

export async function signQuote(
	signer: Signer,
	poolAddress: string,
	quoteOB: QuoteOB
): Promise<SignedQuote> {
	const domain: Domain = {
		name: 'Premia',
		version: '1',
		chainId: chainId,
		verifyingContract: poolAddress,
	}

	const message: QuoteOBMessage = {
		...quoteOB,
		price: quoteOB.price.toString(),
		size: quoteOB.size.toString(),
		deadline: quoteOB.deadline.toString(),
		salt: quoteOB.salt.toString(),
	}

	// TODO: create typed TypedData
	const typedData = {
		types: {
			EIP712Domain,
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
		domain,
		message,
	}
	const sig = await signWithEthers(signer, typedData)
	return { ...sig, ...message }
}

export const signWithEthers = async (
	signer: Signer,
	typeData: any
): Promise<RSV> => {
	const { EIP712Domain: _unused, ...types } = typeData.types
	const rawSignature = await signer.signTypedData(
		typeData.domain,
		types,
		typeData.message
	)
	return splitSignatureToRSV(rawSignature)
}

const splitSignatureToRSV = (signature: string): RSV => {
	const r = '0x' + signature.substring(2).substring(0, 64)
	const s = '0x' + signature.substring(2).substring(64, 128)
	const v = parseInt(signature.substring(2).substring(128, 130), 16)
	return { r, s, v }
}

export function createQuote(
	poolKey: PoolKey,
	quoteOB: QuoteOB,
	sig: SignedQuote
): PublishOBQuote {
	const signature = {
		r: sig.r,
		s: sig.s,
		v: sig.v,
	}

	return {
		poolKey: poolKey,
		provider: quoteOB.provider,
		taker: quoteOB.taker,
		price: quoteOB.price,
		size: quoteOB.size,
		isBuy: quoteOB.isBuy,
		deadline: quoteOB.deadline,
		salt: quoteOB.salt,
		signature: signature,
	}
}

export function serializeQuote(quote: PublishOBQuote): SerializedQuote {
	return {
		poolKey: {
			base: quote.poolKey.base,
			quote: quote.poolKey.quote,
			oracleAdapter: quote.poolKey.oracleAdapter,
			strike: quote.poolKey.strike.toString(),
			maturity: Number(quote.poolKey.maturity),
			isCallPool: quote.poolKey.isCallPool,
		},
		provider: quote.provider,
		taker: quote.taker,
		price: quote.price.toString(),
		size: quote.size.toString(),
		isBuy: quote.isBuy,
		deadline: Number(quote.deadline),
		salt: Number(quote.salt),
		signature: {
			r: quote.signature.r,
			s: quote.signature.s,
			v: Number(quote.signature.v),
		},
	}
}
