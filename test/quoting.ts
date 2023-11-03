import { checkEnv } from '../src/config/checkConfig'
import axios from 'axios'
import { PublishQuoteRequest } from '../src/types/validate';

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const baseUrl = `http://localhost:${process.env.HTTP_PORT}`

describe('Local Host Smoke Test', () => {
	it('POST -> orderbook/quotes', async () => {
		const url = `${baseUrl}/orderbook/quotes`
		console.log(`URL: ${url}`)
		//TODO: add approval
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
		try{
			const response = await axios.post(url, [quote], {
				headers: {
					'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
				}
			})
			console.log(response)
		}catch(e){
			console.log(e)
		}

	})
})


// describe('API authorisation', () => {
// 	it('should prevent unauthorised access to the API', async () => {})
// })
//
// describe('post/orderbook/quotes', () => {
// 	it('should post valid quotes to the orderbook', async () => {})
//
// 	it('should reject invalid AJV quote payload', async () => {})
//
// 	it('should attempt to publish invalid quotes an error message', async () => {})
// })
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
