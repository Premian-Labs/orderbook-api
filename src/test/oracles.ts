import axios from 'axios'
import { expect } from 'chai'

import { checkEnv } from '../config/checkConfig'
import { baseUrl, getMaturity } from './helpers/utils'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const url = `${baseUrl}/oracles/iv`
describe('Oracles', () => {
	it('should return a valid iv value', async () => {
		const validGetIVResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				strike: 2200,
				expiration: getMaturity(),
			},
		})

		const iv = validGetIVResponse.data

		expect(typeof iv).to.eq('number')
		expect(iv).to.be.gt(0)
	})

	it('should reject invalid market', async () => {
		const invalidMarketIVResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'ABCD',
				strike: 2200,
				expiration: getMaturity(),
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(invalidMarketIVResponse.status).to.eq(400)
		expect(invalidMarketIVResponse.data[0].message).to.eq(
			`must match pattern \"^WETH$|^WBTC$|^ARB$|^LINK$|^WSTETH$|^GMX$|^MAGIC$|^SOL$|^FXS$\"`
		)
	})

	it('should reject iv request for a bad option expiration', async () => {
		const invalidExpResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				strike: 2200,
				expiration: '26JAN24',
			},
			validateStatus: function (status) {
				return status < 500
			},
		})

		expect(invalidExpResponse.status).to.eq(400)
		expect(invalidExpResponse.data.message).to.eq(
			'Invalid expiration date: 26JAN24 is in the past'
		)
	})

	it('should allow a user to manually provide spot price', async () => {
		const validGetIVResponse = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				strike: 2200,
				expiration: getMaturity(),
				spotPrice: 2200,
			},
		})

		const iv = validGetIVResponse.data

		expect(typeof iv).to.eq('number')
		expect(iv).to.be.gt(0)
	})
})
