import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig'
import { Pool, PoolWithAddress } from '../src/types/quote'
import { expect } from 'chai'
import { createExpiration } from '../src/helpers/create'

checkEnv(true)
const baseUrl = `http://localhost:${process.env.HTTP_PORT}`

describe('Pool API', () => {
	it('should deploy pools', async () => {
		const url = `${baseUrl}/pools`
		const pools: Pool[] = [
			{
				base: 'testWETH',
				quote: 'USDC',
				expiration: '28JUN24',
				strike: 2100,
				type: 'C',
			},
			{
				base: 'testWETH',
				quote: 'USDC',
				expiration: '28JUN24',
				strike: 1900,
				type: 'P',
			},
		]

		const postDeployPools = await axios.post(url, pools, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		interface PostPoolsResponse {
			created: PoolWithAddress[]
			existed: PoolWithAddress[]
			failed: Pool[]
		}

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
				base: 'testWETH'
			}
		})

		const deployedPools = getDeployedPools.data as PoolWithAddress[]
		expect(deployedPools).not.be.empty
		expect(deployedPools.every(pool => pool.base === 'testWETH')).to.be.true
		expect(() =>
			deployedPools.forEach((pool) => createExpiration(pool.expiration))
		).not.throws
	})
})