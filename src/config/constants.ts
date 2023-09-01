import { ethers, ZeroAddress } from 'ethers';
import dotenv from 'dotenv';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import arb from './arbitrum.json';
import arbGoerli from './arbitrumGoerli.json';

dotenv.config();

export const arbGoerliOrderbookUrl: string =
	'https://test.orderbook.premia.finance';
export const arbOrderbookUrl: string = 'https://orderbook.premia.finance';
export const gasLimit: number = 1400000;

export const referralAddress = ZeroAddress;
export const rpcUrl =
	process.env.ENV == 'production'
		? process.env.MAINNET_RPC_URL!
		: process.env.TESTNET_RPC_URL!;

export const privateKey = process.env.WALLET_PRIVATE_KEY!;
export const walletAddr = process.env.WALLET_ADDRESS!;
export const provider = new ethers.JsonRpcProvider(rpcUrl);
export const chainId = process.env.ENV == 'production' ? '42161' : '421613';

// FIXME: Moralis Wallet API does not work for ARBITRUM_TESTNET. This is Patch for testing
export const moralisChainId =
	process.env.ENV === 'production' ? EvmChain.ARBITRUM : EvmChain.GOERLI;
export const availableTokens =
	process.env.ENV === 'production'
		? Object.keys(arb.tokens)
		: Object.keys(arbGoerli.tokens);

export const tokenAddresses =
	process.env.ENV === 'production' ? arb.tokens : arbGoerli.tokens;
export const signer = new ethers.Wallet(privateKey, provider);
export const routerAddress =
	process.env.ENV == 'production' ? arb.ERC20Router : arbGoerli.ERC20Router;
