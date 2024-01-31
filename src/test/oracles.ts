import { checkEnv } from '../config/checkConfig'
import { baseUrl } from './helpers/utils'
import axios from 'axios'
import { expect } from 'chai'
import { ReturnedOrderbookQuote } from '../types/quote'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)
describe('Oracles', () => {
	it('should return a valid iv value', async () => {
		// NOTE: this test will ONLY check for an expired option (additional checks are done within codebase).
		const url = `${baseUrl}/oracles/iv`
		const validGetIVResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'ARB',
				strike: 0.9935465,
				expiration: '09FEB24',
			},
		})

		const iv = validGetIVResponse.data
		console.log(iv)
	})

	//
	// it ('should reject invalid AJV params', () => {
	//
	// })
	//
	// it ('should reject quotes with bad option expirations', () => {
	//
	// })
})
