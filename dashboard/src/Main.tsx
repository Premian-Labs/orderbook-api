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
import { getIVOracle } from './utils/apiGetters'
import { Tooltip } from 'react-tooltip'
import { WALLET_ADDRESS } from './config'

const COLUMNS = [
	// {
	// 	Header: 'Delta',
	// 	accessor: 'call_delta' as const,
	// },
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
		Header: 'Oracle',
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
		Header: 'Oracle',
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

function getColumnClass(id: string) {
	switch (id) {
		case 'strike':
			return 'strike-col'
		case 'call_bid':
		case 'put_bid':
			return 'bid-col'
		case 'call_ask':
		case 'put_ask':
			return 'ask-col'
		default:
			return ''
	}
}

function getTooltipId(columnId: string) {
	switch (columnId) {
		case 'call_bid':
		case 'put_bid':
			return 'bid'
		case 'call_ask':
		case 'put_ask':
			return 'ask'
		case 'call_bid_iv':
		case 'call_ask_iv':
		case 'put_bid_iv':
		case 'put_ask_iv':
			return 'iv'
		case 'call_positions':
		case 'put_positions':
			return 'positions'
		case 'call_mark':
		case 'put_mark':
			return 'mark'
		default:
			return ''
	}
}

function Main() {
	const [coinPrice, setCoinPrice] = React.useState({
		WBTC: 43000,
		WETH: 2200,
		ARB: 1.9,
	} as CoinPrice)
	const [rawOrders, setRawOrders] = React.useState([] as ReturnedOrderbookQuote[])
	const [orders, setOrders] = React.useState([] as OptionsTableData[])
	const [expirations, setExpirations] = React.useState([] as string[])
	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)
	const [activeExpiration, setActiveExpiration] = React.useState('')
	const [activeExpirationOrders, setActiveExpirationOrders] = React.useState(
		[] as { quotes: ReturnedOrderbookQuote[]; strike: number }[],
	)
	const [quotesRows, setQuotesRows] = React.useState([] as OrderbookRows[])
	const [ivData, setIvData] = React.useState([] as { iv: number; quoteIds: string[] }[][])

	const columns = useMemo<Column<OrderbookRows>[]>(() => COLUMNS, [])
	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({ columns, data: quotesRows })

	useEffect(() => {
		getCoinsPrice()
			.then((coins) => setCoinPrice(coins))
			.catch(console.error)

		getOrderbookState().then(setRawOrders).catch(console.error)
	}, [])

	useEffect(() => {
		const groupedOrders = prepareOrders(marketSelector, coinPrice[marketSelector], rawOrders)
		setOrders(groupedOrders)

		const expirations = groupedOrders.map((order) => order.expiration)
		setExpirations(expirations)
		if (!activeExpiration) setActiveExpiration(expirations[0])
		console.log('hehe?', activeExpiration)
	}, [rawOrders, marketSelector, coinPrice])

	// useEffect(() => {
	// 	Promise.all(
	// 		orders.map(async (order) => {
	// 			const IVPerStrike = []
	// 			for (const position of order.positions) {
	// 				const iv: number = await getIVOracle(
	// 					marketSelector,
	// 					coinPrice[marketSelector],
	// 					position.strike,
	// 					order.expiration,
	// 				)
	// 				IVPerStrike.push({
	// 					iv: iv,
	// 					quoteIds: position.quotes.map((quote) => quote.quoteId),
	// 				})
	// 			}
	// 			return IVPerStrike
	// 		}),
	// 	).then((ivData) => {
	// 		setIvData(ivData)
	// 	})
	// }, [orders])

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
					obRow.call_positions = _.chain(calls)
						.filter((quote) => quote.provider === WALLET_ADDRESS)
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()

					if (callPostition.side === 'bid') {
						obRow.call_bid_size = _.chain(calls)
							.filter((quote) => quote.side === 'bid')
							.map((quote) => quote.remainingSize)
							.sum()
							.round(4)
							.value()

						obRow.call_bid = _.chain(calls)
							.filter((quote) => quote.side === 'bid')
							.map((quote) => quote.price * coinPrice[marketSelector])
							.max()
							.value()

						obRow.call_bid_iv = getDeltaAndIV(callPostition, obRow.call_bid, coinPrice[marketSelector])
						obRow.call_bid_iv = obRow.call_bid_iv.toFixed(1)
						obRow.call_bid = Math.round(obRow.call_bid * 100) / 100
					}

					if (callPostition.side === 'ask') {
						obRow.call_ask_size = _.chain(calls)
							.filter((quote) => quote.side === 'ask')
							.map((quote) => quote.remainingSize)
							.sum()
							.round(4)
							.value()

						obRow.call_ask = _.chain(calls)
							.filter((quote) => quote.side === 'ask')
							.map((quote) => quote.price * coinPrice[marketSelector])
							.min()
							.value()

						obRow.call_ask_iv = getDeltaAndIV(callPostition, obRow.call_ask, coinPrice[marketSelector])
						obRow.call_ask_iv = obRow.call_ask_iv.toFixed(1)
						obRow.call_ask = Math.round(obRow.call_ask * 100) / 100
					}
				}

				for (const putPostition of puts) {
					obRow.put_positions = _.chain(puts)
						.filter((quote) => quote.provider === WALLET_ADDRESS)
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()

					if (putPostition.side === 'bid') {
						obRow.put_bid_size = _.chain(puts)
							.filter((quote) => quote.side === 'bid')
							.map((quote) => quote.remainingSize)
							.sum()
							.round(4)
							.value()

						obRow.put_bid = _.chain(puts)
							.filter((quote) => quote.side === 'bid')
							.map((quote) => quote.price * strike)
							.max()
							.value()

						obRow.put_bid_iv = getDeltaAndIV(putPostition, obRow.put_bid, coinPrice[marketSelector])
						obRow.put_bid_iv = obRow.put_bid_iv.toFixed(1)
						obRow.put_bid = Math.round(obRow.put_bid * 100) / 100
					}

					if (putPostition.side === 'ask') {
						obRow.put_ask_size = _.chain(puts)
							.filter((quote) => quote.side === 'ask')
							.map((quote) => quote.remainingSize)
							.sum()
							.round(4)
							.value()

						obRow.put_ask = _.chain(puts)
							.filter((quote) => quote.side === 'ask')
							.map((quote) => quote.price * strike)
							.min()
							.value()

						obRow.put_ask_iv = getDeltaAndIV(putPostition, obRow.put_ask, coinPrice[marketSelector])
						obRow.put_ask_iv = obRow.put_ask_iv.toFixed(1)
						obRow.put_ask = Math.round(obRow.put_ask * 100) / 100
					}
				}

				return obRow
			})
			setQuotesRows(quotesRow)
		}
	}, [activeExpiration, coinPrice, marketSelector, orders])

	return (
		<div className="app">
			<Tooltip id="bid" place="bottom">
				Best bid price
			</Tooltip>
			<Tooltip id="ask" place="bottom">
				Best ask price
			</Tooltip>
			<Tooltip id="iv" place="bottom">
				IV based on best bid / best ask. <br />
				Deep ITM option IV is default to 0%.
			</Tooltip>
			<Tooltip id="positions" place="bottom">
				Total sum for your contracts.
			</Tooltip>
			<Tooltip id="mark" place="bottom">
				Approx. theoretical price based on IV Oracle index.
			</Tooltip>
			<div className="app-container">
				<img hidden={orders.length > 0} src={logo} className="app-logo" alt="logo" />
				<p hidden={orders.length > 0}>Loading orderbook state...</p>
				<div className="selector">
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
								<tr>
									<th colSpan={8}>CALLS</th>
									<th />
									<th colSpan={8}>PUTS</th>
								</tr>
								{headerGroups.map((headerGroup) => (
									<tr {...headerGroup.getHeaderGroupProps()}>
										{headerGroup.headers.map((column) => (
											<th data-tooltip-id={getTooltipId(column.id)} {...column.getHeaderProps()}>
												{column.render('Header')}
											</th>
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
												return (
													<td className={getColumnClass(cell.column.id)} {...cell.getCellProps()}>
														{cell.render('Cell')}
													</td>
												)
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
