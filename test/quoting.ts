import { checkEnv } from '../src/config/checkConfig'
import axios from 'axios';
import { PublishQuoteRequest } from '../src/types/validate';
import { PostQuotesResponse } from '../src/types/quote';
import { expect } from 'chai'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)
const baseUrl = `http://localhost:${process.env.HTTP_PORT}`
const quote : PublishQuoteRequest = {
	base: 'WETH',
	quote: 'USDC',
	expiration: `10NOV23`,
	strike: 1800,
	type: `P`,
	side: 'bid',
	size: 1,
	price: .1,
	deadline: 120
}

//TODO: add token approval for test account

// describe('API authorization', () => {
// 	it('should prevent unauthorised access to the API', async () => {
// 		const url = `${baseUrl}/orderbook/quotes`
// 		const DUMMY_ORDERBOOK_API_KEY = 'testnet_3ZfbUdiFNZXfg4dKUqX9KH3F'
// 		const response = await axios.post(url, [quote], {
// 			headers: {
// 				'x-apikey': DUMMY_ORDERBOOK_API_KEY,
// 			}
// 		})
// 	})
// })

describe('post/orderbook/quotes', () => {
	it('should post a valid quote to the orderbook', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		const response = await axios.post(url, [quote], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			}
		})
		const quotes: PostQuotesResponse = response.data
		expect(response.status).to.eq(201)
		expect(quotes.created.length).to.eq(1)
		expect(quotes.failed.length).to.eq(0)
		expect(quotes.exists.length).to.eq(0)
	})

// 	it('should reject invalid AJV quote payload', async () => {})
//
// 	it('should attempt to publish invalid quotes an error message', async () => {})
})


//
// describe('patch/orderbook/quotes', () => {
// 	it('should fill valid quotes from the orderbook', async () => {})
//
// 	// TODO: merge all AJV errors into a single case
// 	// AJV error
// 	it('should not fill more than 25 quotes per request', async () => {})
//
// 	// AJV error
// 	it('should not attempt to fill with size of ZERO', async () => {})
//
// 	it('should return quoteIds for invalid fill quote attempts', async () => {})
//
// 	// TODO: merge with previous
// 	it('should reject filling orders w/o proper user collateral', async () => {})
//
// 	it('should ignore fill attempts for non-existent quotes', async () => {})
//
// 	it('should reject fill attempts larger than fillableSize', async () => {})
// })
//
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
