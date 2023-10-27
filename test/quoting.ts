import { checkEnv } from '../src/config/checkConfig'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const url = `http://localhost:${process.env.HTTP_PORT}`

describe('API authorisation', () => {
	it('should prevent unauthorised access to the API', async () => {})
})

describe('post/orderbook/quotes', () => {
	it('should post valid quotes to the orderbook', async () => {})

	it('should prevent quotes with invalid deadlines from posting', async () => {})

	it('should prevent quotes with invalid expirations from posting', async () => {})

	it('should attempt to publish an invalid quote and receive an error message', async () => {})
})

describe('patch/orderbook/quotes', () => {
	it('should fill valid put/call quotes from the orderbook', async () => {})

	it('should not fill more than 25 quotes per request', async () => {})

	it('should not attempt to fill with size of ZERO', async () => {})

	it('should return quoteIds for filled and invalid to fill quotes', async () => {})

	it('should ignore fill attempts for non-existent quotes', async () => {})

	it('should reject fill attempts larger than fillableSize', async () => {})

	it('should reject filling orders w/o proper user collateral', async () => {})
})

describe('delete/orderbook/quotes', () => {
	it('should delete quotes from the orderbook', async () => {})

	it('should return quoteIds of failed delete attempts', async () => {})

	it('should provide a list of quotes omitted from delete attempt', async () => {})
})

describe('get/orderbook/quotes', () => {
	it('should return quotes for a specified Option & size', async () => {})
})

describe('get/orderbook/orders', () => {
	it('should return quote objects using an array of QuoteIds', async () => {})
})
