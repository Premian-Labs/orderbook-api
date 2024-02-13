import { PREMIA_WS_URL } from '../config'

export async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function connectWS(): Promise<WebSocket> {
	return new Promise(function (resolve, reject) {
		const wsConnection = new WebSocket(PREMIA_WS_URL)
		wsConnection.onopen = function () {
			resolve(wsConnection)
		}
		wsConnection.onerror = function (err) {
			reject(err)
		}
	})
}
