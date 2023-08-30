import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import moment from 'moment';
import * as _ from 'lodash';
import Logger from './lib/logger';
import { ethers, Contract, parseEther, MaxUint256, parseUnits } from 'ethers';
import poolABI from './abi/IPool.json';
import {
	GroupedDeleteRequest,
	MoralisTokenBalance,
	Option,
	OptionPositions,
	PublishQuoteProxyRequest,
	PublishQuoteRequest,
	TokenApproval,
	TokenBalance,
	TokenType,
} from './helpers/types';
import { checkTestApiKey } from './helpers/auth';
import {
	validateDeleteQuotes,
	validateFillQuotes,
	validateGetAllQuotes,
	validateGetFillableQuotes,
	validateGetRFQQuotes,
	validatePostQuotes,
	validatePositionManagement,
	validateApprovals,
} from './helpers/validators';
import {
	getPoolAddress,
	createExpiration,
	createPoolKey,
	optionExpired,
	preProcessExpOption,
	preProcessAnnhilate,
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
import { ERC20Base__factory, IPool } from './typechain';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

dotenv.config();

if (
	!process.env.ENV ||
	!process.env.WALLET_PRIVATE_KEY ||
	!process.env.WALLET_ADDRESS ||
	!process.env.LOCAL_URL
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
export const moralisChainId =
	process.env.ENV === 'production' ? EvmChain.ARBITRUM : EvmChain.GOERLI;
export const availableTokens =
	process.env.ENV === 'production'
		? Object.keys(arb.tokens)
		: Object.keys(arbGoerli.tokens);
export const signer = new ethers.Wallet(privateKey, provider);
const routerAddress =
	process.env.ENV == 'production' ? arb.ERC20Router : arbGoerli.ERC20Router;

// TODO: remove when moralis migrates to cloud
Moralis.start({
	apiKey: process.env.MORALIS_KEY,
}).then(() => console.log('Moralis SDK connected'));

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
		let expiration: number;
		try {
			expiration = createExpiration(quote.expiration);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({
				message: e,
				quote: quote,
			});
		}

		// 2.3 Create Pool Key
		const poolKey = createPoolKey(quote, expiration);

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
	const valid = validateFillQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateFillQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	// TODO: deserialize QuoteOBMessage[] w/ poolKey to QuoteOB[]
	// TODO: generate (provide) poolKey
	// TODO: get poolAddress (
	// TODO: group by collateral type (type C && base + type P && quote)
	// TODO: check balance to ensure we can do all quotes (parse by collateral type, and ensure we can fill everything)
	// TODO: invoke Web3 fillQuoteOB
});

app.delete('/orderbook/quotes', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validateDeleteQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateDeleteQuotes.errors)}`
		);
		return res.send(validateDeleteQuotes.errors);
	}

	const deleteByPoolAddr = _.groupBy(
		req.body,
		'poolAddress'
	) as GroupedDeleteRequest;

	const promiseAll = Promise.all(
		Object.keys(deleteByPoolAddr).map(async (poolAddress) => {
			const poolContract = new Contract(poolAddress, poolABI, signer);

			const quoteIds = deleteByPoolAddr[poolAddress].map(
				(quotes) => quotes.quoteId
			);

			Logger.debug(`Cancelling quotes ${quoteIds}...`);
			const cancelTx = await poolContract.cancelQuotesOB(quoteIds);
			await provider.waitForTransaction(cancelTx.hash, 1);
			Logger.debug(`Quotes ${quoteIds} cancelled`);
		})
	);

	// TODO: make error display failed quoteIds
	promiseAll
		.then(() => res.status(201).json({ message: `Quotes deleted` }))
		.catch((e) => {
			Logger.error(e);
			res.status(500).json({ message: e });
		});
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
	const valid = validatePositionManagement(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePositionManagement.errors)}`
		);
		return res.send(validatePositionManagement.errors);
	}

	let options = req.body as Option[];
	let pool: IPool;

	for (const option of options) {
		// 2. check all user inputs are valid for option settlement
		try {
			pool = await preProcessExpOption(option, TokenType.SHORT);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({
				message: e,
				option: option,
			});
		}
		// 3 invoke onchain settle function for option
		try {
			const settleTx = await pool.settle();
			await provider.waitForTransaction(settleTx.hash, 1);
		} catch (e) {
			Logger.error(e);
			return res.status(500).json({ message: e, option: option });
		}
	}

	res.sendStatus(200);
});

app.post('/pool/exercise', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePositionManagement(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePositionManagement.errors)}`
		);
		return res.send(validatePositionManagement.errors);
	}

	let options = req.body as Option[];
	let pool: IPool;

	for (const option of options) {
		// 2. check all user inputs are valid for option settlement
		try {
			pool = await preProcessExpOption(option, TokenType.LONG);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({
				message: e,
				option: option,
			});
		}

		// 3. invoke onchain exercise function for option
		try {
			const exerciseTx = await pool.exercise();
			await provider.waitForTransaction(exerciseTx.hash, 1);
		} catch (e) {
			Logger.error(e);
			return res.status(500).json({ message: e, option: option });
		}
	}

	res.sendStatus(200);
});

app.post('/pool/annihilate', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePositionManagement(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePositionManagement.errors)}`
		);
		return res.send(validatePositionManagement.errors);
	}

	let options = req.body as Option[];
	let pool: IPool;
	let size: bigint;

	for (const option of options) {
		// 2. check all user inputs are valid for option settlement
		try {
			[pool, size] = await preProcessAnnhilate(option);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({
				message: e,
				option: option,
			});
		}

		// 3. invoke onchain annihilate function for option
		try {
			const annihilateTx = await pool.annihilate(size, {
				gasLimit: 1400000,
			});
			await provider.waitForTransaction(annihilateTx.hash, 1);
		} catch (e) {
			Logger.error(e);
			return res.status(500).json({ message: e, option: option });
		}
	}

	res.sendStatus(200);
});

app.get('/account/option_balances', async (req, res) => {
	// FIXME: in production, we can not return balances for arbitrum goerli
	// TODO: Check for moralis update to `disable_total` in comings days
	// TODO: parseEther balances
	let moralisResponse;
	try {
		moralisResponse = await Moralis.EvmApi.nft.getWalletNFTs({
			chain: moralisChainId,
			format: 'decimal',
			disableTotal: false,
			mediaItems: false,
			address: walletAddr,
		});
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'Internal server error' });
	}

	const NFTBalances = moralisResponse.toJSON().result;
	if (NFTBalances === undefined)
		return res.status(404).json({ message: 'No positions found' });

	let optionBalances: OptionPositions = {
		open: [],
		expired: [],
	};

	NFTBalances.forEach((NFTBalance) => {
		const product = NFTBalance.name.split('-');

		const approvedTokens =
			availableTokens.includes(product[0]) &&
			availableTokens.includes(product[1]);
		const approvedOptionType = product[4] === 'P' || product[4] === 'C';
		const approvedStrike = !isNaN(Number(product[3]));
		const approvedExp = moment.utc(product[2], 'DDMMMYYYY').isValid();

		if (approvedTokens && approvedOptionType && approvedStrike && approvedExp) {
			const optionHasExpired = optionExpired(product[2]);

			if (optionHasExpired) {
				optionBalances.expired.push({
					name: NFTBalance.name,
					token_address: NFTBalance.token_address,
					amount: NFTBalance.amount!,
				});
			} else {
				optionBalances.open.push({
					name: NFTBalance.name,
					token_address: NFTBalance.token_address,
					amount: NFTBalance.amount!,
				});
			}
		}
	});

	res.status(200).json(optionBalances);
});

app.get('/account/orders', async (req, res) => {
	const proxyResponse = await proxyHTTPRequest('orders', 'GET', {
		provider: walletAddr,
		chainId: moralisChainId,
	});
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.get('/account/collateral_balances', async (req, res) => {
	// FIXME: in production, we can not return balances for arbitrum goerli
	// TODO: parseEther balances
	let tokenBalances;
	try {
		tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
			chain: moralisChainId,
			address: walletAddr,
		});
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'Internal server error' });
	}

	const filteredTokenBalances = tokenBalances.toJSON().filter((token) => {
		return availableTokens.includes(token.symbol);
	}) as MoralisTokenBalance[];

	const finalTokenBalances = filteredTokenBalances.map(
		({ name, logo, thumbnail, possible_spam, decimals, ...item }) => item
	) as TokenBalance[];

	res.status(200).json(finalTokenBalances);
});

app.get('/account/native_balance', async (req, res) => {
	// FIXME: in production, we can not return balances for arbitrum goerli
	// TODO: parseEther balances
	let nativeBalance;
	try {
		nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
			chain: moralisChainId,
			address: walletAddr,
		});
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'Internal server error' });
	}

	res.status(200).json(nativeBalance);
});

app.post('/account/collateral_approval', async (req, res) => {
	const valid = validateApprovals(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateApprovals.errors)}`
		);
		return res.send(validateApprovals.errors);
	}

	const approvals = req.body as TokenApproval[];

	// TODO: create promise all wrapper (and catch)
	try {
		for (const approval of approvals) {
			const erc20Addr =
				process.env.ENV == 'production'
					? arb.tokens[approval.token]
					: arbGoerli.tokens[approval.token];
			const erc20 = ERC20Base__factory.connect(erc20Addr, signer);

			if (approval.amt === 'max') {
				const response = await erc20.approve(
					routerAddress,
					MaxUint256.toString()
				);
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${approval.token} approval set to MAX`);
			} else {
				const qty =
					approval.token === 'USDC'
						? parseUnits(approval.amt.toString(), 6)
						: parseEther(approval.amt.toString());
				const response = await erc20.approve(routerAddress, qty);
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${approval.token} approval set to ${approval.amt}`);
			}
		}
	} catch (e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(200);
});

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
