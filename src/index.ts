import express from 'express';
import httpProxy from 'http-proxy';
import cors from 'cors';
import dotenv from 'dotenv';
import moment from 'moment';
import Logger from './lib/logger';
import { checkEnv } from './config/setConfig';
import {
	gasLimit,
	referralAddress,
	provider,
	chainId,
	moralisChainId,
	signer,
	walletAddr,
	availableTokens,
	routerAddress,
	tokenAddresses,
} from './config/constants';
import {
	Contract,
	parseEther,
	MaxUint256,
	parseUnits,
	toBigInt,
	formatEther,
} from 'ethers';
import poolABI from './abi/IPool.json';
import {
	FillableQuote,
	GroupedDeleteRequest,
	OrderbookQuote,
	PublishQuoteProxyRequest,
	QuoteOB,
	ReturnedOrderbookQuote,
	TokenType,
} from './types/quote';
import {
	Option,
	QuoteIds,
	TokenApproval,
	FillQuoteRequest,
	GetFillableQuotes,
	PublishQuoteRequest,
} from './types/validate';
import { OptionPositions, TokenBalance } from './types/balances';
import { checkTestApiKey } from './helpers/auth';
import {
	validateDeleteQuotes,
	validateFillQuotes,
	validateGetAllQuotes,
	validateGetFillableQuotes,
	validatePostQuotes,
	validatePositionManagement,
	validateApprovals,
} from './helpers/validators';
import { getPoolAddress } from './helpers/get';
import {
	createExpiration,
	createReturnedQuotes,
	createPoolKey,
	deserializeOrderbookQuote,
} from './helpers/create';
import {
	optionExpired,
	preProcessExpOption,
	preProcessAnnhilate,
	validateBalances,
} from './helpers/check';
import { proxyHTTPRequest } from './helpers/proxy';
import arb from './config/arbitrum.json';
import arbGoerli from './config/arbitrumGoerli.json';
import {
	getQuote,
	signQuote,
	createQuote,
	serializeQuote,
} from './helpers/sign';
import { ERC20Base__factory, IPool__factory } from './typechain';
import Moralis from 'moralis';
import {
	difference,
	find,
	flatten,
	groupBy,
	partition,
	pick,
	zipWith,
} from 'lodash';
import { requestDetailed } from './helpers/util';

dotenv.config();
checkEnv();

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
		return res.send(validatePostQuotes.errors);
	}

	// 2. Loop through each order and convert to signed quote object
	let serializedQuotes: PublishQuoteProxyRequest[] = [];

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

		// 2.2 Validate/create timestamp expiration
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
			quote.side === 'bid',
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

	let postQuotesRequest;
	try {
		// 3 Submit quote object array to orderbook API
		postQuotesRequest = await proxyHTTPRequest(
			'quotes',
			'POST',
			null,
			serializedQuotes
		);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}

	// NOTE: if at least 1 quote is valid/unique status will be 201
	// quote exists (200), bad request (400), unauthorized (401).
	if (postQuotesRequest.status !== 201) {
		return res.status(postQuotesRequest.status).json({
			message: postQuotesRequest.data,
		});
	}

	// 3 Parse/format orderbook quotes to return
	const orderbookQuotes = postQuotesRequest.data as OrderbookQuote[];
	const returnedQuotes = createReturnedQuotes(orderbookQuotes);

	return res.status(postQuotesRequest.status).json(returnedQuotes);
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

	const fillQuoteRequests = req.body as FillQuoteRequest[];

	// 1. Get quote objects from redis orderbook by quoteId
	const quoteIds = fillQuoteRequests.map(
		(fillQuoteRequest) => fillQuoteRequest.quoteId
	);

	if (quoteIds.length > 25) {
		Logger.error('Quotes quantity is up to 25 per request!');
		return res.status(400).json({
			message: 'Quotes quantity is up to 25 per request!',
		});
	}

	let activeQuotesRequest;
	try {
		activeQuotesRequest = await proxyHTTPRequest(
			'orders',
			'GET',
			{
				quoteIds: quoteIds,
			},
			null
		);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}

	if (activeQuotesRequest.status !== 200) {
		return res.status(activeQuotesRequest.status).json({
			message: activeQuotesRequest.data,
		});
	}

	const activeQuotes = activeQuotesRequest.data as OrderbookQuote[];

	// 1.1 Check to see which quotes from the request are still valid in the orderbook
	const fillableQuotes: FillableQuote[] = activeQuotes.map((activeQuote) => {
		const matchedFromRequest = find(fillQuoteRequests, [
			'quoteId',
			activeQuote.quoteId,
		])!;
		return {
			...activeQuote,
			...matchedFromRequest,
		};
	});

	// 1.2 Format the fillable quotes to Deserialized quote objects (include the tradeSize in object)
	const fillableQuotesDeserialized = fillableQuotes.map(
		deserializeOrderbookQuote
	);

	// 2. Group calls by base and puts by quote currency
	const [callsFillQuoteRequests, putsFillQuoteRequests] = partition(
		fillableQuotesDeserialized,
		(fillQuoteRequest) => fillQuoteRequest.poolKey.isCallPool
	);
	const callsFillQuoteRequestsGroupedByCollateral = groupBy(
		callsFillQuoteRequests,
		'poolKey.base'
	);
	const putsFillQuoteRequestsGroupedByCollateral = groupBy(
		putsFillQuoteRequests,
		'poolKey.quote'
	);

	// 1.2 Check that we have enough collateral balance to fill orders
	// FIXME: we can not use moralis here. We need to check the collateral types and query balance directly via web3
	let tokenBalances;
	try {
		tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
			chain: moralisChainId,
			address: walletAddr,
		});
		tokenBalances = tokenBalances.toJSON();
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: e });
	}

	for (const baseToken in callsFillQuoteRequestsGroupedByCollateral) {
		try {
			await validateBalances(
				tokenBalances,
				baseToken,
				callsFillQuoteRequestsGroupedByCollateral[baseToken]
			);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({ message: e });
		}
	}

	for (const quoteToken in putsFillQuoteRequestsGroupedByCollateral) {
		try {
			await validateBalances(
				tokenBalances,
				quoteToken,
				putsFillQuoteRequestsGroupedByCollateral[quoteToken]
			);
		} catch (e) {
			Logger.error(e);
			return res.status(400).json({ message: e });
		}
	}

	// 2.0 Process fill quotes
	const promiseAll = await Promise.allSettled(
		fillableQuotesDeserialized.map(async (fillableQuoteDeserialized) => {
			const pool = IPool__factory.connect(
				fillableQuoteDeserialized.poolAddress,
				signer
			);
			Logger.debug(
				`Filling quote ${JSON.stringify(fillableQuoteDeserialized)}...`
			);
			const quoteOB: QuoteOB = pick(fillableQuoteDeserialized, [
				'provider',
				'taker',
				'price',
				'size',
				'isBuy',
				'deadline',
				'salt',
			]);

			const signedQuoteObject = await signQuote(
				provider,
				fillableQuoteDeserialized.poolAddress,
				quoteOB
			);

			const fillTx = await pool.fillQuoteOB(
				quoteOB,
				fillableQuoteDeserialized.tradeSize,
				signedQuoteObject,
				referralAddress,
				{
					gasLimit: gasLimit,
				}
			);
			await provider.waitForTransaction(fillTx.hash, 1);
			Logger.debug(`Quote ${JSON.stringify(fillableQuoteDeserialized)} filled`);
			return fillableQuoteDeserialized;
		})
	);

	const fulfilledQuoteIds: string[] = [];
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			fulfilledQuoteIds.push(result.value.quoteId);
		}
	});

	const failedQuoteIds = difference(quoteIds, fulfilledQuoteIds);

	return res.status(200).json({
		success: fulfilledQuoteIds,
		failed: failedQuoteIds,
	});
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

	const deleteQuoteIds = req.body as QuoteIds;

	let activeQuotesRequest;
	try {
		activeQuotesRequest = await proxyHTTPRequest(
			'orders',
			'GET',
			{
				quoteIds: deleteQuoteIds.quoteIds,
			},
			null
		);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}

	if (activeQuotesRequest.status !== 200) {
		return res.status(activeQuotesRequest.status).json({
			message: activeQuotesRequest.data,
		});
	}

	const activeQuotes = activeQuotesRequest.data as OrderbookQuote[];

	const deleteByPoolAddr = groupBy(
		activeQuotes,
		'poolAddress'
	) as GroupedDeleteRequest;

	const promiseAll = await Promise.allSettled(
		Object.keys(deleteByPoolAddr).map(async (poolAddress) => {
			const poolContract = new Contract(poolAddress, poolABI, signer);

			const quoteIds = deleteByPoolAddr[poolAddress].map(
				(quotes) => quotes.quoteId
			);

			Logger.debug(`Cancelling quotes ${quoteIds}...`);
			const cancelTx = await poolContract.cancelQuotesOB(quoteIds);
			await provider.waitForTransaction(cancelTx.hash, 1);
			Logger.debug(`Quotes ${quoteIds} cancelled`);
			return quoteIds;
		})
	);

	const fulfilledQuoteIds: string[][] = [];
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			fulfilledQuoteIds.push(result.value);
		}
	});

	const failedQuoteIds = difference(
		activeQuotes.map((quote) => quote.quoteId),
		flatten(fulfilledQuoteIds)
	);

	const omittedQuoteIds = difference(
		deleteQuoteIds.quoteIds,
		flatten(fulfilledQuoteIds)
	);

	return res.status(200).json({
		success: flatten(fulfilledQuoteIds),
		failed: failedQuoteIds,
		omitted: omittedQuoteIds,
	});
});

// returns quotes up to a specific size
app.get('/orderbook/quotes', async (req, res) => {
	const valid = validateGetFillableQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetFillableQuotes.errors)}`
		);
		return res.send(validateGetFillableQuotes.errors);
	}

	const getQuotesQuery = req.query as unknown as GetFillableQuotes;

	// Validate/create timestamp expiration
	let expiration: number;
	try {
		expiration = createExpiration(getQuotesQuery.expiration as string);
	} catch (e) {
		Logger.error(e);
		return res.status(400).json({
			message: e,
			quotesRequest: getQuotesQuery,
		});
	}

	// Create Pool Key
	const poolKey = createPoolKey(
		pick(getQuotesQuery, ['base', 'quote', 'expiration', 'strike', 'type']),
		expiration
	);
	const poolAddress = await getPoolAddress(poolKey);

	let proxyResponse;
	try {
		proxyResponse = await proxyHTTPRequest(
			'quotes',
			'GET',
			{
				poolAddress: poolAddress,
				size: toBigInt(getQuotesQuery.size).toString(),
				side: getQuotesQuery.side,
				chainId: chainId,
				...(getQuotesQuery.provider && { provider: getQuotesQuery.provider }),
				...(getQuotesQuery.taker && { taker: getQuotesQuery.taker }),
			},
			null
		);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}

	if (proxyResponse.status !== 200) {
		return res.status(proxyResponse.status).json({
			message: proxyResponse.data,
		});
	}

	const orderbookQuotes = proxyResponse.data as OrderbookQuote[];
	const returnedQuotes: ReturnedOrderbookQuote[] =
		createReturnedQuotes(orderbookQuotes);

	return res.status(200).json(returnedQuotes);
});

// gets quotes using an array of quoteIds
app.get('/orderbook/orders', async (req, res) => {
	const valid = validateGetAllQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetAllQuotes.errors)}`
		);
		return res.send(validateGetAllQuotes.errors);
	}

	const quotesQuery = req.query as unknown as QuoteIds;

	if (quotesQuery.quoteIds.length > 25) {
		Logger.error('Quotes quantity is up to 25 per request!');
		return res.status(400).json({
			message: 'Quotes quantity is up to 25 per request!',
		});
	}

	let proxyResponse;
	try {
		proxyResponse = await proxyHTTPRequest('orders', 'GET', quotesQuery, null);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}

	if (proxyResponse.status !== 200) {
		return res.status(proxyResponse.status).json({
			message: proxyResponse.data,
		});
	}

	const orderbookQuotes = proxyResponse.data as OrderbookQuote[];
	const returnedQuotes: ReturnedOrderbookQuote[] =
		createReturnedQuotes(orderbookQuotes);

	return res.status(200).json(returnedQuotes);
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

	const options = req.body as Option[];

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const pool = await preProcessExpOption(option, TokenType.SHORT);
			const settleTx = await pool.settle();
			await provider.waitForTransaction(settleTx.hash, 1);
			return option;
		})
	);
	const requestSummary = requestDetailed(promiseAll, options);

	return res.status(200).json(requestSummary);
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

	const options = req.body as Option[];

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const pool = await preProcessExpOption(option, TokenType.LONG);
			const exerciseTx = await pool.exercise();
			await provider.waitForTransaction(exerciseTx.hash, 1);
			return option;
		})
	);

	const requestSummary = requestDetailed(promiseAll, options);

	return res.status(200).json(requestSummary);
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

	const options = req.body as Option[];

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const [pool, size] = await preProcessAnnhilate(option);
			const annihilateTx = await pool.annihilate(size, {
				gasLimit: gasLimit,
			});
			await provider.waitForTransaction(annihilateTx.hash, 1);
			return option;
		})
	);

	const requestSummary = requestDetailed(promiseAll, options);

	return res.status(200).json(requestSummary);
});

app.get('/account/option_balances', async (req, res) => {
	// TODO: Check for moralis update to `disable_total` on Sept 11th
	if (chainId === '421613') {
		return res
			.status(400)
			.json({ message: 'No balance query available in development mode' });
	}

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
					amount: parseFloat(formatEther(NFTBalance.amount!)),
				});
			} else {
				optionBalances.open.push({
					name: NFTBalance.name,
					token_address: NFTBalance.token_address,
					amount: parseFloat(formatEther(NFTBalance.amount!)),
				});
			}
		}
	});

	res.status(200).json(optionBalances);
});

app.get('/account/orders', async (req, res) => {
	let proxyResponse;
	try {
		proxyResponse = await proxyHTTPRequest('orders', 'GET', {
			provider: walletAddr,
			chainId: chainId,
		});
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({
			message: e,
		});
	}
	const orderbookQuotes = proxyResponse.data as OrderbookQuote[];
	const returnedQuotes: ReturnedOrderbookQuote[] =
		createReturnedQuotes(orderbookQuotes);

	return res.status(200).json(returnedQuotes);
});

app.get('/account/collateral_balances', async (req, res) => {
	const promiseAll = await Promise.allSettled(
		availableTokens.map(async (token) => {
			const erc20 = ERC20Base__factory.connect(tokenAddresses[token], provider);
			const tokenBalance: TokenBalance = {
				token_address: tokenAddresses[token],
				symbol: token,
				balance: parseFloat(formatEther(await erc20.balanceOf(walletAddr))),
			};
			return tokenBalance;
		})
	);

	const balances: TokenBalance[] = [];
	const reasons: any[] = [];
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			balances.push(result.value);
		}
		if (result.status === 'rejected') {
			reasons.push(result.reason);
		}
	});

	const failedBalanceQueries = difference(availableTokens, balances.map(balance => balance.symbol));

	return res.sendStatus(200).json({
		success: balances,
		failed: zipWith(
			failedBalanceQueries,
			reasons,
			(failedBalanceQuery, reason) => ({
				failedBalanceQuery,
				reason,
			})
		),
	});
});

app.get('/account/native_balance', async (req, res) => {
	let nativeBalance: number;
	try {
		nativeBalance = parseFloat(
			formatEther(await provider.getBalance(walletAddr))
		);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: e });
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
	const promiseAll = await Promise.allSettled(
		approvals.map(async(approval) => {
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
					Logger.info(
						`${approval.token} approval set to ${parseFloat(
							formatEther(approval.amt)
						)}`
					);
				}
				return approval
		})
	)

	const approved: TokenApproval[] = [];
	const reasons: any[] = [];
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			approved.push(result.value);
		}
		if (result.status === 'rejected') {
			reasons.push(result.reason);
		}
	});

	const failedApprovals = difference(approvals, approved);

	return res.sendStatus(200).json({
		success: approved,
		failed: zipWith(
			failedApprovals,
			reasons,
			(failedApproval, reason) => ({
				failedApproval,
				reason,
			})
		),
	});
});

const proxy = httpProxy.createProxyServer({ ws: true });
const server = app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});

server.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head, { target: process.env.WS_ENDPOINT });
});
