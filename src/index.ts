import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import moment from 'moment';
import Logger from './lib/logger';
import {
	ethers,
	Contract,
	parseEther,
	MaxUint256,
	parseUnits,
} from 'ethers';
import poolABI from './abi/IPool.json';
import {
	Option, OptionPositions,
	PoolKey,
	PublishQuoteProxyRequest,
	PublishQuoteRequest,
	TokenType
} from './helpers/types';
import { checkTestApiKey } from './helpers/auth';
import {
	validateDeleteQuotes,
	validateFillQuotes,
	validateGetAllQuotes,
	validateGetFillableQuotes,
	validateGetRFQQuotes,
	validatePostQuotes,
	validateManagePos
} from './helpers/validators';
import {
	getPoolAddress,
	processExpiredOptions,
	annihilateOptions, createExpiration, createPoolKey
} from './helpers/utils';
import { proxyHTTPRequest } from './helpers/proxy';
import arb from './config/arbitrum.json';
import arbGoerli from './config/arbitrumGoerli.json';
import {
	getQuote,
	signQuote,
	createQuote,
	serializeQuote,
} from './helpers/quote';
import { ERC20Base__factory } from './typechain';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

dotenv.config();

if (
	!process.env.ENV ||
	!process.env.WALLET_PRIVATE_KEY ||
	!process.env.WALLET_ADDRESS ||
	!process.env.BASE_URL
) {
	throw new Error(`Missing Core Credentials`);
}

if (
	process.env.ENV == 'development' &&
	(!process.env.TESTNET_RPC_URL || !process.env.TESTNET_ORDERBOOK_API_KEY)
) {
	throw new Error(`Missing Testnet Credentials`);
}

if (
	process.env.ENV == 'production' &&
	(!process.env.MAINNET_RPC_URL || !process.env.MAINNET_ORDERBOOK_API_KEY)
) {
	throw new Error(`Missing Mainnet Credentials`);
}

// TODO: remove when moralis migration to cloud happens
if (!process.env.MORALIS_KEY || !process.env.ENV) {
	throw new Error(`Balance Credentials Missing`);
}

const rpc_url =
	process.env.ENV == 'production'
		? process.env.MAINNET_RPC_URL
		: process.env.TESTNET_RPC_URL;

const privateKey = process.env.WALLET_PRIVATE_KEY;
export const walletAddr = process.env.WALLET_ADDRESS;
export const provider = new ethers.JsonRpcProvider(rpc_url);
export const chainId = process.env.ENV == 'production' ? '42161' : '421613';

// FIXME: Moralis Wallet API does not work for ARBITRUM_TESTNET. This is Patch for testing
export const moralisChainId = process.env.ENV === 'production' ? EvmChain.ARBITRUM : EvmChain.GOERLI;
export const availableTokens = process.env.ENV === 'production' ? Object.keys(arb.tokens) : Object.keys(arbGoerli.tokens)
export const signer = new ethers.Wallet(privateKey, provider);
const routerAddress =
	process.env.ENV == 'production' ? arb.ERC20Router : arbGoerli.ERC20Router;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(checkTestApiKey);

app.post('/orderbook/quotes', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePostQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	let serializedQuotes: PublishQuoteProxyRequest[] = [];
	// 2. Loop through each order and convert to signed quote object
	for (const quote of req.body as PublishQuoteRequest[]) {

		// 2.1 Check that deadline is valid and generate deadline timestamp
		const ts = Math.trunc(new Date().getTime() / 1000);
		let deadline: number;
		if (quote.deadline < 60) {
			return res.status(400).json({
				message: 'Quote deadline is invalid (cannot be less than 60 sec)',
				quote: quote,
			});
		} else {
			deadline = ts + quote.deadline;
		}

		// 2.2 validate/create timestamp expiration
		let expiration: number
		try{
			expiration = createExpiration(quote.expiration)
		} catch(e){
			Logger.error(e);
			return res.status(400).json({
				message: e ,
				quote: quote
			});
		}

		// 2.3 Create Pool Key
		const poolKey = createPoolKey(quote, expiration)

		// 2.4 Get PoolAddress
		const poolAddr = await getPoolAddress(poolKey);

		// 2.5 Generate a initial quote object
		const quoteOB = await getQuote(
			process.env.WALLET_ADDRESS!,
			parseEther(quote.size.toString()),
			quote.side === 'buy',
			parseEther(quote.price.toString()),
			deadline,
			quote.taker
		);

		// 2.6 Sign quote object
		const signedQuote = await signQuote(provider, poolAddr, quoteOB);
		const publishQuote = createQuote(poolKey, quoteOB, signedQuote);

		// 2.7 Serialize quote
		const serializedQuote = serializeQuote(publishQuote);

		// 2.8 Add chain id to quote object
		const publishQuoteRequest = {
			...serializedQuote,
			chainId: chainId,
		};

		// 2.9 Add quote the object array
		serializedQuotes.push(publishQuoteRequest);
	}

	// 3 Submit quote object array to orderbook API
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'POST',
		null,
		serializedQuotes
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.patch('/orderbook/quotes', async (req, res) => {
	// TODO: request object must have pool key components
	const valid = validateFillQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateFillQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	//TODO: invoke Web3 fillQuoteOB
});

app.delete('/orderbook/quotes', async (req, res) => {
	// TODO: request object must have pool key components
	const valid = validateDeleteQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateDeleteQuotes.errors)}`
		);
		return res.send(validateDeleteQuotes.errors);
	}
	const poolAddr = await getPoolAddress(req.body.poolKey);
	const poolContract = new Contract(poolAddr, poolABI, signer);
	try {
		const cancelTx = await poolContract.cancelQuotesOB(req.body);
		await provider.waitForTransaction(cancelTx.hash, 1);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'RPC provider error' });
	}

	res.status(201).json({ message: `Quote ${req.body.quoteId} deleted` });
});

app.post('/orderbook/validate_quote', async (req, res) => {
	// TODO: check if a quote is valid - Web3 call
});

app.get('/orderbook/quotes', async (req, res) => {
	const valid = validateGetFillableQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetFillableQuotes.errors)}`
		);
		return res.send(validateGetFillableQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'GET',
		req.query,
		null
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.get('/orderbook/orders', async (req, res) => {
	const valid = validateGetAllQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetAllQuotes.errors)}`
		);
		return res.send(validateGetAllQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'orders',
		'GET',
		req.query,
		null
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.get('/orderbook/private_quotes', async (req, res) => {
	const valid = validateGetRFQQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetRFQQuotes.errors)}`
		);
		return res.send(validateGetRFQQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'rfq_quotes',
		'GET',
		req.query,
		null
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.post('/pool/settle', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validateManagePos(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}

	try {
		await processExpiredOptions(req.body as Option[], TokenType.SHORT);
	} catch (e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
});

app.post('/pool/exercise', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validateManagePos(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}

	try {
		await processExpiredOptions(req.body as Option[], TokenType.LONG);
	} catch (e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
});

app.post('/pool/annihilate', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validateManagePos(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}

	// 2. Annihilate
	try {
		await annihilateOptions(req.body as Option[]);
	} catch (e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
});

app.get('/account/option_balances', async (req, res) => {
	//FIXME: in production, we can not return balances for arbitrum goerli
	await Moralis.start({
		apiKey: process.env.MORALIS_KEY,
	});

	// TODO: Check for moralis update to `disable_total` in comings days
	const moralisResponse = await Moralis.EvmApi.nft.getWalletNFTs({
		chain: moralisChainId,
		format: 'decimal',
		disableTotal: false,
		mediaItems: false,
		address: walletAddr,
	});

	const NFTBalances= moralisResponse.toJSON().result
	if (NFTBalances === undefined)
		return []

	let optionBalances: OptionPositions  = {
		open: [],
		expired: []
	}

	NFTBalances.forEach(NFTBalance => {
		const product = NFTBalance.name.split('-')

		const approvedTokens = availableTokens.includes(product[0]) && availableTokens.includes(product[1])
		const approvedOptionType = (product[4] === 'P' || product[4] === 'C')
		const approvedStrike = !isNaN(Number(product[3]))
		const approvedExp = moment(product[2], 'DDMMMYYYY').isValid()

		if (approvedTokens && approvedOptionType && approvedStrike && approvedExp){

			const maturity = moment(product[2], 'DDMMMYYYY').set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
			const maturitySec = maturity.valueOf() / 1000
			const ts = Math.trunc(new Date().getTime() / 1000);

			if (maturitySec < ts){
				optionBalances.expired.push({
					name: NFTBalance.name,
					token_address: NFTBalance.token_address,
					amount: NFTBalance.amount!
				})
			} else {
				optionBalances.open.push({
					name: NFTBalance.name,
					token_address: NFTBalance.token_address,
					amount: NFTBalance.amount!
				})
			}
		}
	})

	//TODO: cover failure cases
	res.status(200).json(optionBalances);
});

app.get('/account/orders', async (req, res) => {
	//TODO: should we be using the params input?
	const proxyResponse = await proxyHTTPRequest(
		`orders?${walletAddr}${chainId}`,
		'GET'
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.get('/account/collateral_balances', async (req, res) => {
	//FIXME: in production, we can not return balances for arbitrum goerli
	await Moralis.start({
		apiKey: process.env.MORALIS_KEY,
	});

	const tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
		chain: moralisChainId,
		address: walletAddr,
	});

	const filteredTokenBalances = tokenBalances.toJSON().filter (token => {
		return availableTokens.includes(token.symbol)
	})

	const finalTokenBalances = filteredTokenBalances.map(
		({name, logo, thumbnail, possible_spam, decimals, ...item}) => item
	)

	//TODO: cover failure cases
	res.status(200).json(finalTokenBalances);

	/*
	[
		{
			token_address: '0x326c977e6efc84e512bb9c30f76e30c160ed06fb',
			symbol: 'LINK',
			balance: '20000000000000000000'
		},
	]
	 */
});

app.get('/account/native_balance', async (req, res) => {
	//FIXME: in production, we can not return balances for arbitrum goerli
	await Moralis.start({
		apiKey: process.env.MORALIS_KEY,
	});


	const nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
		chain: moralisChainId,
		address: walletAddr,
	});

	//TODO: cover failure cases
	res.status(200).json(nativeBalance);

	/*
	 { balance: '16252939612884666622' }
	 */

});

app.post('/account/collateral_approval', async (req, res) => {
	// TODO: convert to req.body. Just an example.
	const approvals = { WETH: 17, USDC: 'max' };

	//TODO: validate that tokens in req body exist in token object for specified chain
	//TODO: validate that approval qty is either a number or 'max'

	try {
		for (const token in approvals) {
			const erc20Addr =
				process.env.ENV == 'production'
					? arb.tokens[token]
					: arbGoerli.tokens[token];
			const erc20 = ERC20Base__factory.connect(erc20Addr, signer);

			if (approvals[token] === 'max') {
				const response = await erc20.approve(
					routerAddress,
					MaxUint256.toString()
				);
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${token} approval set to MAX`);
			} else {
				const qty =
					approvals[token] == 'USDC'
						? parseUnits(approvals[token].toString(), 6)
						: parseEther(approvals[token].toString());
				const response = await erc20.approve(routerAddress, qty);
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${token} approval  set to ${approvals[token]}`);
			}
		}
	} catch (e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
});

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
