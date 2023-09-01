import axios from 'axios';
import dotenv from 'dotenv';
import { PublishQuoteProxyRequest } from '../types/quote';
import { arbOrderbookUrl, arbGoerliOrderbookUrl } from '../config/constants';

dotenv.config();

const orderbook_url =
	process.env.ENV == 'production' ? arbOrderbookUrl : arbGoerliOrderbookUrl;
// undefined is checked in index
const api_key =
	process.env.ENV == 'production'
		? process.env.MAINNET_ORDERBOOK_API_KEY
		: process.env.TESTNET_ORDERBOOK_API_KEY;

//TODO: do we want to do error handling in here? (see getRequest function in SDK)

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
					'x-apikey': api_key,
				},
				validateStatus: function (status) {
					return status < 500;
				},
			});
		}
		case 'GET': {
			return await axios.get(`${orderbook_url}/${path}`, {
				params: params,
				headers: {
					'x-apikey': api_key,
				},
				validateStatus: function (status) {
					return status < 500;
				},
			});
		}
		default:
			throw new Error(`HTTP method ${method} is not allowed`);
	}
}
