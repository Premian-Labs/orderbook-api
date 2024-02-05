import axios from 'axios'
import { PREMIA_API_URL } from '../config'
import { ReturnedOrderbookQuote } from '../../../src/types/quote'
import _ from 'lodash'
import moment from 'moment'
import {Market} from "../types";

const providerAddress = process.env.REACT_APP_WALLET_ADDRESS!
const APIKey = process.env.REACT_APP_TESTNET_ORDERBOOK_API_KEY!

if (!providerAddress || !APIKey) {
	throw Error('.env: secrets not set!')
}

export async function getOrderbookState(show: 'ALL' | 'OWN') {
	const ordersResponse = await axios.get(PREMIA_API_URL + '/orderbook/orders', {
		withCredentials: false,
		params: {
			...(show === 'OWN' && {
				provider: providerAddress.toLowerCase(),
			}),
		},
		headers: {
			'x-apikey': APIKey,
		},
	})

	const orders: ReturnedOrderbookQuote[] = ordersResponse.data
	return orders
}

export function groupOrders(
	market: Market,
	orders: ReturnedOrderbookQuote[],
): [[string, ReturnedOrderbookQuote[]][], [string, ReturnedOrderbookQuote[]][]] {
	const ordersPerMarket = orders.filter((order) => order.base === market)

	const [callOrders, putOrders] = _.partition(ordersPerMarket, (order) => order.type === 'C')

	const groupedCalls = _.chain(callOrders)
		.groupBy('expiration')
		.toPairs()
		.sortBy(([expiration, quote]) => moment(expiration, 'DDMMMYY').unix())

		.value()

	const groupedPuts = _.chain(putOrders)
		.map((quote) => ({ ...quote, price: quote.price * quote.strike }) as ReturnedOrderbookQuote)
		.groupBy('expiration')
		.toPairs()
		.sortBy(([expiration, quote]) => moment(expiration, 'DDMMMYY').unix())
		.value()

	return [groupedCalls, groupedPuts]
}
