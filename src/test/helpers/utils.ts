import { omit } from 'lodash'
import axios from 'axios'
import {
	ContractTransactionResponse,
	MaxUint256,
	Signer,
	TransactionReceipt,
} from 'ethers'
import moment from 'moment'
import { IERC20__factory } from '@premia/v3-abi/typechain'

import { Pool, PostPoolsResponse } from '../../types/quote'
import { PublishQuoteRequest } from '../../types/validate'
import { routerAddress, tokenAddresses } from '../../config/constants'

export const baseUrl = `http://localhost:${process.env.HTTP_PORT}`

// NOTE: Only used for e2e test where the pool deployment endpoint is not being tested
export async function deployPools(quotes: PublishQuoteRequest[]) {
	const url = `${baseUrl}/pools`
	let createPools: Pool[] = []

	quotes.forEach((pool) => {
		createPools.push(omit(pool, ['side', 'size', 'price', 'deadline']))
	})

	console.log('Deploying pool(s)...')

	const poolDeployment = await axios.post(url, createPools, {
		headers: {
			'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
		},
	})

	const deployment = poolDeployment.data as PostPoolsResponse
	const validPools = [...deployment.created, ...deployment.existed]

	if (validPools.length == quotes.length) console.log('Pool(s) are deployed!')
	else if (deployment.failed.length > 0)
		console.log('One or more Pools FAILED to deploy!')
	else console.log('Error trying to deploy one or more pools!')

	return deployment
}

export async function setMaxApproval(
	collateralTypes: string[],
	signer: Signer
) {
	for (const token in collateralTypes) {
		const erc20 = IERC20__factory.connect(
			tokenAddresses[collateralTypes[token]],
			signer
		)

		let approveTX: ContractTransactionResponse
		let confirm: TransactionReceipt | null
		try {
			approveTX = await erc20.approve(routerAddress, MaxUint256.toString())
			confirm = await approveTX.wait(1)
			console.log(`Max approval set for ${collateralTypes[token]}`)
		} catch (e) {
			await delay(2000)
			try {
				approveTX = await erc20.approve(routerAddress, MaxUint256.toString())
				confirm = await approveTX.wait(1)
				console.log(`Max approval set for ${collateralTypes[token]}`)
			} catch (e) {
				throw new Error(
					`Approval could not be set for ${collateralTypes[token]}!`
				)
			}
		}

		if (confirm?.status == 0) {
			throw new Error(
				`Max approval NOT set for ${collateralTypes[token]}! Try again or check provider or ETH balance...`
			)
		}
	}
}

export function getMaturity(add: number = 7) {
	const maturity = moment()
		.utcOffset(0)
		.add(add, 'd')
		.day(5)
		.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })

	return moment
		.unix(maturity.valueOf() / 1000)
		.format('DDMMMYY')
		.toUpperCase()
}

export async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
