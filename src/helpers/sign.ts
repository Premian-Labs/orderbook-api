import {
	QuoteOB,
	PoolKey,
	PublishOBQuote,
	SerializedQuote,
} from '../types/quote';
import {
	Domain,
	EIP712Domain,
	RSV,
	QuoteOBMessage,
	SignedQuote,
} from '../types/signature';
import { ZeroAddress } from 'ethers';
import { Provider } from 'ethers';
//TODO: remove hardhat and keep typing
import { JsonRpcRequest } from 'hardhat/types';
import { chainId } from '../config/constants';

const randomId = () => Math.floor(Math.random() * 10000000000);

export async function getQuote(
	makerAddr: string,
	tradeSize: bigint,
	isBuy: boolean,
	price: bigint,
	deadline: number,
	takerAddr = ZeroAddress
): Promise<QuoteOB> {
	const ts = Math.trunc(new Date().getTime() / 1000);
	return {
		provider: makerAddr,
		taker: takerAddr,
		price: price,
		size: tradeSize,
		isBuy: isBuy,
		deadline: BigInt(deadline),
		salt: BigInt(ts),
	};
}

export async function signQuote(
	provider: Provider,
	poolAddress: string,
	quoteOB: QuoteOB
): Promise<SignedQuote> {
	const domain: Domain = {
		name: 'Premia',
		version: '1',
		chainId: chainId,
		verifyingContract: poolAddress,
	};

	const message: QuoteOBMessage = {
		...quoteOB,
		price: quoteOB.price.toString(),
		size: quoteOB.size.toString(),
		deadline: quoteOB.deadline.toString(),
		salt: quoteOB.salt.toString(),
	};

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
	};
	const sig = await signData(provider, quoteOB.provider, typedData);
	return { ...sig, ...message };
}

const signData = async (
	provider: any,
	fromAddress: string,
	typeData: any
): Promise<RSV> => {
	if (provider._signTypedData || provider.signTypedData) {
		return signWithEthers(provider, fromAddress, typeData);
	}
	const typeDataString =
		typeof typeData === 'string' ? typeData : JSON.stringify(typeData);

	const result = await send(provider, 'eth_signTypedData_v4', [
		fromAddress,
		typeDataString,
	]).catch((error: any) => {
		if (error.message === 'Method eth_signTypedData_v4 not supported.') {
			return send(provider, 'eth_signTypedData', [fromAddress, typeData]);
		} else {
			throw error;
		}
	});

	return {
		r: result.slice(0, 66),
		s: '0x' + result.slice(66, 130),
		v: parseInt(result.slice(130, 132), 16),
	};
};

const signWithEthers = async (
	signer: any,
	fromAddress: string,
	typeData: any
): Promise<RSV> => {
	const signerAddress = await signer.getAddress();
	if (signerAddress.toLowerCase() !== fromAddress.toLowerCase()) {
		throw new Error('Signer address does not match requested signing address');
	}

	const { EIP712Domain: _unused, ...types } = typeData.types;
	const rawSignature = await (signer.signTypedData
		? signer.signTypedData(typeData.domain, types, typeData.message)
		: signer._signTypedData(typeData.domain, types, typeData.message));

	return splitSignatureToRSV(rawSignature);
};

const splitSignatureToRSV = (signature: string): RSV => {
	const r = '0x' + signature.substring(2).substring(0, 64);
	const s = '0x' + signature.substring(2).substring(64, 128);
	const v = parseInt(signature.substring(2).substring(128, 130), 16);
	return { r, s, v };
};

export const send = (provider: any, method: string, params: any[]) =>
	new Promise<any>((resolve, reject) => {
		const payload: JsonRpcRequest = {
			id: randomId(),
			method,
			params,
			jsonrpc: '',
		};
		const callback = (err: any, result: any) => {
			if (err) {
				reject(err);
			} else if (result.error) {
				console.error(result.error);
				reject(result.error);
			} else {
				resolve(result.result);
			}
		};

		const _provider =
			provider.provider?.provider || provider.provider || provider;

		if (_provider.getUncheckedSigner /* ethers provider */) {
			_provider
				.send(method, params)
				.then((r: any) => resolve(r))
				.catch((e: any) => reject(e));
		} else if (_provider.sendAsync) {
			_provider.sendAsync(payload, callback);
		} else {
			_provider.send(payload, callback).catch((error: any) => {
				if (
					error.message ===
					"Hardhat Network doesn't support JSON-RPC params sent as an object"
				) {
					_provider
						.send(method, params)
						.then((r: any) => resolve(r))
						.catch((e: any) => reject(e));
				} else {
					throw error;
				}
			});
		}
	});

export function createQuote(
	poolKey: PoolKey,
	quoteOB: QuoteOB,
	sig: SignedQuote
): PublishOBQuote {
	const signature = {
		r: sig.r,
		s: sig.s,
		v: sig.v,
	};

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
	};
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
	};
}
