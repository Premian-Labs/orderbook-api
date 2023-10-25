import axios from 'axios'
import dotenv from 'dotenv'
import { PublishQuoteProxyRequest } from '../types/quote'
import { orderbook_url, apiKey } from '../config/constants'

dotenv.config()

export async function proxyHTTPRequest(
	path: string,
	method: 'GET' | 'POST',
	params?: any,
	body?: PublishQuoteProxyRequest[] | null
) {
	switch (method) {
		case 'POST': {
			return await axios.post(`${orderbook_url}/${path}`, [body], {
				headers: {
					'x-apikey': apiKey,
				},
				validateStatus: function (status) {
					return status < 500
				},
			})
		}
		case 'GET': {
			return await axios.get(`${orderbook_url}/${path}`, {
				params: params,
				headers: {
					'x-apikey': apiKey,
				},
				validateStatus: function (status) {
					return status < 500
				},
			})
		}
		default:
			throw new Error(`HTTP method ${method} is not allowed`)
	}
}
