import axios from 'axios'
import { APIKey, PREMIA_API_URL } from '../config'
import _ from 'lodash'
import { Market, OptionsTableData, ReturnedOrderbookQuote } from '../types'
import moment from 'moment'
import { getStrikes } from './apiGetters'

export async function getOrderbookState() {
	const ordersResponse = await axios.get(PREMIA_API_URL + '/orderbook/orders', {
		withCredentials: false,
		headers: {
			'x-apikey': APIKey,
		},
	})

	const orders: ReturnedOrderbookQuote[] = ordersResponse.data
	return orders
}

export async function getOwnOrders() {
	const ordersResponse = await axios.get(PREMIA_API_URL + '/account/orders', {
		withCredentials: false,
		headers: {
			'x-apikey': APIKey,
		},
	})

	const orders: ReturnedOrderbookQuote[] = ordersResponse.data
	return orders
}

export async function prepareOrders(
	market: Market,
	spot: number,
	orders: ReturnedOrderbookQuote[],
): Promise<OptionsTableData[]> {
	const strikes = await getStrikes(spot)
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
