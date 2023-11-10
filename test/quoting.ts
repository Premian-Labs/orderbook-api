import { checkEnv } from '../src/config/checkConfig'
import axios from 'axios'
import {
	FillQuoteRequest,
	PublishQuoteRequest,
	QuoteIds,
} from '../src/types/validate'
import {
	CancelQuotesResponse,
	PostQuotesResponse,
	ReturnedOrderbookQuote,
} from '../src/types/quote'
import { expect } from 'chai'
import { IERC20__factory } from '@premia/v3-abi/typechain'
import {
	ethers,
	ContractTransactionResponse,
	TransactionReceipt,
	MaxUint256,
} from 'ethers'
import {
	privateKey,
	rpcUrl,
	tokenAddresses,
	routerAddress,
} from '../src/config/constants'
import { delay } from '../src/helpers/util'
import {omit} from "lodash";

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const baseUrl = `http://localhost:${process.env.HTTP_PORT}`
const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)
const collateralTypes = ['testWETH', 'USDC']

let quoteId_1: string
let quoteId_2: string

const quote1: PublishQuoteRequest = {
	base: 'testWETH',
	quote: 'USDC',
	expiration: `17NOV23`,
	strike: 1800,
	type: `P`,
	side: 'bid',
	size: 1,
	price: 0.1,
	deadline: 120,
}

const quote2: PublishQuoteRequest = {
	base: 'testWETH',
	quote: 'USDC',
	expiration: `17NOV23`,
	strike: 1800,
	type: `C`,
	side: 'bid',
	size: 1,
	price: 0.1,
	deadline: 120,
}

async function setMaxApproval() {
	for (const token in collateralTypes) {
		const erc20 = IERC20__factory.connect(
			tokenAddresses[collateralTypes[token]],
			signer
		)

		let approveTX: ContractTransactionResponse
		let confirm: TransactionReceipt | null
		try {
			approveTX = await erc20.approve(routerAddress, MaxUint256.toString())
			confirm = await approveTX.wait(1)
			console.log(`Max approval set for ${collateralTypes[token]}`)
		} catch (e) {
			await delay(2000)
			try {
				approveTX = await erc20.approve(routerAddress, MaxUint256.toString())
				confirm = await approveTX.wait(1)
				console.log(`Max approval set for ${collateralTypes[token]}`)
			} catch (e) {
				throw new Error(`Approval could not be set for USDC!`)
			}
		}

		if (confirm?.status == 0) {
			throw new Error(
				`Max approval NOT set for USDC! Try again or check provider or ETH balance...`
			)
		}
	}
}
before(async () => {
	console.log(`Setting Collateral Approvals to Max`)
	await setMaxApproval()
	console.log(`Approvals successful`)
})

describe('Orderbook API authorization', () => {
	it('should prevent unauthorised access to the Orderbook API', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const DUMMY_ORDERBOOK_API_KEY = 'testnet_3ZfbUdiFNZXfg4dKUqX9KH3F'
		const response = await axios.post(url, [quote1, quote2], {
			headers: {
				'x-apikey': DUMMY_ORDERBOOK_API_KEY,
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(response.status).to.eq(401)
		expect(response.data.message).to.eq('NOT_FOUND')
	})
})

describe('POST orderbook/quotes', () => {
	it('should reject invalid AJV post quote payload', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const badQuote = { ...quote1, size: '1' }
		const badQuoteResponse = await axios.post(url, [badQuote, quote2], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(badQuoteResponse.status).to.eq(400)
		expect(badQuoteResponse.data[0].message).to.eq(`must be number`)
	})

	it('should post a valid quotes to the orderbook', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const validQuoteResponse = await axios.post(url, [quote1, quote2], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const quotes: PostQuotesResponse = validQuoteResponse.data
		quoteId_1 = quotes.created[0].quoteId
		quoteId_2 = quotes.created[1].quoteId

		expect(validQuoteResponse.status).to.eq(201)
		expect(quotes.created.length).to.eq(2)
		expect(quotes.failed.length).to.eq(0)
		expect(quotes.exists.length).to.eq(0)
	})

	it('should reject quotes with bad option expirations', async () => {
		// NOTE: this test will ONLY check for an expired option (additional checks are done within codebase).
		const url = `${baseUrl}/orderbook/quotes`
		const badExpQuote = { ...quote1, expiration: '03NOV23' }
		const expiredOptResponse = await axios.post(url, [badExpQuote, quote2], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(expiredOptResponse.status).to.eq(400)
		expect(expiredOptResponse.data.message).to.eq(
			'Invalid expiration date: 03NOV23 is in the past'
		)
	})

	it('should reject orders that expire in < 60 sec', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const badDeadlineQuote = { ...quote1, deadline: 20 }
		const badDeadlineResponse = await axios.post(
			url,
			[badDeadlineQuote, quote2],
			{
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				},
				validateStatus: function (status) {
					return status < 500
				},
			}
		)
		expect(badDeadlineResponse.status).to.eq(400)
		expect(badDeadlineResponse.data.message).to.eq(
			'Quote deadline is invalid (cannot be less than 60 sec)'
		)
	})
})

describe('PATCH orderbook/quotes', () => {
	it('should reject invalid AJV fill quote payload', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const zeroSizeFillQuote = [
			{
				tradeSize: 0,
				quoteId: quoteId_1,
			},
			{
				tradeSize: 1,
				quoteId: quoteId_2,
			},
		]
		const zeroTradeSizeResponse = await axios.patch(url, zeroSizeFillQuote, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(zeroTradeSizeResponse.status).to.eq(400)
		expect(zeroTradeSizeResponse.data[0].message).to.eq(`must be > 0`)
	})

	it(`should reject fill quote payloads larger than 25`, async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const tooManyQuotes = Array(26).fill({ tradeSize: 1, quoteId: quoteId_1 })

		const tooManyQuotesResponse = await axios.patch(url, tooManyQuotes, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(tooManyQuotesResponse.status).to.eq(400)
		expect(tooManyQuotesResponse.data.message).to.eq(
			`Quotes quantity is up to 25 per request!`
		)
	})

	it('should fill valid quotes from the orderbook', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const fillQuote: FillQuoteRequest[] = [
			{
				tradeSize: quote1.size,
				quoteId: quoteId_1,
			},
			{
				tradeSize: quote2.size,
				quoteId: quoteId_2,
			},
		]
		const response = await axios.patch(url, fillQuote, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		expect(response.status).to.eq(200)
		expect(response.data.success).to.deep.eq([quoteId_1, quoteId_2])
		expect(response.data.failed).to.be.empty
	})

	it('should return quoteIds for invalid fill quote attempts', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		// post quote to fill
		const validQuoteResponse = await axios.post(url, [quote1, quote2], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})
		const quotes: PostQuotesResponse = validQuoteResponse.data
		quoteId_1 = quotes.created[0].quoteId
		quoteId_2 = quotes.created[1].quoteId

		const fillOversizedQuote: FillQuoteRequest[] = [
			{
				tradeSize: 999,
				quoteId: quoteId_1,
			},
			{
				tradeSize: 1,
				quoteId: quoteId_2,
			},
		]
		const fillableSizeResponse = await axios.patch(url, fillOversizedQuote, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		expect(fillableSizeResponse.status).to.eq(200)
		expect(fillableSizeResponse.data.success[0]).to.eq(quoteId_2)
		expect(fillableSizeResponse.data.failed[0]).to.eq(quoteId_1)

		// bad quoteIds are be due to expired, cancelled, or nonexistent quotes in the orderbook
		const badQuoteId: string =
			'0x8c822abaf76dea4faf867c9c2e0a615c8f0124c2454b03e06251689b13ca5f0d'

		const fillNonExistentQuote: FillQuoteRequest[] = [
			{
				tradeSize: 1,
				quoteId: badQuoteId,
			}
		]

		const nonExistentQuoteResponse = await axios.patch(
			url,
			fillNonExistentQuote,
			{
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				},
			}
		)

		expect(nonExistentQuoteResponse.status).to.eq(200)
		expect(nonExistentQuoteResponse.data.success).to.be.empty
		expect(nonExistentQuoteResponse.data.failed[0]).to.eq(badQuoteId)
	})
})

describe('delete/orderbook/quotes', () => {
		it('should delete quotes from the orderbook', async () => {
			const url = `${baseUrl}/orderbook/quotes`
			// post quote to cancel
			const validQuoteResponse = await axios.post(url, [quote1, quote2], {
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				}
			})

			const quotes: PostQuotesResponse = validQuoteResponse.data
			quoteId_1 = quotes.created[0].quoteId
			quoteId_2 = quotes.created[1].quoteId

			const cancelQuotes: QuoteIds = {
				quoteIds: [quoteId_1, quoteId_2]
			}

			const deleteQuoteResponse = await axios.delete(url, {
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				},
				data: cancelQuotes
			})

			const cancelQuotesResponse: CancelQuotesResponse = deleteQuoteResponse.data

			expect(deleteQuoteResponse.status).to.eq(200)
			expect(cancelQuotesResponse.success).to.deep.eq([quoteId_1, quoteId_2])
			expect(cancelQuotesResponse.failed).to.be.empty
			expect(cancelQuotesResponse.omitted).to.be.empty

			// bad quoteIds are be due to expired, cancelled, or nonexistent quotes in the orderbook
			const badQuoteId: string = "0x8c822abaf76dea4faf867c9c2e0a615c8f0124c2454b03e06251689b13ca5f0d"

			const badCancelQuotes: QuoteIds = {
				quoteIds: [badQuoteId]
			}

			const badDeleteQuoteResponse = await axios.delete(url, {
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				},
				data: badCancelQuotes
			})

			expect(badDeleteQuoteResponse.status).to.eq(200)
			expect(badDeleteQuoteResponse.data.success).to.be.empty
			expect(badDeleteQuoteResponse.data.failed).to.be.empty
			expect(badDeleteQuoteResponse.data.omitted[0]).to.eq(badQuoteId)
		})
})

describe('get/orderbook/quotes', () => {
	it('should return fillable quotes for a specified market up to size', async () => {
		const url = `${baseUrl}/orderbook/quotes`

		await axios.post(url, [quote1], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		// querying by a size equal to the quote amount
		const quoteParams = omit(quote1, ['deadline', 'price'])

		const validGetQuotesResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: quoteParams,
		})

		const quotes: ReturnedOrderbookQuote[] = validGetQuotesResponse.data
		expect(quotes).not.be.empty
	})
})

describe('get/orderbook/orders', () => {
	it('should return all quotes when providing an array of QuoteIds in request params', async () => {
		const quotesUrl = `${baseUrl}/orderbook/quotes`
		const quoteResponse = await axios.post(quotesUrl, [quote1], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			}
		})

		const quotes: PostQuotesResponse = quoteResponse.data
		const quoteId_1 = quotes.created[0].quoteId
		const getOrders: QuoteIds = {
			quoteIds: [quoteId_1]
		}

		const ordersUrl = `${baseUrl}/orderbook/orders`
		const validGetOrdersResponse = await axios.get(ordersUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: getOrders
		})

		const orders: ReturnedOrderbookQuote[] = validGetOrdersResponse.data

		const returnedQuote = orders.filter(order => order.quoteId == quoteId_1)

		expect(returnedQuote).not.be.empty
	})

	it('should return all quotes for specified market', async () => {})
})
