import React, { useEffect, useMemo } from 'react'
import logo from './logo.svg'
import './Main.css'
import { Column, useTable } from 'react-table'
import { getOrderbookState, prepareOrders } from './utils/getOrderbookState'
import { CoinPrice, Market, OptionsTableData, OrderbookRows } from './types'
import { getCoinsPrice } from './Navbar'
import { ReturnedOrderbookQuote } from '../../src/types/quote'
import _ from 'lodash'

const COLUMNS = [
	{
		Header: 'Bid',
		accessor: 'call_bid' as const,
	},
	{
		Header: 'Ask',
		accessor: 'call_ask' as const,
	},
	{
		Header: 'IV',
		accessor: 'call_iv' as const,
	},
	{
		Header: 'Delta',
		accessor: 'call_delta' as const,
	},
	{
		Header: 'Size',
		accessor: 'call_size' as const,
	},
	{
		Header: 'Position',
		accessor: 'call_position' as const,
	},
	{
		Header: 'Strike',
		accessor: 'strike' as const,
	},
	{
		Header: 'Bid',
		accessor: 'put_bid' as const,
	},
	{
		Header: 'Ask',
		accessor: 'put_ask' as const,
	},
	{
		Header: 'IV',
		accessor: 'put_iv' as const,
	},
	{
		Header: 'Delta',
		accessor: 'put_delta' as const,
	},
	{
		Header: 'Size',
		accessor: 'put_size' as const,
	},
	{
		Header: 'Position',
		accessor: 'put_position' as const,
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
		const activeExpirationOrders = orders.find((order) => order.expiration === activeExpiration)
		if (activeExpirationOrders) {
			setActiveExpirationOrders(activeExpirationOrders.positions)
			const quotesRow = activeExpirationOrders.positions.map(({ strike, quotes }) => {
				const [calls, puts] = _.partition(quotes, (quote) => quote.type === 'C')
				const obRow = {
					call_bid: '-',
					call_ask: '-',
					call_iv: '-',
					call_delta: '-',
					call_size: '-',
					call_position: '-',
					strike: strike,
					put_bid: '-',
					put_ask: '-',
					put_iv: '-',
					put_delta: '-',
					put_size: '-',
					put_position: '-',
				} as OrderbookRows

				// TODO: positions
				for (const callPostition of calls) {
					obRow.call_size = _.chain(calls)
						.map((quote) => quote.remainingSize)
						.sum()
						.value()
					// obRow.call_delta = 0
					// obRow.call_iv = 0
					if (callPostition.side === 'bid')
						obRow.call_bid = _.chain(calls)
							.map((quote) => quote.price)
							.max()
							.value()
					if (callPostition.side === 'ask')
						obRow.call_ask = _.chain(calls)
							.map((quote) => quote.price)
							.min()
							.value()
				}

				for (const putPostition of puts) {
					obRow.put_size = _.chain(puts)
						.map((quote) => quote.remainingSize)
						.sum()
						.value()
					// obRow.put_delta = 0
					// obRow.put_iv = 0
					if (putPostition.side === 'bid')
						obRow.put_bid = _.chain(puts)
							.map((quote) => quote.price * quote.strike)
							.max()
							.value()
					if (putPostition.side === 'ask')
						obRow.put_ask = _.chain(puts)
							.map((quote) => quote.price)
							.min()
							.value()
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
