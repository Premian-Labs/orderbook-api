import React, { useEffect, useMemo } from 'react'
import logo from './logo.svg'
import './Main.css'
import { Column, useTable } from 'react-table'
import { getOrderbookState, prepareOrders } from './utils/getOrderbookState'
import { CoinPrice, Market, OptionsTableData, OrderbookRows } from './types'
import { getCoinsPrice } from './Navbar'
import { ReturnedOrderbookQuote } from '../../src/types/quote'
import _ from 'lodash'
import { getDeltaAndIV } from './utils/blackScholes'

// call_delta: number | '-'
// call_bid_size: number | '-'
// call_bid_iv: number | '-' | string
// call_bid: number | '-' | string
// call_mark: number | '-' | string
// call_ask: number | '-' | string
// call_ask_iv: number | '-' | string
// call_ask_size: number | '-'
// call_positions: number | '-'
// strike: number
// put_delta: number | '-'
// put_bid_size: number | '-'
// put_bid_iv: number | '-' | string
// put_bid: number | '-' | string
// put_mark: number | '-' | string
// put_ask: number | '-' | string
// put_ask_iv: number | '-' | string
// put_ask_size: number | '-'
// put_positions: number | '-'

const COLUMNS = [
	{
		Header: 'Delta',
		accessor: 'call_delta' as const,
	},
	{
		Header: 'Bid Size',
		accessor: 'call_bid_size' as const,
	},
	{
		Header: 'Bid IV',
		accessor: 'call_bid_iv' as const,
	},
	{
		Header: 'Bid',
		accessor: 'call_bid' as const,
	},
	{
		Header: 'Mark',
		accessor: 'call_mark' as const,
	},
	{
		Header: 'Ask',
		accessor: 'call_ask' as const,
	},
	{
		Header: 'Ask IV',
		accessor: 'call_ask_iv' as const,
	},
	{
		Header: 'Ask Size',
		accessor: 'call_ask_size' as const,
	},
	{
		Header: 'Positions',
		accessor: 'call_positions' as const,
	},
	{
		Header: 'Strike',
		accessor: 'strike' as const,
	},
	{
		Header: 'Bid Size',
		accessor: 'put_bid_size' as const,
	},
	{
		Header: 'Bid IV',
		accessor: 'put_bid_iv' as const,
	},
	{
		Header: 'Bid',
		accessor: 'put_bid' as const,
	},
	{
		Header: 'Mark',
		accessor: 'put_mark' as const,
	},
	{
		Header: 'Ask',
		accessor: 'put_ask' as const,
	},
	{
		Header: 'Ask IV',
		accessor: 'put_ask_iv' as const,
	},
	{
		Header: 'Ask Size',
		accessor: 'put_ask_size' as const,
	},
	{
		Header: 'Positions',
		accessor: 'put_positions' as const,
	},
]

function Main() {
	const [coinPrice, setCoinPrice] = React.useState({
		WBTC: 43000,
		WETH: 2200,
		ARB: 1.9,
	} as CoinPrice)
	const [orders, setOrders] = React.useState([] as OptionsTableData[])
	const [expirations, setExpirations] = React.useState([] as string[])
	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)
	const [activeExpiration, setActiveExpiration] = React.useState('NONE')
	const [activeExpirationOrders, setActiveExpirationOrders] = React.useState(
		[] as { quotes: ReturnedOrderbookQuote[]; strike: number }[],
	)
	const [quotesRows, setQuotesRows] = React.useState([] as OrderbookRows[])

	const columns = useMemo<Column<OrderbookRows>[]>(() => COLUMNS, [])
	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({ columns, data: quotesRows })

	useEffect(() => {
		getCoinsPrice()
			.then((coins) => setCoinPrice(coins))
			.catch(console.error)

		getOrderbookState('ALL')
			.then((orders) => {
				const groupedOrders = prepareOrders(marketSelector, coinPrice[marketSelector], orders)
				setOrders(groupedOrders)

				const expirations = groupedOrders.map((order) => order.expiration)
				setExpirations(expirations)
				if (activeExpiration === 'NONE') setActiveExpiration(expirations[0])
			})
			.catch(console.error)
	}, [marketSelector])

	useEffect(() => {

	}, [])

	useEffect(() => {
		const activeExpirationOrders = orders.find((order) => order.expiration === activeExpiration)
		if (activeExpirationOrders) {
			setActiveExpirationOrders(activeExpirationOrders.positions)
			const quotesRow = activeExpirationOrders.positions.map(({ strike, quotes }) => {
				const [calls, puts] = _.partition(quotes, (quote) => quote.type === 'C')
				const obRow = {
					call_delta: '-',
					call_bid_size: '-',
					call_bid_iv: '-',
					call_bid: '-',
					call_mark: '-',
					call_ask: '-',
					call_ask_iv: '-',
					call_ask_size: '-',
					call_positions: '-',
					strike: strike,
					put_delta: '-',
					put_bid_size: '-',
					put_bid_iv: '-',
					put_bid: '-',
					put_mark: '-',
					put_ask: '-',
					put_ask_iv: '-',
					put_ask_size: '-',
					put_positions: '-',
				} as OrderbookRows

				for (const callPostition of calls) {
					if (callPostition.side === 'bid') {
						obRow.call_bid_size = _.chain(calls)
							.map((quote) => quote.remainingSize)
							.sum()
							.value()

						obRow.call_bid = _.chain(calls)
							.map((quote) => quote.price * coinPrice[marketSelector])
							.max()
							.value()

						obRow.call_bid_iv = getDeltaAndIV(callPostition, obRow.call_bid, coinPrice[marketSelector])
						if (obRow.call_bid_iv > 0) obRow.call_bid_iv = obRow.call_bid_iv.toFixed(1)
						obRow.call_bid = obRow.call_bid.toFixed(4)
					}

					if (callPostition.side === 'ask') {
						obRow.call_ask_size = _.chain(calls)
							.map((quote) => quote.remainingSize)
							.sum()
							.value()

						obRow.call_ask = _.chain(calls)
							.map((quote) => quote.price * coinPrice[marketSelector])
							.max()
							.value()

						obRow.call_ask_iv = getDeltaAndIV(callPostition, obRow.call_ask, coinPrice[marketSelector])
						if (obRow.call_ask_iv > 0) obRow.call_ask_iv = obRow.call_ask_iv.toFixed(1)
						obRow.call_ask = obRow.call_ask.toFixed(4)
					}
				}

				for (const putPostition of puts) {
					if (putPostition.side === 'bid') {
						obRow.put_bid_size = _.chain(puts)
							.map((quote) => quote.remainingSize)
							.sum()
							.value()

						obRow.put_bid = _.chain(puts)
							.map((quote) => quote.price * strike)
							.max()
							.value()

						obRow.put_bid_iv = getDeltaAndIV(putPostition, obRow.put_bid, coinPrice[marketSelector])
						if (obRow.put_bid_iv > 0) obRow.put_bid_iv = obRow.put_bid_iv.toFixed(1)
						obRow.put_bid = obRow.put_bid.toFixed(4)
					}

					if (putPostition.side === 'ask') {
						obRow.put_ask_size = _.chain(puts)
							.map((quote) => quote.remainingSize)
							.sum()
							.value()

						obRow.put_ask = _.chain(puts)
							.map((quote) => quote.price * strike)
							.max()
							.value()

						obRow.put_ask_iv = getDeltaAndIV(putPostition, obRow.put_ask, coinPrice[marketSelector])
						if (obRow.put_ask_iv > 0) obRow.put_ask_iv = obRow.put_ask_iv.toFixed(1)
						obRow.put_ask = obRow.put_ask.toFixed(4)
					}
				}

				return obRow
			})
			setQuotesRows(quotesRow)
		}
	}, [orders, activeExpiration])

	return (
		<div className="app">
			<div className="app-container">
				<img hidden={orders.length > 0} src={logo} className="app-logo" alt="logo" />
				<p hidden={orders.length > 0}>Loading orderbook state...</p>
				<div hidden={orders.length === 0} className="selector">
					<button
						className={marketSelector === 'WETH' ? 'selector-btn-active' : 'selector-btn'}
						onClick={() => setMarketSelector('WETH')}
					>
						ETH
					</button>
					<button
						className={marketSelector === 'WBTC' ? 'selector-btn-active' : 'selector-btn'}
						onClick={() => setMarketSelector('WBTC')}
					>
						BTC
					</button>
				</div>
				<div style={{ display: orders.length > 0 ? 'block' : 'none' }} className="positions-container">
					<div className="expirations-container">
						{expirations.map((expiration) => {
							return (
								<button
									onClick={() => setActiveExpiration(expiration)}
									className={activeExpiration === expiration ? 'selector-btn-active' : 'selector-btn'}
									key={expiration}
								>
									{expiration}
								</button>
							)
						})}
					</div>
					<div className="table-container">
						<table style={{ display: activeExpirationOrders.length > 0 ? 'table' : 'none' }} {...getTableProps()}>
							<thead>
								{/*<tr>*/}
								{/*	<th>CALLS</th>*/}
								{/*	<th>PUTS</th>*/}
								{/*</tr>*/}
								{headerGroups.map((headerGroup) => (
									<tr {...headerGroup.getHeaderGroupProps()}>
										{headerGroup.headers.map((column) => (
											<th {...column.getHeaderProps()}>{column.render('Header')}</th>
										))}
									</tr>
								))}
							</thead>
							<tbody {...getTableBodyProps()}>
								{rows.map((row) => {
									prepareRow(row)
									return (
										<tr {...row.getRowProps()}>
											{row.cells.map((cell) => {
												return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
											})}
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Main
