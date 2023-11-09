import { checkEnv } from '../src/config/checkConfig'
import axios from 'axios';
import { PublishQuoteRequest } from '../src/types/validate';
import { PostQuotesResponse } from '../src/types/quote';
import { expect } from 'chai'
import { IERC20__factory } from '@premia/v3-abi/typechain';
import { ethers, ContractTransactionResponse, TransactionReceipt, MaxUint256} from 'ethers';
import { privateKey, rpcUrl, tokenAddresses, routerAddress } from '../src/config/constants';
import { delay } from '../src/helpers/util'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const baseUrl = `http://localhost:${process.env.HTTP_PORT}`
const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)
let quoteId: string
const quote : PublishQuoteRequest = {
	base: 'WETH',
	quote: 'USDC',
	expiration: `17NOV23`,
	strike: 1800,
	type: `P`,
	side: 'bid',
	size: 1,
	price: .1,
	deadline: 120
}

// Approval for quote token
const erc20 = IERC20__factory.connect(tokenAddresses.USDC, signer)

async function setMaxApproval(){
	let approveTX: ContractTransactionResponse
	let confirm: TransactionReceipt | null
	try {
		approveTX = await erc20.approve(
			routerAddress,
			MaxUint256.toString(),
		)
		confirm = await approveTX.wait(1)
	} catch (e) {
		await delay(2000)
		try {
			approveTX = await erc20.approve(
				routerAddress,
				MaxUint256.toString(),
			)
			confirm = await approveTX.wait(1)
		} catch (e) {
			throw new Error(`Approval could not be set for USDC!`)
		}
	}

	if (confirm?.status == 0) {
		throw new Error(
			`Max approval NOT set for USDC! Try again or check provider or ETH balance...`,
		)
	}
}
before(async() =>{
	console.log(`Setting ${quote.quote} Approval to Max`)
	await setMaxApproval()
	console.log(`${quote.quote} Approval successful`)
})

// describe('API authorization', () => {
// 	it('should prevent unauthorised access to the API', async () => {
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const DUMMY_ORDERBOOK_API_KEY = 'testnet_3ZfbUdiFNZXfg4dKUqX9KH3F'
// 		const response = await axios.post(url, [quote], {
// 			headers: {
// 				'x-apikey': DUMMY_ORDERBOOK_API_KEY,
// 			},
// 			validateStatus: function (status) {
// 				return status < 500
// 			}
// 		})
//
// 		expect(response.status).to.eq(401)
// 		expect(response.data.message).to.eq('NOT_FOUND')
// 	})
// })

// describe('POST orderbook/quotes', () => {
// 	it('should reject invalid AJV post quote payload', async () => {
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const badQuote = {...quote, size: '1'}
// 		const badQuoteResponse = await axios.post(url, [badQuote], {
// 			headers: {
// 				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
// 			},
// 			validateStatus: function (status) {
// 				return status < 500
// 			}
// 		})
//
// 		expect(badQuoteResponse.status).to.eq(400)
// 		expect(badQuoteResponse.data[0].message).to.eq(`must be number`)
// 	})
//
// 	it('should post a valid quote to the orderbook', async () => {
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const validQuoteResponse = await axios.post(url, [quote], {
// 			headers: {
// 				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
// 			}
// 		})
// 		const quotes: PostQuotesResponse = validQuoteResponse.data
// 		quoteId = quotes.created[0].quoteId
// 		expect(validQuoteResponse.status).to.eq(201)
// 		expect(quotes.created.length).to.eq(1)
// 		expect(quotes.failed.length).to.eq(0)
// 		expect(quotes.exists.length).to.eq(0)
// 	})
//
// 	it('should validate the option expiration', async () => {
// 		// NOTE: this will ONLY check that a validation process exists => createExpiration()
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const badExpQuote = {...quote, expiration: '03NOV23'}
// 		const expiredOptResponse = await axios.post(url, [badExpQuote], {
// 			headers: {
// 				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
// 			},
// 			validateStatus: function (status) {
// 				return status < 500
// 			}
// 		})
// 		expect(expiredOptResponse.status).to.eq(400)
// 		expect(expiredOptResponse.data.message).to.eq('Invalid expiration date: 03NOV23 is in the past')
// 	})
//
// 	it ('should reject orders that expire in < 60 sec', async () => {
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const badDeadlineQuote = {...quote, deadline: 20}
// 		const badDeadlineResponse = await axios.post(url, [badDeadlineQuote], {
// 			headers: {
// 				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
// 			},
// 			validateStatus: function (status) {
// 				return status < 500
// 			}
// 		})
// 		expect(badDeadlineResponse.status).to.eq(400)
// 		expect(badDeadlineResponse.data.message).to.eq('Quote deadline is invalid (cannot be less than 60 sec)')
// 	})
// })

describe('PATCH orderbook/quotes', () => {
	// it('should reject invalid AJV fill quote payload', async () => {
	// 	const url = `${baseUrl}/orderbook/quotes`
	// 	const zeroSizeFillQuote = {
	// 		tradeSize: 0,
	// 		quoteId: quoteId
	// 	}
	// 	const zeroTradeSizeResponse = await axios.patch(url, [zeroSizeFillQuote], {
	// 		headers: {
	// 			'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
	// 		},
	// 		validateStatus: function (status) {
	// 			return status < 500
	// 		}
	// 	})
	//
	// 	expect(zeroTradeSizeResponse.status).to.eq(400)
	// 	expect(zeroTradeSizeResponse.data[0].message).to.eq(`must be > 0`)
	//
	// 	const tooManyQuotes = Array(26).fill({tradeSize: 1, quoteId: quoteId})
	//
	// 	const tooManyQuotesResponse = await axios.patch(url, tooManyQuotes, {
	// 		headers: {
	// 			'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
	// 		},
	// 		validateStatus: function (status) {
	// 			return status < 500
	// 		}
	// 	})
	//
	// 	expect(tooManyQuotesResponse.status).to.eq(400)
	// 	expect(tooManyQuotesResponse.data.message).to.eq(`Quotes quantity is up to 25 per request!`)
	// })
	//
	// it('should fill valid quotes from the orderbook', async () => {
	// 	const url = `${baseUrl}/orderbook/quotes`
	// 	const fillQuote = {
	// 		tradeSize: quote.size,
	// 		quoteId: quoteId
	// 	}
	// 	const response = await axios.patch(url, [fillQuote], {
	// 		headers: {
	// 			'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
	// 		}
	// 	})
	//
	// 	expect(response.status).to.eq(200)
	// 	expect(response.data.success[0]).to.eq(quoteId)
	// })

	it('should fill quotes even if tradeSize is larger than fillableSize', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		// post quote to fill
		const validQuoteResponse = await axios.post(url, [quote], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			}
		})
		const quotes: PostQuotesResponse = validQuoteResponse.data
		quoteId = quotes.created[0].quoteId
		const fillOversizedQuote = {
			tradeSize: 999,
			quoteId: quoteId
		}

		const fillableSizeResponse = await axios.patch(url, [fillOversizedQuote], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			}
		})
		console.log(fillableSizeResponse.status)
		console.log(fillableSizeResponse.data)
	})
	//
	// it('should return quoteIds for invalid fill quote attempts', async () => {
	// 	//TODO: not enough collateral
	// 	//TODO: order cancelled (does not exist)
	// })
	//
	// it('should ignore fill attempts for non-existent quotes', async () => {})
	//
	// it('should reject fill attempts larger than fillableSize', async () => {})
})

// describe('delete/orderbook/quotes', () => {
// 	it('should delete quotes from the orderbook', async () => {})
//
// 	it('should return quoteIds of failed delete attempts', async () => {})
//
// 	it('should provide a list of quotes omitted from delete attempt', async () => {})
// })
//
// describe('get/orderbook/quotes', () => {
// 	it('should return fillable quotes for a specified market up to size', async () => {})
// })
//
// describe('get/orderbook/orders', () => {
// 	it('should return all quotes when providing an array of QuoteIds in request params', async () => {})
//
// 	it('should return all quotes for specified market', async () => {})
// })
