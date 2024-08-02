import { difference, zipWith } from 'lodash'
import axios from 'axios'

import { Option } from '../types/validate'
import { blockByTsEndpoint, provider } from '../config/constants'

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
		await delay(1000)
		return getBlockByTimestamp(ts)
	}
}
