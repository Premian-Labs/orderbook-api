import axios from 'axios'
import { expect } from 'chai'
import moment from 'moment'

import { checkEnv } from '../config/checkConfig'
import { Pool, PoolWithAddress, PostPoolsResponse } from '../types/quote'
import { createExpiration } from '../helpers/create'
import { baseUrl, getMaturity } from './helpers/utils'

checkEnv(true)

describe('Pool API', () => {
	it('should deploy pools', async () => {
		const url = `${baseUrl}/pools`
		const pools: Pool[] = [
			{
				base: 'testWETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2300,
				type: 'C',
			},
			{
				base: 'testWETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2300,
				type: 'P',
			},
		]

		const postDeployPools = await axios.post(url, pools, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const deployedPools = postDeployPools.data as PostPoolsResponse
		const validPools = [...deployedPools.created, ...deployedPools.existed]

		expect(deployedPools.failed).to.be.empty
		expect(validPools).not.to.be.empty
		expect(validPools[0]).has.property('poolAddress')
	})

	it('should fetch all valid deployed pools', async () => {
		const url = `${baseUrl}/pools`
		const getDeployedPools = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'testWETH',
			},
		})

		const deployedPools = getDeployedPools.data as PoolWithAddress[]
		expect(deployedPools).not.be.empty
		expect(deployedPools.every((pool) => pool.base === 'testWETH')).to.be.true
		expect(() =>
			deployedPools.forEach((pool) => createExpiration(pool.expiration))
		).not.throws
	})
})

describe('Pools Helpers API', () => {
	it('should get valid maturities', async () => {
		const url = `${baseUrl}/pools/maturities`
		const getMaturities = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const maturities = getMaturities.data as string[]

		expect(maturities).not.be.empty
		expect(
			maturities.every((maturity) => moment(maturity, 'DDMMMYY').isValid())
		).to.be.true

		// Check that first two available maturities are tomorrow and the day after tomorrow
		const tomorrow = moment.utc().add(1, 'day')
		const afterTomorrow = moment.utc().add(2, 'day')

		const firstTwoMaturities = [tomorrow, afterTomorrow].map((ts) =>
			moment(ts).format('DDMMMYY').toUpperCase()
		)
		expect(firstTwoMaturities).to.be.deep.eq(maturities.slice(0, 2))

		// Check that next days after tomorrow and the day after tomorrow are Fridays
		expect(
			maturities
				.slice(3, -1)
				.every((maturity) => moment(maturity, 'DDMMMYY').day() === 5)
		).to.be.true
	})

	it('should get valid strikes with a spotPrice', async () => {
		const url = `${baseUrl}/pools/strikes`
		const spotPrice = 10000
		const getSuggestedStrikes = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				spotPrice: spotPrice,
			},
		})

		const suggestedStrikes = getSuggestedStrikes.data as number[]

		expect(suggestedStrikes).not.be.empty

		// NOTE: this test is specific to spotPrice = 10000
		expect(Math.min(...suggestedStrikes)).be.eq(spotPrice / 2)
		expect(Math.max(...suggestedStrikes)).be.eq(spotPrice * 2)

		// check ranges validity
		// NOTE: this test is specific to spotPrice = 10000
		const below10k = suggestedStrikes.filter((strike) => strike < spotPrice)
		const above10k = suggestedStrikes.filter((strike) => strike > spotPrice)

		expect(
			below10k.every((strike, i) => {
				const nextStrike = below10k[i + 1]
				const strikeRange = nextStrike - strike

				// end of array
				if (Number.isNaN(strikeRange)) return true

				return nextStrike - strike === 100
			})
		).to.be.true

		expect(
			above10k.every((strike, i) => {
				const nextStrike = above10k[i + 1]
				const strikeRange = nextStrike - strike

				// end of array
				if (Number.isNaN(strikeRange)) return true

				return nextStrike - strike === 1000
			})
		).to.be.true
	})

	it('should get valid strikes without a spotPrice', async () => {
		const url = `${baseUrl}/pools/strikes`
		const getSuggestedStrikes = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				market: 'WETH',
			},
		})

		const suggestedStrikes = getSuggestedStrikes.data as number[]

		expect(suggestedStrikes).not.be.empty
	})
})
