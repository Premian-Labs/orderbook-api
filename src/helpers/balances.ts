import dotenv from 'dotenv';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

dotenv.config();

if (!process.env.MORALIS_KEY || !process.env.ENV) {
	throw new Error(`Balance Credentials Missing`);
}

// TODO: test to see if arb goerli works (likely not)
const chain = process.env.ENV === 'production' ? EvmChain.ARBITRUM : EvmChain.GOERLI;

export async function getOptionPositions(_address: string) {
	await Moralis.start({
		apiKey: process.env.MORALIS_KEY
	});

	const response =  await Moralis.EvmApi.nft.getWalletNFTs({
		"chain": chain,
		"format": "decimal",
		"mediaItems": false,
		"address": _address
	});

	console.log(response.toJSON());

	return response

}