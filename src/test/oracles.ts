import axios from 'axios'
import { expect } from 'chai'
import { isArray } from 'lodash'

import { checkEnv } from '../config/checkConfig'
import { baseUrl, getMaturity } from './helpers/utils'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const ivUrl = `${baseUrl}/oracles/iv`
const spotUrl = `${baseUrl}/oracles/spot`
describe('IV Oracles', () => {
	it('should return a valid iv values', async () => {
		const validGetIVResponse = await axios.get(ivUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				expiration: getMaturity(),
			},
		})

		const iv = validGetIVResponse.data

		expect(isArray(iv)).to.be.true
		expect(iv.length).to.be.gt(0)
		expect(iv[0]['strike']).to.be.gt(0)
		expect(iv[0]['iv']).to.be.gt(0)
	})

	it('should reject invalid market', async () => {
		const invalidMarketIVResponse = await axios.get(ivUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'ABCD',
				expiration: getMaturity(),
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		expect(invalidMarketIVResponse.status).to.eq(400)
		expect(invalidMarketIVResponse.data[0].message).to.eq(
			`must match pattern \"^WETH$|^WBTC$|^ARB$|^LINK$|^wstETH$|^GMX$|^MAGIC$|^SOL$|^FXS$\"`
		)
	})

	it('should reject iv request for a bad option expiration', async () => {
		const invalidExpResponse = await axios.get(ivUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				expiration: '26JAN24',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		expect(invalidExpResponse.status).to.eq(400)
		expect(invalidExpResponse.data.message).to.eq(
			'Invalid expiration date: 26JAN24 is in the past'
		)
	})

	it('should allow a user to manually provide spot price', async () => {
		const validGetIVResponse = await axios.get(ivUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
				expiration: getMaturity(),
				spotPrice: 2200,
			},
		})

		const ivManualSpot = validGetIVResponse.data

		expect(isArray(ivManualSpot)).to.be.true
		expect(ivManualSpot.length).to.be.gt(0)
		expect(ivManualSpot[0]['strike']).to.be.gt(0)
		expect(ivManualSpot[0]['iv']).to.be.gt(0)
	})
})

describe('Spot Oracles', () => {
	it('should return a valid spot prices', async () => {
		const validGetSpotResponse = await axios.get(spotUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				markets: ['WETH', 'WBTC', 'LINK'],
			},
		})

		const spotPrices = validGetSpotResponse.data

		expect(isArray(spotPrices)).to.be.true
		expect(spotPrices.length).to.eq(3)
		expect(spotPrices[0]['market']).to.eq('WETH')
		expect(spotPrices[1]['market']).to.eq('WBTC')
		expect(spotPrices[2]['market']).to.eq('LINK')
		expect(spotPrices[0]['price']).to.be.gt(0)
		expect(spotPrices[1]['price']).to.be.gt(0)
		expect(spotPrices[2]['price']).to.be.gt(0)
	})

	it('should reject invalid market', async () => {
		const invalidGetSpotResponse = await axios.get(spotUrl, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				markets: ['WETH', 'WBTC', 'XXX'],
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		expect(invalidGetSpotResponse.status).to.eq(400)
		// NOTE: this list is a testnet list, in production the list is different
		expect(invalidGetSpotResponse.data[0].message).to.eq(
			`must match pattern \"^testWETH$|^WETH$|^WBTC$|^PREMIA$|^LINK$|^USDC$|^DAI$\"`
		)
	})
})
