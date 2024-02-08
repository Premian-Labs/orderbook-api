import axios from 'axios'
import {PREMIA_API_URL, WALLET_ADDRESS} from '../config'
import { ReturnedOrderbookQuote } from '../../../src/types/quote'
import _ from 'lodash'
import { Market } from '../types'
import { getSurroundingStrikes } from './strikes'
import moment from 'moment'

const APIKey = process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY!

export async function getOrderbookState(show: 'ALL' | 'OWN') {
	const ordersResponse = await axios.get(PREMIA_API_URL + '/orderbook/orders', {
		withCredentials: false,
		params: {
			...(show === 'OWN' && {
				provider: WALLET_ADDRESS.toLowerCase(),
			}),
		},
		headers: {
			'x-apikey': APIKey,
		},
	})

	const orders: ReturnedOrderbookQuote[] = ordersResponse.data
	return orders
}

export function prepareOrders(market: Market, spot: number, orders: ReturnedOrderbookQuote[]) {
	const strikes = getSurroundingStrikes(spot)
	const ordersPerMarket = orders.filter((order) => order.base === market)
	const groupedByExpiration = _.chain(ordersPerMarket)
		.groupBy('expiration')
		.toPairs()
		.map(([key, value]) => ({ [key]: value }))
		.value()

	const expirationGroups = []
	for (const groupByExpiration of groupedByExpiration) {
		const tableReady = []
		for (const strike of strikes) {
			const quotesToStrike = _.chain(groupByExpiration)
				.values()
				.flatten()
				.filter((quote) => quote.strike === strike)
				.value()
			if (quotesToStrike.length > 0)
				tableReady.push({
					quotes: quotesToStrike,
					strike: strike,
				})
		}
		expirationGroups.push({
			expiration: _.keys(groupByExpiration)[0],
			positions: tableReady,
		})
	}

	return _.sortBy(expirationGroups, ({ expiration }) => moment(expiration, 'DDMMMYY').unix())
}
