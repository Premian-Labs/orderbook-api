import express from 'express'
import dotenv from 'dotenv'
import Logger from './lib/logger'
import WebSocket from 'ws'
import { checkEnv } from './config/checkConfig'
import {
	gasLimit,
	referralAddress,
	chainId,
	walletAddr,
	availableTokens,
	routerAddress,
	ws_url,
	rpcUrl,
	privateKey,
} from './config/constants'
import { parseEther, MaxUint256, parseUnits, formatEther, ethers } from 'ethers'
import {
	FillableQuote,
	GroupedDeleteRequest,
	OrderbookQuote,
	PostQuotesResponse,
	PublishQuoteProxyRequest,
	QuoteOB,
	TokenType,
} from './types/quote'
import {
	Option,
	QuoteIds,
	TokenApproval,
	FillQuoteRequest,
	GetFillableQuotes,
	PublishQuoteRequest,
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
} from './helpers/validators'
import { getBalances, getPoolAddress } from './helpers/get'
import {
	createExpiration,
	createReturnedQuotes,
	createPoolKey,
	deserializeOrderbookQuote,
	parseInvalidQuotes,
} from './helpers/create'
import {
	preProcessExpOption,
	preProcessAnnhilate,
	validateBalances,
} from './helpers/check'
import { proxyHTTPRequest } from './helpers/proxy'
import arb from './config/arbitrum.json'
import arbGoerli from './config/arbitrumGoerli.json'
import {
	getQuote,
	signQuote,
	createQuote,
	serializeQuote,
} from './helpers/sign'
import { IPool__factory, ISolidStateERC20__factory } from './typechain'
import {
	difference,
	find,
	flatten,
	groupBy,
	partition,
	pick,
	zipWith,
} from 'lodash'
import { requestDetailed } from './helpers/util'
import moment from 'moment'
import {
	DeleteQuoteMessage,
	ErrorMessage,
	FillQuoteMessage,
	InfoMessage,
	PostQuoteMessage,
	RFQMessage,
} from './types/ws'

dotenv.config()
checkEnv()

const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)
const app = express()
// body parser for POST requests
app.use(express.json())
// url query param parser for GET requests
app.use(express.urlencoded({ extended: true }))
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
		if (quote.deadline < 60) {
			return res.status(400).json({
				message: 'Quote deadline is invalid (cannot be less than 60 sec)',
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
		const poolAddr = await getPoolAddress(poolKey)
		Logger.debug(`PoolAddress: ${poolAddr}`)

		// 2.5 Generate a initial quote object
		const quoteOB = getQuote(
			process.env.WALLET_ADDRESS!,
			parseEther(quote.size.toString()),
			quote.side === 'bid',
			parseEther(quote.price.toString()),
			deadline,
			quote.taker
		)
		Logger.debug({
			message: 'quoteOB',
			quoteOB: quoteOB,
		})

		// 2.6 Sign quote object
		const signedQuote = await signQuote(signer, poolAddr, quoteOB)
		Logger.info(signedQuote)
		const publishQuote = createQuote(poolKey, quoteOB, signedQuote)

		// 2.7 Serialize quote
		const serializedQuote = serializeQuote(publishQuote)

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
			message: e,
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

	if (quoteIds.length > 25) {
		Logger.error('Quotes quantity is up to 25 per request!')
		return res.status(400).json({
			message: 'Quotes quantity is up to 25 per request!',
		})
	}

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
			message: e,
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

	//NOTE: at this point we have size, fillableSize, and tradeSize in the quote object
	Logger.debug({
		message: 'fillableQuotes',
		fillableQuotes: fillableQuotes,
	})

	// 1.2 Format the fillable quotes to Deserialized quote objects (include the tradeSize in object)
	const fillableQuotesDeserialized = fillableQuotes.map(
		deserializeOrderbookQuote
	)

	Logger.debug({
		message: 'fillableQuotesDeserialized',
		fillableQuotesDeserialized: fillableQuotesDeserialized
	})

	// 2. Group calls by base and puts by quote currency
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

	// 1.2 Check that we have enough collateral balance to fill orders
	const [tokenBalances] = await getBalances()

	// sorted base token address
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

	// sorted by quote token address
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

	// 2.0 Process fill quotes
	const promiseAll = await Promise.allSettled(
		fillableQuotesDeserialized.map(async (fillableQuoteDeserialized) => {
			const pool = IPool__factory.connect(
				fillableQuoteDeserialized.poolAddress,
				signer
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

			const signedQuoteObject = await signQuote(
				signer,
				fillableQuoteDeserialized.poolAddress,
				quoteOB
			)

			//NOTE: we use the tradeSize the client inputs (it's a standard number)
			const fillTx = await pool.fillQuoteOB(
				quoteOB,
				parseEther(fillableQuoteDeserialized.tradeSize.toString()),
				signedQuoteObject,
				referralAddress,
				{
					gasLimit: gasLimit,
				}
			)

			await fillTx.wait()
			Logger.debug(`Quote ${fillableQuoteDeserialized.quoteId} filled`)
			return fillableQuoteDeserialized
		})
	)

	const fulfilledQuoteIds: string[] = []
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			fulfilledQuoteIds.push(result.value.quoteId)
		} else {
			const ethersError = result.reason as ethers.CallExceptionError
			console.error(ethersError)
			// does not work somehow
			// const parsed = IPool__factory.createInterface().parseError(ethersError.data!)
			// console.log(parsed)
		}
	})

	const failedQuoteIds = difference(quoteIds, fulfilledQuoteIds)

	return res.status(200).json({
		success: fulfilledQuoteIds,
		failed: failedQuoteIds,
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
			message: e,
		})
	}

	if (activeQuotesRequest.status !== 200) {
		return res.status(activeQuotesRequest.status).json({
			message: activeQuotesRequest.data,
		})
	}

	const activeQuotes = activeQuotesRequest.data as OrderbookQuote[]

	const deleteByPoolAddr = groupBy(
		activeQuotes,
		'poolAddress'
	) as GroupedDeleteRequest

	const promiseAll = await Promise.allSettled(
		Object.keys(deleteByPoolAddr).map(async (poolAddress) => {
			const poolContract = IPool__factory.connect(poolAddress, signer)

			const quoteIds = deleteByPoolAddr[poolAddress].map(
				(quotes) => quotes.quoteId
			)

			Logger.debug(`Cancelling quotes ${quoteIds}...`)
			const cancelTx = await poolContract.cancelQuotesOB(quoteIds)
			await provider.waitForTransaction(cancelTx.hash, 1)
			Logger.debug(`Quotes ${quoteIds} cancelled`)
			return quoteIds
		})
	)

	const fulfilledQuoteIds: string[][] = []
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			fulfilledQuoteIds.push(result.value)
		}
	})

	const failedQuoteIds = difference(
		activeQuotes.map((quote) => quote.quoteId),
		flatten(fulfilledQuoteIds)
	)

	const omittedQuoteIds = difference(
		deleteQuoteIds.quoteIds,
		flatten(fulfilledQuoteIds)
	)

	return res.status(200).json({
		success: flatten(fulfilledQuoteIds),
		failed: failedQuoteIds,
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

	// Create Pool Key
	const poolKey = createPoolKey(
		pick(getQuotesQuery, ['base', 'quote', 'expiration', 'strike', 'type']),
		expiration
	)
	const poolAddress = await getPoolAddress(poolKey)

	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest(
			'quotes',
			'GET',
			{
				poolAddress: poolAddress,
				size: parseEther(getQuotesQuery.size.toString()).toString(),
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
			message: e,
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

	const quotesQuery = req.query as unknown as QuoteIds

	if (quotesQuery.quoteIds.length > 25) {
		Logger.error('Quotes quantity is up to 25 per request!')
		return res.status(400).json({
			message: 'Quotes quantity is up to 25 per request!',
		})
	}

	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest('orders', 'GET', quotesQuery, null)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: e,
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
			await provider.waitForTransaction(settleTx.hash, 1)
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
			await provider.waitForTransaction(exerciseTx.hash, 1)
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
			const annihilateTx = await pool.annihilate(size, {
				gasLimit: gasLimit,
			})
			await provider.waitForTransaction(annihilateTx.hash, 1)
			return option
		})
	)

	const requestSummary = requestDetailed(promiseAll, options)

	return res.status(200).json(requestSummary)
})

// NOTE: option positions currently open
app.get('/account/option_balances', async (req, res) => {
	let optionBalancesRequest
	try {
		optionBalancesRequest = await proxyHTTPRequest(
			'account/option_balances',
			'GET',
			{
				chainId: chainId,
				wallet: walletAddr,
			},
			null
		)
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: e,
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
	let proxyResponse
	try {
		proxyResponse = await proxyHTTPRequest('orders', 'GET', {
			provider: walletAddr,
			chainId: chainId,
		})
	} catch (e) {
		Logger.error(e)
		return res.status(500).json({
			message: e,
		})
	}
	const orderbookQuotes = proxyResponse.data as OrderbookQuote[]
	const returnedQuotes = orderbookQuotes.map(createReturnedQuotes)

	return res.status(200).json(returnedQuotes)
})

// NOTE: returns all collateral balances on Token addressed in config file
app.get('/account/collateral_balances', async (req, res) => {
	const [balances, failureReasons] = await getBalances()

	const failedBalanceQueries = difference(
		availableTokens,
		balances.map((balance) => balance.symbol)
	)

	return res.sendStatus(200).json({
		success: balances,
		failed: zipWith(
			failedBalanceQueries,
			failureReasons,
			(failedBalanceQuery, reason) => ({
				failedBalanceQuery,
				reason,
			})
		),
	})
})

// NOTE: ETH balance
app.get('/account/native_balance', async (req, res) => {
	let nativeBalance: number
	try {
		nativeBalance = parseFloat(
			formatEther(await provider.getBalance(walletAddr))
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
	const promiseAll = await Promise.allSettled(
		approvals.map(async (approval) => {
			const erc20Addr =
				process.env.ENV == 'production'
					? arb.tokens[approval.token]
					: arbGoerli.tokens[approval.token]
			const erc20 = ISolidStateERC20__factory.connect(erc20Addr, signer)

			if (approval.amt === 'max') {
				const response = await erc20.approve(
					routerAddress,
					MaxUint256.toString()
				)
				await provider.waitForTransaction(response.hash, 1)
				Logger.info(`${approval.token} approval set to MAX`)
			} else {
				const decimals = await erc20.decimals()
				const qty = parseUnits(approval.amt.toString(), Number(decimals))

				const response = await erc20.approve(routerAddress, qty)
				await provider.waitForTransaction(response.hash, 1)
				Logger.info(
					`${approval.token} approval set to ${parseFloat(
						formatEther(approval.amt)
					)}`
				)
			}
			return approval
		})
	)

	const approved: TokenApproval[] = []
	const reasons: any[] = []
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			approved.push(result.value)
		}
		if (result.status === 'rejected') {
			reasons.push(result.reason)
		}
	})

	const failedApprovals = difference(approvals, approved)

	return res.sendStatus(200).json({
		success: approved,
		failed: zipWith(failedApprovals, reasons, (failedApproval, reason) => ({
			failedApproval,
			reason,
		})),
	})
})

const server = app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`)
})

const wsProxyCloudClient = new WebSocket(ws_url)
const wsServer = new WebSocket.Server({ server })
wsServer.on('connection', (wsLocalConnection) => {
	wsLocalConnection.on('message', (clientMsg) => {
		wsProxyCloudClient.send(clientMsg.toString())
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
			case 'FILL_QUOTE':
				wsLocalConnection.send(
					JSON.stringify({
						type: message.type,
						body: createReturnedQuotes(message.body),
						size: message.size,
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
