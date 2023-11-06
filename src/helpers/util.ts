import { Option } from '../types/validate'
import { difference, zipWith } from 'lodash'

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
