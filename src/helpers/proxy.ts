import axios from 'axios';
import dotenv from 'dotenv';
import {PublishQuoteProxyRequest} from './types';
import orderbookUrl from '../config/constants.json';

dotenv.config();

const orderbook_url = process.env.ENV == 'production'? orderbookUrl.ArbOrderbookUrl : orderbookUrl.ArbGoerliOrderbookUrl
// undefined is checked in index
const api_key = process.env.ENV == 'production'?  process.env.MAINNET_ORDERBOOK_API_KEY : process.env.TESTNET_ORDERBOOK_API_KEY


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
