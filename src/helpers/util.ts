import { Option } from '../types/validate'
import { difference, zipWith } from 'lodash'
import axios from 'axios'
import { blockByTsEndpoint, rpcUrl } from '../config/constants'
import Logger from '../lib/logger'
import { ethers } from 'ethers'
const provider = new ethers.JsonRpcProvider(rpcUrl)

export function requestDetailed(
	promiseAll: PromiseSettledResult<Option>[],
	request: Option[]
) {
	const fulfilledOptions: Option[] = []
	const reasons: any[] = []
	promiseAll.forEach((result) => {
		if (result.status === 'fulfilled') {
			fulfilledOptions.push(result.value)
		}
		if (result.status === 'rejected') {
			reasons.push(result.reason)
		}
	})

	const failedOptions = difference(
		request, // original array
		fulfilledOptions // fulfilled options to be removed
	)

	return {
		success: fulfilledOptions,
		failed: zipWith(failedOptions, reasons, (failedOption, reason) => ({
			failedOption,
			reason,
		})),
	}
}

export async function delay(t: number) {
	await new Promise((resolve) => setTimeout(resolve, t))
}

export async function getBlockByTimestamp(ts: number) {
	let blockRequest
	try {
		blockRequest = await axios.get(blockByTsEndpoint, {
			params: {
				module: 'block',
				action: 'getblocknobytime',
				closest: 'before',
				timestamp: ts,
			},
		})
		const status = blockRequest.data['status']

		if (Number(status) === 1) {
			return Number(blockRequest.data['result'])
		}

		throw new Error('Failed to get block number')
	} catch (e) {
		const blockInADay = (24 * 60 * 60) / 0.3
		const blockIn90Days = blockInADay * 90
		const lastBlock = await provider.getBlockNumber()
		return lastBlock - blockIn90Days
	}
}
