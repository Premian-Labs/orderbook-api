import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { WebSocket } from 'ws'
import moment from 'moment'
import {
	IPool__factory,
	ISolidStateERC20__factory,
	IVault__factory,
} from '@premia/v3-abi/typechain'
import {
	difference,
	find,
	flatten,
	groupBy,
	omit,
	partition,
	pick,
} from 'lodash'
import {
	parseEther,
	MaxUint256,
	parseUnits,
	formatEther,
	formatUnits,
	ContractTransactionResponse,
	TransactionReceipt,
	EthersError,
	NonceManager,
	BigNumberish,
} from 'ethers'

import Logger from './lib/logger'
import { checkEnv } from './config/checkConfig'
import {
	referralAddress,
	chainId,
	ws_url,
	signer,
	provider,
	poolFactory,
	walletAddr,
	routerAddr,
	tokenAddr,
	prodIVOracle,
	prodChainlink,
	vaults,
	prodTokenAddr,
	vaultUserErrors,
	INTERNAL_ERROR_MESSAGE,
} from './config/constants'
import {
	FillableQuote,
	GroupedDeleteRequest,
	InvalidQuote,
	OrderbookQuote,
	OrderbookQuoteTradeDeserialized,
	Pool,
	PoolKeySerialized,
	PoolWithAddress,
	PostQuotesResponse,
	PublishQuoteProxyRequest,
	QuoteOB,
	ReturnedInvalidQuote,
	ReturnedOrderbookQuote,
	TokenType,
} from './types/quote'
import {
	Option,
	QuoteIds,
	TokenApproval,
	FillQuoteRequest,
	GetFillableQuotes,
	PublishQuoteRequest,
	TokenApprovalError,
	GetPoolsParams,
	GetOrdersRequest,
	StrikesRequestSpot,
	IVRequest,
	IVResponse,
	SpotRequest,
	SpotResponse,
	StrikesRequestSymbol,
	VaultTradeRequest,
	VaultQuoteResponse,
	VaultTradeResponse,
	GetBalance,
	QuoteRequest,
} from './types/validate'
import { OptionPositions } from './types/balances'
import { checkTestApiKey } from './helpers/auth'
import {
	validateDeleteQuotes,
	validateFillQuotes,
	validateGetAllQuotes,
	validateGetFillableQuotes,
	validatePostQuotes,
	validatePositionManagement,
	validateApprovals,
	validatePoolEntity,
	validateGetPools,
	validateGetStrikes,
	validateGetIV,
	validateGetSpot,
	validateVaultTrade,
	validateGetBalance,
	validateQuoteRequest,
} from './helpers/validators'
import {
	getBalances,
	getPoolAddress,
	getSpotPrice,
	getTokenByAddress,
	getTTM,
} from './helpers/get'
import {
	createExpiration,
	createReturnedQuotes,
	createPoolKey,
	deserializeOrderbookQuote,
	parseInvalidQuotes,
	mapRFQMessage,
} from './helpers/create'
import {
	preProcessExpOption,
	preProcessAnnhilate,
	validateBalances,
} from './helpers/check'
import { proxyHTTPRequest } from './helpers/proxy'
import {
	getQuote,
	signQuote,
	createQuote,
	serializeQuote,
} from './helpers/sign'
import { getBlockByTimestamp, requestDetailed } from './helpers/util'
import {
	DeleteQuoteMessage,
	ErrorMessage,
	FillQuoteMessage,
	InfoMessage,
	PostQuoteMessage,
	RFQMessage,
} from './types/ws'
import { nextYearOfMaturities } from './helpers/maturities'
import { getSurroundingStrikes } from './helpers/strikes'
import {
	TypedContractEvent,
	TypedEventLog,
} from '@premia/v3-abi/typechain/common'
import { PoolDeployedEvent } from '@premia/v3-abi/typechain/IPoolFactory'

dotenv.config()
checkEnv()

const app = express()
app.use(cors())
// body parser for POST requests
app.use(express.json())
// unkey Auth check
app.use(checkTestApiKey)

// NOTE: post limit order(s)
app.post('/orderbook/quotes', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePostQuotes(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: `Validation error`,
			errors: validatePostQuotes.errors,
		})
		return res.send(validatePostQuotes.errors)
	}

	// 2. Loop through each order and convert to signed quote object
	let serializedQuotes: PublishQuoteProxyRequest[] = []

	for (const quote of req.body as PublishQuoteRequest[]) {
		// 2.1 Check that deadline is valid and generate deadline timestamp
		const ts = moment.utc().unix()
		let deadline: number
		if (quote.deadline < 30) {
			return res.status(400).json({
				message: 'Quote deadline is invalid (cannot be less than 30 sec)',
				quote: quote,
			})
		} else {
			deadline = ts + quote.deadline
		}

		// 2.2 Validate/create timestamp expiration
		let expiration: number
		try {
			expiration = createExpiration(quote.expiration)
		} catch (e) {
			return res.status(400).json({
				message: (e as Error).message,
				quote: quote,
			})
		}

		// 2.3 Create Pool Key
		const poolKey = createPoolKey(quote, expiration)

		// 2.4 Get PoolAddress
		let poolAddr: string
		try {
			poolAddr = await getPoolAddress(poolKey)
			Logger.debug(`PoolAddress: ${poolAddr}`)
		} catch (e) {
			return res.status(400).json({
				message: (e as Error).message,
				poolKey: {
					...poolKey,
					strike: formatEther(poolKey.strike.toString()),
					maturity: Number(poolKey.maturity),
				},
			})
		}

		// 2.5 Generate a initial quote object
		const quoteOB = getQuote(
			process.env.WALLET_ADDRESS!,
			parseEther(quote.size.toString()),
			quote.side === 'bid',
			parseEther(quote.price.toString()),
			deadline,
			quote.taker
		)

		// 2.6 Sign quote object
		const signedQuote = await signQuote(signer, poolAddr, quoteOB)
		const publishQuote = createQuote(poolKey, quoteOB, signedQuote)

		// 2.7 Serialize quote
		const serializedQuote = serializeQuote(publishQuote)

		Logger.debug({
			message: 'serializedQuote',
			serializedQuote: serializedQuote,
		})

		// 2.8 Add chain id to quote object
		const publishQuoteRequest = {
			...serializedQuote,
			chainId: chainId,
		}

		// 2.9 Add quote the object array
		serializedQuotes.push(publishQuoteRequest)
	}

	let postQuotesRequest
	try {
		// 3 Submit quote object array to orderbook API
		postQuotesRequest = await proxyHTTPRequest(
			'quotes',
			'POST',
			null,
			serializedQuotes
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	// At least one quote created
	if (postQuotesRequest.status == 201) {
		const postQuotesResponse: PostQuotesResponse = postQuotesRequest.data
		return res.status(postQuotesRequest.status).json({
			created: postQuotesResponse.created.map(createReturnedQuotes),
			failed: postQuotesResponse.failed.map((failedQuote) => {
				return {
					reason: failedQuote.reason,
					quote: parseInvalidQuotes(failedQuote.quote),
				}
			}),
			exists: postQuotesResponse.exists.map(createReturnedQuotes),
		})
	}

	// All quotes exist
	if (postQuotesRequest.status == 200) {
		const postQuotesResponse: PostQuotesResponse = postQuotesRequest.data
		return res.status(postQuotesRequest.status).json({
			failed: postQuotesResponse.failed.map((failedQuote) => {
				return {
					reason: failedQuote.reason,
					quote: parseInvalidQuotes(failedQuote.quote),
				}
			}),
			exists: postQuotesResponse.exists.map(createReturnedQuotes),
		})
	}

	// Failed request
	return res.status(postQuotesRequest.status).json(postQuotesRequest.data)
})

// NOTE: fill quote(s)
// IMPORTANT: if any order in the patch request is bad, it will reject the entire request.
app.patch('/orderbook/quotes', async (req, res) => {
	const valid = validateFillQuotes(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateFillQuotes.errors,
		})
		return res.send(validateFillQuotes.errors)
	}

	const fillQuoteRequests = req.body as FillQuoteRequest[]

	// 1. Get quote objects from redis orderbook by quoteId
	const quoteIds = fillQuoteRequests.map(
		(fillQuoteRequest) => fillQuoteRequest.quoteId
	)

	let activeQuotesRequest
	try {
		activeQuotesRequest = await proxyHTTPRequest(
			'orders',
			'GET',
			{
				quoteIds: quoteIds,
			},
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	if (activeQuotesRequest.status !== 200) {
		return res.status(activeQuotesRequest.status).json({
			message: activeQuotesRequest.data,
		})
	}

	const activeQuotes = activeQuotesRequest.data[
		'validQuotes'
	] as OrderbookQuote[]

	Logger.debug({
		message: 'activeQuotes',
		activeQuotes: activeQuotes,
	})

	// 1.1 Check to see which quotes from the request are still valid in the orderbook
	// NOTE: we only received the valid quotes from redis.
	const fillableQuotes: FillableQuote[] = []

	for (const fillQuoteRequest of fillQuoteRequests) {
		const matchedActiveQuote = find(activeQuotes, [
			'quoteId',
			fillQuoteRequest.quoteId,
		])

		if (matchedActiveQuote) {
			fillableQuotes.push({
				...matchedActiveQuote,
				...fillQuoteRequest,
			})
		}
	}

	// if we have nothing to fill, then end here
	if (fillableQuotes.length == 0) {
		return res.status(200).json({
			success: [],
			failed: quoteIds,
		})
	}

	//NOTE: at this point we have size, fillableSize, and tradeSize in the quote object
	Logger.debug({
		message: 'fillableQuotes',
		fillableQuotes: fillableQuotes,
	})

	// 1.2 Format the fillable quotes to Deserialized quote objects (include the tradeSize in object)
	// NOTE: we do NOT deserialize tradeSize here (it's not a quoteOB param)
	const fillableQuotesDeserialized = fillableQuotes.map(
		deserializeOrderbookQuote
	)

	// group calls by base and puts by quote currency (so we can check collateral requirements)
	const [callsFillQuoteRequests, putsFillQuoteRequests] = partition(
		fillableQuotesDeserialized,
		(fillQuoteRequest) => fillQuoteRequest.poolKey.isCallPool
	)
	const callsFillQuoteRequestsGroupedByCollateral = groupBy(
		callsFillQuoteRequests,
		'poolKey.base'
	)
	const putsFillQuoteRequestsGroupedByCollateral = groupBy(
		putsFillQuoteRequests,
		'poolKey.quote'
	)

	// check that we have enough collateral balance to fill orders
	const [tokenBalances, rejectedTokenBalances] = await getBalances(walletAddr)

	if (rejectedTokenBalances.length > 0) {
		return res.status(400).json({
			message: 'failed to get tokens balances',
			rejectedTokenBalances: rejectedTokenBalances,
		})
	}

	// validate collateral balance sorted base token address (CALLS)
	for (const baseToken in callsFillQuoteRequestsGroupedByCollateral) {
		try {
			await validateBalances(
				tokenBalances,
				baseToken,
				callsFillQuoteRequestsGroupedByCollateral[baseToken]
			)
		} catch (e) {
			Logger.error(e)
			return res.status(400).json({ message: e })
		}
	}

	// validate collateral balance sorted by quote token address (PUTS)
	for (const quoteToken in putsFillQuoteRequestsGroupedByCollateral) {
		try {
			await validateBalances(
				tokenBalances,
				quoteToken,
				putsFillQuoteRequestsGroupedByCollateral[quoteToken]
			)
		} catch (e) {
			Logger.error(e)
			return res.status(400).json({ message: e })
		}
	}

	// process fill quotes
	const fulfilledQuotes: OrderbookQuoteTradeDeserialized[] = []
	const failedQuotes: OrderbookQuoteTradeDeserialized[] = []
	const managedSigner = new NonceManager(signer)

	const fillTxPromises = await Promise.allSettled(
		fillableQuotesDeserialized.map(async (fillableQuoteDeserialized) => {
			const pool = IPool__factory.connect(
				fillableQuoteDeserialized.poolAddress,
				managedSigner
			)
			Logger.debug({
				message: 'Filling quote',
				fillableQuote: serializeQuote(fillableQuoteDeserialized),
			})

			const quoteOB: QuoteOB = pick(fillableQuoteDeserialized, [
				'provider',
				'taker',
				'price',
				'size',
				'isBuy',
				'deadline',
				'salt',
			])

			// ensure that tradeSize is not larger than fillableSize (otherwise tx will fail)
			if (
				fillableQuoteDeserialized.tradeSize >
				parseFloat(formatEther(fillableQuoteDeserialized.fillableSize))
			) {
				Logger.error({
					message: `tradeSize > fillableSize`,
					quoteId: fillableQuoteDeserialized.quoteId,
				})
				return Promise.reject('tradeSize > fillableSize')
			}

			let fillQuoteOBGasEst: BigNumberish
			try {
				fillQuoteOBGasEst =
					(await pool.fillQuoteOB.estimateGas(
						quoteOB,
						parseEther(fillableQuoteDeserialized.tradeSize.toString()),
						fillableQuoteDeserialized.signature,
						referralAddress
					)) + 100_000n
			} catch (e) {
				Logger.warn({
					message: 'failed to estimate gas for fillingQuoteOB',
					reason: e,
				})
				fillQuoteOBGasEst = 5_000_000n
			}

			return pool.fillQuoteOB(
				quoteOB,
				parseEther(fillableQuoteDeserialized.tradeSize.toString()),
				fillableQuoteDeserialized.signature,
				referralAddress,
				{
					gasLimit: fillQuoteOBGasEst,
				}
			)
		})
	)

	const result = await Promise.allSettled(
		fillTxPromises.map((tx) => {
			if (tx.status === 'fulfilled') return tx.value?.wait(1)
			Logger.error({
				message: 'failed filling quotes request',
				reason: tx.reason,
			})
			return Promise.reject(tx.reason)
		})
	)

	for (const [i, txResult] of result.entries()) {
		const quote = fillableQuotesDeserialized[i]
		if (txResult.status === 'fulfilled') fulfilledQuotes.push(quote)
		else {
			Logger.error({
				message: 'failed filling quotes tx',
				reason: txResult.reason,
			})
			failedQuotes.push(quote)
		}
	}

	return res.status(200).json({
		success: fulfilledQuotes.map((quote) => quote.quoteId),
		failed: failedQuotes.map((quote) => quote.quoteId),
	})
})

// NOTE: cancel quote(s)
app.delete('/orderbook/quotes', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validateDeleteQuotes(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateDeleteQuotes.errors,
		})
		return res.send(validateDeleteQuotes.errors)
	}

	const deleteQuoteIds = req.body as QuoteIds

	let activeQuotesRequest
	try {
		activeQuotesRequest = await proxyHTTPRequest(
			'orders',
			'GET',
			{
				quoteIds: deleteQuoteIds.quoteIds,
			},
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	if (activeQuotesRequest.status !== 200) {
		return res.status(activeQuotesRequest.status).json({
			message: activeQuotesRequest.data,
		})
	}

	const activeQuotes = activeQuotesRequest.data[
		'validQuotes'
	] as OrderbookQuote[]

	Logger.debug({
		message: `active quotes`,
		activeQuotes: activeQuotes,
	})

	// if nothing exists in the orderbook, nothing to process
	if (activeQuotes.length == 0) {
		return res.status(200).json({
			success: [],
			failed: [],
			omitted: deleteQuoteIds.quoteIds,
		})
	}

	const deleteByPoolAddr = groupBy(
		activeQuotes,
		'poolAddress'
	) as GroupedDeleteRequest

	Logger.debug({
		message: `delete by pool address`,
		value: deleteByPoolAddr,
	})

	const fulfilledQuoteIds: string[][] = []
	const failedQuoteIds: string[][] = []
	const managedSigner = new NonceManager(signer)

	const cancelTxPromises = await Promise.allSettled(
		Object.keys(deleteByPoolAddr).map((poolAddress) => {
			const poolContract = IPool__factory.connect(poolAddress, managedSigner)

			const quoteIds = deleteByPoolAddr[poolAddress].map(
				(quotes) => quotes.quoteId
			)

			Logger.debug(`Cancelling quotes ${quoteIds}...`)

			try {
				return poolContract.cancelQuotesOB(quoteIds)
			} catch (e) {
				Logger.error({
					message: `Failed to cancel quotes: ${quoteIds}`,
					error: (e as EthersError).message,
				})
				return Promise.reject(quoteIds)
			}
		})
	)

	const result = await Promise.allSettled(
		cancelTxPromises.map((tx) => {
			if (tx.status === 'fulfilled') return tx.value?.wait(1)
			Logger.error({
				message: 'failed cancel quotes request',
				reason: tx.reason,
			})
			return Promise.reject(tx.reason)
		})
	)

	for (const [i, txResult] of result.entries()) {
		const poolAddress = Object.keys(deleteByPoolAddr)[i]
		const quoteIds = deleteByPoolAddr[poolAddress].map(
			(quotes) => quotes.quoteId
		)
		if (txResult.status === 'fulfilled') fulfilledQuoteIds.push(quoteIds)
		else {
			Logger.error({
				message: 'failed cancel quotes tx',
				reason: txResult.reason,
			})
			failedQuoteIds.push(quoteIds)
		}
	}

	// submitted quoteIds that don't show up in orderbook can be omitted
	const omittedQuoteIds = difference(
		deleteQuoteIds.quoteIds,
		activeQuotes.map((quote) => quote.quoteId)
	)

	return res.status(200).json({
		success: flatten(fulfilledQuoteIds),
		failed: flatten(failedQuoteIds),
		omitted: omittedQuoteIds,
	})
})

// NOTE: returns quotes up to a specific size
app.get('/orderbook/quotes', async (req, res) => {
	const valid = validateGetFillableQuotes(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetFillableQuotes.errors,
		})
		return res.send(validateGetFillableQuotes.errors)
	}

	const getQuotesQuery = req.query as unknown as GetFillableQuotes
	const option: Option = {
		...getQuotesQuery,
		strike: Number(getQuotesQuery.strike),
	}

	// Validate/create timestamp expiration
	let expiration: number
	try {
		expiration = createExpiration(getQuotesQuery.expiration as string)
	} catch (e) {
		Logger.error(e)
		return res.status(400).json({
			message: e,
			quotesRequest: getQuotesQuery,
		})
	}
	// Create Pool Key (to get poolAddress)
	const poolKey = createPoolKey(option, expiration)
	const poolAddress = await getPoolAddress(poolKey)

	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest(
			'quotes',
			'GET',
			{
				poolAddress: poolAddress,
				size: parseEther(getQuotesQuery.size).toString(),
				side: getQuotesQuery.side,
				chainId: chainId,
				...(getQuotesQuery.provider && { provider: getQuotesQuery.provider }),
				...(getQuotesQuery.taker && { taker: getQuotesQuery.taker }),
			},
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	if (proxyResponse.status !== 200) {
		return res.status(proxyResponse.status).json({
			message: proxyResponse.data,
		})
	}

	const orderbookQuotes = proxyResponse.data as OrderbookQuote[]
	const returnedQuotes = orderbookQuotes.map(createReturnedQuotes)

	return res.status(200).json(returnedQuotes)
})

// NOTE: gets quotes using an array of quoteIds
app.get('/orderbook/orders', async (req, res) => {
	const valid = validateGetAllQuotes(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetAllQuotes.errors,
		})
		return res.send(validateGetAllQuotes.errors)
	}

	// NOTE: query comes without a chainId
	let quotesQuery = req.query as unknown as GetOrdersRequest
	quotesQuery.chainId = process.env.ENV == 'production' ? '42161' : '421613'

	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest(
			'orders',
			'GET',
			omit(quotesQuery, 'type'),
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	if (proxyResponse.status !== 200) {
		return res.status(proxyResponse.status).json({
			message: proxyResponse.data,
		})
	}

	let orderbookQuotes: OrderbookQuote[] | InvalidQuote[]
	if (quotesQuery.type === 'invalid') {
		orderbookQuotes = proxyResponse.data['invalidQuotes'] as InvalidQuote[]
	} else {
		orderbookQuotes = proxyResponse.data['validQuotes'] as OrderbookQuote[]
	}

	Logger.debug({
		message: `orderbook quotes`,
		orderbookQuotes: orderbookQuotes,
	})

	if (orderbookQuotes.length == 0) {
		return res.status(200).json([])
	}

	let returnedQuotes: ReturnedOrderbookQuote[] | ReturnedInvalidQuote[]
	if (quotesQuery.type === 'invalid') {
		returnedQuotes = (orderbookQuotes as InvalidQuote[]).map(
			(invalidQuote) => ({
				reason: invalidQuote.reason,
				quote: createReturnedQuotes(invalidQuote.quote),
			})
		)
	} else {
		returnedQuotes = (orderbookQuotes as OrderbookQuote[]).map(
			createReturnedQuotes
		)
	}

	return res.status(200).json(returnedQuotes)
})

// NOTE: post expiration short position settlement
app.post('/pool/settle', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePositionManagement(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validatePositionManagement.errors,
		})
		return res.send(validatePositionManagement.errors)
	}

	const options = req.body as Option[]

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const pool = await preProcessExpOption(option, TokenType.SHORT)
			const settleTx = await pool.settle()
			await settleTx.wait(1)
			return option
		})
	)
	const requestSummary = requestDetailed(promiseAll, options)

	return res.status(200).json(requestSummary)
})

// NOTE: post expiration long position exercise
app.post('/pool/exercise', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePositionManagement(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validatePositionManagement.errors,
		})
		return res.send(validatePositionManagement.errors)
	}

	const options = req.body as Option[]

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const pool = await preProcessExpOption(option, TokenType.LONG)
			const exerciseTx = await pool.exercise()
			await exerciseTx.wait(1)
			return option
		})
	)

	const requestSummary = requestDetailed(promiseAll, options)

	return res.status(200).json(requestSummary)
})

// NOTE: collateral release for offsetting positions
app.post('/pool/annihilate', async (req, res) => {
	// 1. Validate incoming object array
	const valid = validatePositionManagement(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validatePositionManagement.errors,
		})
		return res.send(validatePositionManagement.errors)
	}

	const options = req.body as Option[]

	const promiseAll = await Promise.allSettled(
		options.map(async (option) => {
			const [pool, size] = await preProcessAnnhilate(option)

			let annhilateGasEst: BigNumberish
			try {
				annhilateGasEst = (await pool.annihilate.estimateGas(size)) + 100_000n
			} catch (e) {
				Logger.warn({
					message: 'failed to estimate gas for annihilate',
					reason: e,
				})
				annhilateGasEst = 5_000_000n
			}

			const annihilateTx = await pool.annihilate(size, {
				gasLimit: annhilateGasEst,
			})
			await annihilateTx.wait(1)
			return option
		})
	)

	const requestSummary = requestDetailed(promiseAll, options)

	return res.status(200).json(requestSummary)
})

// NOTE: option positions currently open
app.get('/account/option_balances', async (req, res) => {
	const valid = validateGetBalance(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetBalance.errors,
		})
		return res.send(validateGetBalance.errors)
	}

	const queryAddr = req.query as GetBalance

	let optionBalancesRequest
	try {
		optionBalancesRequest = await proxyHTTPRequest(
			'account/option_balances',
			'GET',
			{
				chainId: chainId,
				wallet: queryAddr.walletAddr ?? walletAddr,
			},
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	if (optionBalancesRequest.status !== 200) {
		return res.status(optionBalancesRequest.status).json({
			message: optionBalancesRequest.data,
		})
	}

	res.status(200).json(optionBalancesRequest.data as OptionPositions)
})

// NOTE: returns all open orders
app.get('/account/orders', async (req, res) => {
	const valid = validateGetBalance(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetBalance.errors,
		})
		return res.send(validateGetBalance.errors)
	}

	const queryAddr = req.query as GetBalance

	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest('orders', 'GET', {
			provider: queryAddr.walletAddr ?? walletAddr,
			chainId: chainId,
		})
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: INTERNAL_ERROR_MESSAGE,
		})
	}

	const orderbookQuotes = proxyResponse.data['validQuotes'] as OrderbookQuote[]
	const returnedQuotes = orderbookQuotes.map(createReturnedQuotes)

	return res.status(200).json(returnedQuotes)
})

// NOTE: returns all collateral balances on Token addressed in config file
app.get('/account/collateral_balances', async (req, res) => {
	const valid = validateGetBalance(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetBalance.errors,
		})
		return res.send(validateGetBalance.errors)
	}

	const queryAddr = req.query as GetBalance

	const [balances, rejectedTokenBalances] = await getBalances(
		queryAddr.walletAddr ?? walletAddr
	)

	return res.status(200).json({
		success: balances,
		failed: rejectedTokenBalances,
	})
})

// NOTE: ETH balance
app.get('/account/native_balance', async (req, res) => {
	const valid = validateGetBalance(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetBalance.errors,
		})
		return res.send(validateGetBalance.errors)
	}

	const queryAddr = req.query as GetBalance

	let nativeBalance: number
	try {
		nativeBalance = parseFloat(
			formatEther(await provider.getBalance(queryAddr.walletAddr ?? walletAddr))
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({ message: e })
	}

	res.status(200).json(nativeBalance)
})

// NOTE: approval of collateral can be custom or set to `max`
app.post('/account/collateral_approval', async (req, res) => {
	const valid = validateApprovals(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateApprovals.errors,
		})
		return res.send(validateApprovals.errors)
	}

	const approvals = req.body as TokenApproval[]

	const approved: TokenApproval[] = []
	const rejected: TokenApprovalError[] = []

	// iterate through each approval request synchronously
	for (const approval of approvals) {
		const erc20 = ISolidStateERC20__factory.connect(
			tokenAddr[approval.token],
			signer
		)

		let approveTX: ContractTransactionResponse
		let confirm: TransactionReceipt | null
		try {
			if (approval.amt === 'max') {
				approveTX = await erc20.approve(routerAddr, MaxUint256.toString())
				confirm = await approveTX.wait(1)

				if (confirm?.status == 1) {
					approved.push(approval)
					Logger.info(`${approval.token} approval set to MAX`)
				} else {
					rejected.push({
						message: 'approval error',
						token: approval,
						error: confirm,
					})
				}
			} else {
				const decimals = await erc20.decimals()
				const qty = parseUnits(approval.amt.toString(), Number(decimals))

				approveTX = await erc20.approve(routerAddr, qty)
				confirm = await approveTX.wait(1)

				if (confirm?.status == 1) {
					approved.push(approval)
					Logger.info(`${approval.token} approval set to ${approval.amt}`)
				} else {
					rejected.push({
						message: 'approval error',
						token: approval,
						error: confirm,
					})
				}
			}
		} catch (e) {
			rejected.push({
				message: 'approval error',
				token: approval,
				error: e,
			})
		}
	}

	return res.status(200).json({
		success: approved,
		failed: rejected,
	})
})

// NOTE: returns only pools up to 30 days old to optimise queryFilter time
app.get('/pools', async (req, res) => {
	const valid = validateGetPools(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validateGetPools.errors,
		})
		return res.send(validateGetPools.errors)
	}

	const reqParams = req.query as GetPoolsParams
	const timePeriods = [0, 30, 60, 90, 120]
	let allPoolDeployedEvents: TypedEventLog<TypedContractEvent<PoolDeployedEvent.InputTuple,
		PoolDeployedEvent.OutputTuple, PoolDeployedEvent.OutputObject>>[] = []

	const deploymentEventFilter = poolFactory.getEvent('PoolDeployed')

	for (let i = 0; i < timePeriods.length - 1; i++) {
		const startTimestamp = moment.utc().subtract(timePeriods[i + 1], 'days').unix()
		const endTimestamp = moment.utc().subtract(timePeriods[i], 'days').unix()

		const startBlock = await getBlockByTimestamp(startTimestamp)
		const endBlock = await getBlockByTimestamp(endTimestamp)

		console.log('time period from-to', endTimestamp, startTimestamp)
		console.log('endBlock, startBlock', endBlock, startBlock)

		const periodEvents = await poolFactory.queryFilter(
			deploymentEventFilter,
			startBlock,
			endBlock
		)

		allPoolDeployedEvents = allPoolDeployedEvents.concat(periodEvents)
	}

	let deployedPools: PoolWithAddress[] = allPoolDeployedEvents
		.filter((event) => Number(event.args.maturity) > moment.utc().unix() + 60)
		.filter((event) => getTokenByAddress(tokenAddr, event.args.base) !== '')
		.filter((event) => getTokenByAddress(tokenAddr, event.args.quote) !== '')
		.map((event) => {
			return {
				base: getTokenByAddress(tokenAddr, event.args.base),
				quote: getTokenByAddress(tokenAddr, event.args.quote),
				expiration: moment
					.unix(Number(event.args.maturity))
					.format('DDMMMYY')
					.toUpperCase(),
				strike: parseFloat(formatEther(event.args.strike)),
				type: event.args.isCallPool ? 'C' : 'P',
				poolAddress: event.args.poolAddress,
			}
		})

	if (reqParams.base)
		deployedPools = deployedPools.filter((pool) => pool.base === reqParams.base)

	if (reqParams.quote)
		deployedPools = deployedPools.filter(
			(pool) => pool.quote === reqParams.quote
		)

	if (reqParams.expiration)
		deployedPools = deployedPools.filter(
			(pool) => pool.expiration === reqParams.expiration
		)

	return res.status(200).json(deployedPools)
})
app.post('/pools', async (req, res) => {
	const valid = validatePoolEntity(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			errors: validatePoolEntity.errors,
		})
		return res.send(validatePoolEntity.errors)
	}

	const pools: Pool[] = req.body
	const failed: Pool[] = []
	const created: PoolWithAddress[] = []
	const existed: PoolWithAddress[] = []

	for (const pool of pools) {
		let expiration: number
		try {
			expiration = createExpiration(pool.expiration)
		} catch (e) {
			return res.status(400).json({
				message: (e as Error).message,
				quote: pool,
			})
		}

		const poolKey = createPoolKey(pool, expiration)

		let poolAddress: string
		let isDeployed: boolean
		try {
			;[poolAddress, isDeployed] = await poolFactory.getPoolAddress(poolKey)
		} catch (e) {
			Logger.error({
				message: 'fail to get status of pool',
				poolKey: poolKey,
				error: (e as EthersError).message,
			})
			failed.push(pool)
			continue
		}

		if (isDeployed) {
			existed.push({
				...pool,
				poolAddress,
			})
		} else {
			// Deploy pool process
			try {
				let deployPoolGasEst: BigNumberish
				try {
					deployPoolGasEst =
						(await poolFactory.deployPool.estimateGas(poolKey)) + 100_000n
				} catch (e) {
					Logger.warn({
						message: 'failed to estimate gas for annihilate',
						reason: e,
					})
					deployPoolGasEst = 5_000_000n
				}

				const deploymentTx = await poolFactory.deployPool(poolKey, {
					gasLimit: deployPoolGasEst,
				})

				await deploymentTx.wait(1)

				const [poolAddress, isDeployed] = await poolFactory.getPoolAddress(
					poolKey
				)
				if (isDeployed) {
					created.push({
						...pool,
						poolAddress,
					})
				} else {
					throw new Error(
						'pool TX was successful but the pool was not deployed'
					)
				}
			} catch (e) {
				Logger.error({
					message: 'fail to deploy pool',
					poolKey: poolKey,
					error: (e as EthersError).message,
				})
				failed.push(pool)
			}
		}
	}

	return res.status(200).json({
		created: created,
		existed: existed,
		failed: failed,
	})
})

app.get('/pools/strikes', async (req, res) => {
	const valid = validateGetStrikes(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateGetStrikes.errors,
		})
		return res.send(validateGetStrikes.errors)
	}

	const request = req.query as unknown as
		| StrikesRequestSpot
		| StrikesRequestSymbol

	if (request.hasOwnProperty('spotPrice')) {
		const getStrikes = request as StrikesRequestSpot
		const spotPrice = parseFloat(getStrikes.spotPrice)

		if (Number.isNaN(spotPrice)) {
			return res.status(400).json({
				message: 'spotPrice must be a number',
				spotPrice: getStrikes.spotPrice,
			})
		}

		if (spotPrice <= 0) {
			return res.status(400).json({
				message: 'spotPrice must be > 0',
				spotPrice: getStrikes.spotPrice,
			})
		}

		const suggestedStrikes = getSurroundingStrikes(spotPrice)
		return res.status(200).json(suggestedStrikes)
	} else {
		const getStrikes = request as StrikesRequestSymbol
		const spotPrice = await getSpotPrice(getStrikes.market)

		if (spotPrice == undefined) {
			return res.status(500).json({
				message: `Failed to get spot price from oracle, try again or provide spot price`,
			})
		}

		const suggestedStrikes = getSurroundingStrikes(parseFloat(spotPrice))
		return res.status(200).json(suggestedStrikes)
	}
})

app.get('/pools/maturities', (req, res) => {
	const maturities = nextYearOfMaturities()
	const maturitiesSerialised = maturities.map((x) =>
		x.format('DDMMMYY').toUpperCase()
	)
	return res.status(200).json(maturitiesSerialised)
})

// NOTE: uses arbitrum mainnet regardless of env
app.get('/oracles/iv', async (req, res) => {
	const valid = validateGetIV(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateGetIV.errors,
		})
		return res.send(validateGetIV.errors)
	}
	const request = req.query as unknown as IVRequest

	// validate expiration
	let expiration: number
	try {
		expiration = createExpiration(request.expiration)
	} catch (e) {
		return res.status(400).json({
			message: (e as Error).message,
			expiration: request.expiration,
		})
	}
	const ttm = getTTM(expiration)

	let spotPrice: string | undefined
	if (request.spotPrice) {
		spotPrice = request.spotPrice
	} else {
		// get spot price from spot oracle (required for iv oracle)
		spotPrice = await getSpotPrice(request.market)
		if (spotPrice == undefined) {
			return res.status(500).json({
				message: `Failed to get spot price from oracle, try again or provide spot price`,
			})
		}
	}

	// get suggested strikes (same as Get strikes endpoint)
	const suggestedStrikes = getSurroundingStrikes(parseFloat(spotPrice))

	// multi call to ivOracle
	const ivPromises = suggestedStrikes.map((strike) => {
		return prodIVOracle['getVolatility(address,uint256,uint256,uint256)'](
			prodTokenAddr[request.market],
			parseEther(spotPrice!),
			parseEther(strike.toString()),
			parseEther(ttm.toFixed(12))
		)
	})

	let ivRequestsBigInt
	try {
		ivRequestsBigInt = await Promise.all(ivPromises)
		const ivRequests = ivRequestsBigInt.map((iv) => {
			return parseFloat(parseFloat(formatEther(iv)).toFixed(2))
		})
		let ivStrikes: IVResponse[] = []
		for (let i = 0; i < suggestedStrikes.length; i++) {
			ivStrikes.push({
				strike: suggestedStrikes[i],
				iv: ivRequests[i],
			})
		}
		return res.status(200).json(ivStrikes)
	} catch (e) {
		Logger.error({
			message: 'IV Oracle multicall failed',
			error: e,
		})

		return res.status(500).json({
			message: `Failed to get IV's from oracle`,
		})
	}
})

app.get('/oracles/spot', async (req, res) => {
	const valid = validateGetSpot(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateGetSpot.errors,
		})
		return res.send(validateGetSpot.errors)
	}
	const spotRequest = req.query as unknown as SpotRequest

	// multi call to spot Oracle
	const spotPromises = spotRequest.markets.map((market) => {
		return prodChainlink.getPrice(prodTokenAddr[market], prodTokenAddr.USDC)
	})

	let spotRequestsBigInt
	try {
		spotRequestsBigInt = await Promise.all(spotPromises)
		const spotRequests = spotRequestsBigInt.map((price) => {
			return parseFloat(parseFloat(formatEther(price)).toFixed(6))
		})
		let spotMarkets: SpotResponse[] = []
		for (let i = 0; i < spotRequest.markets.length; i++) {
			spotMarkets.push({
				market: spotRequest.markets[i],
				price: spotRequests[i],
			})
		}
		return res.status(200).json(spotMarkets)
	} catch (e) {
		Logger.error({
			message: 'spot Oracle multicall failed',
			error: e,
		})

		return res.status(500).json({
			message: `Failed to get spot prices from oracle`,
		})
	}
})

app.get('/vaults/quote', async (req, res) => {
	const valid = validateQuoteRequest(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateQuoteRequest.errors,
		})
		return res.send(validateQuoteRequest.errors)
	}
	const quoteRequest = req.query as unknown as QuoteRequest

	let quoteSymbol: string
	// NOTE: production USDC is USDCe (bridged)
	if (chainId === '42161' && quoteRequest.quote === 'USDC')
		quoteSymbol = `USDCe`
	else quoteSymbol = quoteRequest.quote

	// create vault key
	const vaultName = `pSV-${quoteRequest.base}/${quoteSymbol}-${quoteRequest.type}`

	// check to make sure vault exists
	if (!(vaultName in vaults))
		return res.status(400).json({
			message: 'Vault does not exist',
			quote: quoteRequest,
		})

	// format expiration for poolKey object (reject if invalid expiration)
	let expiration: number
	try {
		expiration = createExpiration(quoteRequest.expiration)
	} catch (e) {
		return res.status(400).json({
			message: (e as Error).message,
			quote: quoteRequest,
		})
	}

	const poolKey = createPoolKey(quoteRequest, expiration)

	const vault = IVault__factory.connect(vaults[vaultName].address, provider)

	let takerFeeBigInt: bigint
	let quoteBigInt: bigint
	try {
		quoteBigInt = await vault.getQuote(
			poolKey,
			parseEther(quoteRequest.size),
			quoteRequest.direction === 'buy',
			walletAddr
		)
		const poolAddr = await getPoolAddress(poolKey)
		const pool = IPool__factory.connect(poolAddr, signer)

		// TODO: confirm proper fee structure for vault
		takerFeeBigInt = await pool.takerFee(
			poolAddr,
			parseEther(quoteRequest.size),
			0n,
			true,
			false
		)
	} catch (e) {
		const error = e as EthersError

		Logger.error({
			message: 'Vault quote failed',
			error: error,
		})

		const userError = vaultUserErrors.find((userError) =>
			error.message.startsWith(`execution reverted: ${userError}`)
		)
		if (userError) return res.status(400).json({ message: userError })

		return res.status(500).json({
			message: `Failed to get quote from vault`,
		})
	}

	const quoteResponse: VaultQuoteResponse = {
		market: {
			vault: vaultName,
			strike: parseFloat(quoteRequest.strike),
			expiration: quoteRequest.expiration,
			size: parseFloat(quoteRequest.size),
			direction: quoteRequest.direction,
		},
		quote: poolKey.isCallPool
			? parseFloat(formatEther(quoteBigInt))
			: parseFloat(formatUnits(quoteBigInt, 6)),
		takerFee: poolKey.isCallPool
			? parseFloat(formatEther(takerFeeBigInt))
			: parseFloat(formatUnits(takerFeeBigInt, 6)),
	}
	return res.status(200).json(quoteResponse)
})

app.post('/vaults/trade', async (req, res) => {
	const valid = validateVaultTrade(req.body)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateVaultTrade.errors,
		})
		return res.send(validateVaultTrade.errors)
	}

	const tradeRequest = req.body as unknown as VaultTradeRequest

	let quoteSymbol: string
	// NOTE: production USDC is USDCe (bridged)
	if (chainId === '42161' && tradeRequest.quote === 'USDC')
		quoteSymbol = `USDCe`
	else quoteSymbol = tradeRequest.quote

	// create vault key
	const vaultName = `pSV-${tradeRequest.base}/${quoteSymbol}-${tradeRequest.type}`

	// check to make sure vault exists
	if (!(vaultName in vaults))
		return res.status(400).json({
			message: 'Vault does not exist',
			trade: tradeRequest,
		})

	// format expiration for poolKey object (reject if invalid expiration)
	let expiration: number
	try {
		expiration = createExpiration(tradeRequest.expiration)
	} catch (e) {
		return res.status(400).json({
			message: (e as Error).message,
			trade: tradeRequest,
		})
	}

	const poolKey = createPoolKey(tradeRequest, expiration)

	const vault = IVault__factory.connect(vaults[vaultName].address, provider)
	try {
		const tradeTX = await vault.trade(
			poolKey,
			parseEther(tradeRequest.size.toString()),
			tradeRequest.direction === 'buy',
			parseEther(tradeRequest.premiumLimit.toString()),
			referralAddress
		)
		const confirm = await tradeTX.wait(1)

		if (confirm?.status === 0) {
			throw new Error(`Failed to confirm vault trade: ${confirm}`)
		}
	} catch (e) {
		Logger.error({
			message: 'Vault trade failed',
			error: e,
		})

		return res.status(500).json({
			message: `Failed to trade with vault`,
		})
	}

	// TODO: return fill price (and fee paid)
	const tradeResponse: VaultTradeResponse = {
		market: {
			vault: vaultName,
			strike: tradeRequest.strike,
			expiration: tradeRequest.expiration,
			size: tradeRequest.size,
			direction: tradeRequest.direction,
		},
	}

	return res.status(200).json(tradeResponse)
})

app.get('/rfq/message', async (req, res) => {
	// In order to submit an RFQ, a request object needs to be created, this endpoint will create that object.
	const valid = validateQuoteRequest(req.query)
	if (!valid) {
		res.status(400)
		Logger.error({
			message: 'Validation error',
			error: validateQuoteRequest.errors,
		})
		return res.send(validateQuoteRequest.errors)
	}

	const quoteRequest = req.query as unknown as QuoteRequest

	// format expiration for poolKey object (reject if invalid expiration)
	let expiration: number
	try {
		expiration = createExpiration(quoteRequest.expiration)
	} catch (e) {
		return res.status(400).json({
			message: (e as Error).message,
			quote: quoteRequest,
		})
	}

	const poolKey = createPoolKey(quoteRequest, expiration)
	const poolKeySerialized: PoolKeySerialized = {
		...poolKey,
		strike: poolKey.strike.toString(),
		maturity: expiration,
	}

	// NOTE: direction of 'buy', request is for 'ask' liquidity
	const rfqMessageResponse: RFQMessage = {
		type: 'RFQ',
		body: {
			poolKey: poolKeySerialized,
			side: quoteRequest.direction === 'buy' ? 'ask' : 'bid',
			chainId: chainId,
			size: parseEther(quoteRequest.size).toString(),
			taker: walletAddr.toLowerCase(),
		},
	}

	return res.status(200).json(rfqMessageResponse)
})

const server = app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`)
})

const wsServer = new WebSocket.Server({ server })
wsServer.on('connection', (wsLocalConnection) => {
	const wsProxyCloudClient = new WebSocket(ws_url)

	wsLocalConnection.on('message', (clientMsg) => {
		if (wsProxyCloudClient.readyState === 1) {
			wsProxyCloudClient.send(clientMsg.toString())
		} else {
			wsLocalConnection.send(JSON.stringify({
				message: 'Proxy WS connection is not ready',
			}))
		}
	})

	wsLocalConnection.on('error', (error) => {
		wsProxyCloudClient.close()
		Logger.error({
			message: 'WS connection error',
			error: error,
		})
	})

	wsProxyCloudClient.on('close', (code, reason) => {
		wsLocalConnection.close()
		Logger.warn('WS connection closed by the server')
	})

	wsLocalConnection.on('close', () => {
		wsProxyCloudClient.close()
		Logger.warn('WS connection closed')
	})

	wsProxyCloudClient.on('message', (cloudMsg) => {
		const message:
			| InfoMessage
			| ErrorMessage
			| RFQMessage
			| PostQuoteMessage
			| FillQuoteMessage
			| DeleteQuoteMessage = JSON.parse(cloudMsg.toString())

		switch (message.type) {
			case 'RFQ':
				wsLocalConnection.send(
					JSON.stringify({
						type: message.type,
						body: mapRFQMessage(message.body),
					})
				)
				break
			case 'FILL_QUOTE':
				wsLocalConnection.send(
					JSON.stringify({
						type: message.type,
						body: createReturnedQuotes(message.body),
						tradeSize: formatEther(message.size),
					})
				)
				break
			case 'POST_QUOTE':
			case 'DELETE_QUOTE':
				wsLocalConnection.send(
					JSON.stringify({
						type: message.type,
						body: createReturnedQuotes(message.body),
					})
				)
				break
			default:
				wsLocalConnection.send(cloudMsg.toString())
		}
	})
})
