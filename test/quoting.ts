import dotenv from 'dotenv';
import axios from 'axios'
import { checkEnv } from '../src/config/setConfig';

dotenv.config();
// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true);

const url = `https://localhost:${process.env.HTTP_PORT}`

describe("Post/orderbook/quotes", () => {
	it('should post valid quotes to the orderbook', async () => {
	});

	it('should prevent quotes with invalid deadlines from posting', async () => {
	});

	it('should prevent quotes with invalid expirations from posting', async () => {
	});
})

describe("Patch/orderbook/quotes", () => {
	it('should fill valid put/call quotes from the orderbook', async () => {
	});

	it('should not fill more than 25 quotes per request', async () => {
	});

	it('should not attempt to fill with size of ZERO', async () => {
	});

	it('should ignore fill attempts for bad quoteIds', async () => {
	});

	it('should reject fill attempts larger than fillableSize', async () => {
	});

	it('should reject filling orders w/o proper user collateral', async () => {
	});

})

describe("Delete/orderbook/quotes", () => {
	it('should delete quotes from the orderbook', async () => {
	});

	it('should return quoteIds of failed delete attempts', async () => {
	});

	it('should provide a list of quotes omitted from delete attempt', async () => {
	});
})

describe("Get/orderbook/quotes", () => {
	it('should return quotes for a specified Option & size', async () => {
	});
})

describe("Get/orderbook/orders", () => {
	it('should return quote objects using an array of QuoteIds', async () => {
	});
})

describe("Websocket", () => {
	it('should connect to ws', async () => {
	});

	it('should receive a quote from ws', async () => {
	});

	it('should disconnect to ws', async () => {
	});
})


