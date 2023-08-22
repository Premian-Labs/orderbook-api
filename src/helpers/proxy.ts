import axios from 'axios';
import { AJVQuote } from './types';

const BASE_URL = process.env.BASE_URL!;
export async function proxyHTTPRequest(
	path: string,
	method: 'GET' | 'POST',
	params?: any,
	body?: AJVQuote[] | null
) {
	switch (method) {
		case 'POST': {
			return await axios.post(`${BASE_URL}/${path}`, [body], {
				headers: {
					'x-apikey': process.env.API_KEY,
				},
				validateStatus: function (status) {
					return status < 500;
				},
			});
		}
		case 'GET': {
			return await axios.get(`${BASE_URL}/${path}`, {
				params: params,
				headers: {
					'x-apikey': process.env.API_KEY,
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
