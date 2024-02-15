import React, { useEffect, useMemo } from 'react'
import logo from './logo.svg'
import './Main.css'
import { Column, useTable } from 'react-table'
import { getOrderbookState, prepareOrders } from './utils/getOrderbookState'
import {
	IVResponseExtended,
	Market,
	OpenPosition,
	OptionsTableData,
	OrderbookRows,
	SpotPrice,
	ReturnedOrderbookQuote,
	WSMsg,
	AuthMessage,
	FilterMessage,
} from './types'
import _ from 'lodash'
import { blackScholes, getDeltaAndIV, ONE_YEAR_SEC } from './utils/blackScholes'
import { getIVOracle, getOptionBalance, getSpotPrice } from './utils/apiGetters'
import { Tooltip } from 'react-tooltip'
import moment from 'moment/moment'
import { connectWS, delay } from './utils/ws'
import { APIKey, chainId } from './config'

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
	const [spotPrice, setSpotPrice] = React.useState({
		WBTC: 43000,
		WETH: 2200,
		ARB: 1.9,
	} as SpotPrice)
	const [rawOrders, setRawOrders] = React.useState([] as ReturnedOrderbookQuote[])
	const [orders, setOrders] = React.useState([] as OptionsTableData[])
	const [expirations, setExpirations] = React.useState([] as string[])
	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)
	const [activeExpiration, setActiveExpiration] = React.useState('')
	const [activeExpirationOrders, setActiveExpirationOrders] = React.useState([] as OptionsTableData['positions'])
	const [quotesRows, setQuotesRows] = React.useState([] as OrderbookRows[])
	const [openPositions, setOpenPositions] = React.useState([] as OpenPosition[])
	const [ivData, setIvData] = React.useState({} as IVResponseExtended)

	const columns = useMemo<Column<OrderbookRows>[]>(() => COLUMNS, [])
	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({ columns, data: quotesRows })
	const getData = () => {
		console.log('fetching orderbook data...')

		getSpotPrice().then(setSpotPrice).catch(console.error)
		getOrderbookState().then(setRawOrders).catch(console.error)
		getOptionBalance()
			.then((positions) => {
				return positions.map((option) => {
					// WBTC-USDC-09FEB2024-44000-P
					const [base, quote, expiration, strike, type] = option.name.split('-')
					return {
						base,
						quote,
						expiration: moment(expiration).format('DDMMMYY').toUpperCase(),
						type,
						strike: Number(strike),
						amount: option.amount,
					}
				})
			})
			.then(setOpenPositions)
			.catch(console.error)
	}

	useEffect(() => {
		let wsLink: WebSocket | undefined = undefined

		connectWS()
			.then(async (ws) => {
				wsLink = ws
				const authMsg: AuthMessage = {
					type: 'AUTH',
					apiKey: APIKey,
					body: null,
				}

				const wsCallback = (message: MessageEvent<string>) => {
					const msg = JSON.parse(message.data) as WSMsg
					switch (msg.type) {
						case 'INFO': {
							console.log('INFO WS MSG', msg.message)
							break
						}
						case 'ERROR': {
							console.error('ERROR WS MSG', msg.message)
							break
						}
						case 'FILL_QUOTE': {
							if (msg.body.remainingSize === 0) {
								setRawOrders((rawData) => rawData.filter((order) => order.quoteId !== msg.body.quoteId))
							} else {
								setRawOrders((rawData) => {
									const ex = rawData.filter((order) => order.quoteId !== msg.body.quoteId)
									return [...ex, msg.body]
								})
							}
							break
						}
						case 'POST_QUOTE': {
							setRawOrders((rawData) => [...rawData, msg.body])
							break
						}
						case 'DELETE_QUOTE': {
							setRawOrders((rawData) => rawData.filter((order) => order.quoteId !== msg.body.quoteId))
							break
						}
						default: {
							console.error(msg)
						}
					}
				}
				await delay(2000)
				ws.onmessage = wsCallback
				ws.send(JSON.stringify(authMsg))
				await delay(2000)

				const webSocketFilter: FilterMessage = {
					type: 'FILTER',
					channel: 'QUOTES',
					body: {
						chainId: chainId,
					},
				}
				ws.send(JSON.stringify(webSocketFilter))
			})
			.catch(console.error)

		return () => (wsLink ? wsLink.close() : void 0)
	}, [])

	useEffect(() => {
		getData()
		const interval = setInterval(() => {
			getData()
		}, 10 * 1000)

		return () => clearTimeout(interval)
	}, [])

	useEffect(() => {
		const groupedOrders = prepareOrders(marketSelector, spotPrice[marketSelector], rawOrders)
		setOrders(groupedOrders)

		const expirations = groupedOrders.map((order) => order.expiration)
		setExpirations(expirations)
		if (!activeExpiration) setActiveExpiration(expirations[0])
	}, [rawOrders, marketSelector, spotPrice])

	useEffect(() => {
		if (activeExpiration)
			getIVOracle(marketSelector, activeExpiration)
				.then((ivs) => ({
					expiration: activeExpiration,
					market: marketSelector,
					ivs: ivs,
				}))
				.then(setIvData)
				.catch(console.error)
	}, [marketSelector, activeExpiration])

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

				if (!_.isEmpty(ivData)) {
					const ivDataExpirationStrike = ivData.ivs.find((iv) => iv.strike === strike)
					if (ivDataExpirationStrike) {
						obRow.call_mark = blackScholes(
							ivDataExpirationStrike.iv,
							spotPrice[marketSelector],
							(moment.utc(activeExpiration, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC,
							strike,
							'call',
						).price.toFixed(2)

						obRow.put_mark = blackScholes(
							ivDataExpirationStrike.iv,
							spotPrice[marketSelector],
							(moment.utc(activeExpiration, 'DDMMMYY').unix() - moment.utc().unix()) / ONE_YEAR_SEC,
							strike,
							'put',
						).price.toFixed(2)
					}
				}

				if (calls.length > 0) {
					const openPositionsCalls = openPositions.filter((option) => {
						return (
							option.expiration === activeExpirationOrders.expiration &&
							option.strike === strike &&
							option.base === marketSelector &&
							option.type === 'C'
						)
					})

					obRow.call_positions = _.chain(openPositionsCalls)
						.map((quote) => quote.amount)
						.sum()
						.round(4)
						.value()

					const bestCallBid = _.chain(calls)
						.filter((quote) => quote.side === 'bid')
						.map((quote) => ({
							...quote,
							price: quote.price * spotPrice[marketSelector],
						}))
						.maxBy('price')
						.value()

					if (bestCallBid) {
						obRow.call_bid = bestCallBid.price
						obRow.call_bid_iv = getDeltaAndIV(bestCallBid, obRow.call_bid, spotPrice[marketSelector])
						obRow.call_bid_iv = obRow.call_bid_iv.toFixed(1)
						obRow.call_bid = Math.round(obRow.call_bid * 100) / 100
					}

					obRow.call_bid_size = _.chain(calls)
						.filter((quote) => quote.side === 'bid')
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()

					const bestCallAsk = _.chain(calls)
						.filter((quote) => quote.side === 'ask')
						.map((quote) => ({
							...quote,
							price: quote.price * spotPrice[marketSelector],
						}))
						.minBy('price')
						.value()

					if (bestCallAsk) {
						obRow.call_ask = bestCallAsk.price
						obRow.call_ask_iv = getDeltaAndIV(bestCallAsk, obRow.call_ask, spotPrice[marketSelector])
						obRow.call_ask_iv = obRow.call_ask_iv.toFixed(1)
						obRow.call_ask = Math.round(obRow.call_ask * 100) / 100
					}

					obRow.call_ask_size = _.chain(calls)
						.filter((quote) => quote.side === 'ask')
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()
				}

				if (puts.length > 0) {
					const openPositionsPuts = openPositions.filter((option) => {
						return (
							option.expiration === activeExpirationOrders.expiration &&
							option.strike === strike &&
							option.base === marketSelector &&
							option.type === 'P'
						)
					})

					obRow.put_positions = _.chain(openPositionsPuts)
						.map((quote) => quote.amount)
						.sum()
						.round(4)
						.value()

					obRow.put_bid_size = _.chain(puts)
						.filter((quote) => quote.side === 'bid')
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()

					const bestPutBid = _.chain(puts)
						.filter((quote) => quote.side === 'bid')
						.map((quote) => ({
							...quote,
							price: quote.price * strike,
						}))
						.maxBy('price')
						.value()

					if (bestPutBid) {
						obRow.put_bid = bestPutBid.price
						obRow.put_bid_iv = getDeltaAndIV(bestPutBid, obRow.put_bid, spotPrice[marketSelector])
						obRow.put_bid_iv = obRow.put_bid_iv.toFixed(1)
						obRow.put_bid = Math.round(obRow.put_bid * 100) / 100
					}

					obRow.put_ask_size = _.chain(puts)
						.filter((quote) => quote.side === 'ask')
						.map((quote) => quote.remainingSize)
						.sum()
						.round(4)
						.value()

					const bestPutAsk = _.chain(puts)
						.filter((quote) => quote.side === 'ask')
						.map((quote) => ({
							...quote,
							price: quote.price * strike,
						}))
						.minBy('price')
						.value()

					if (bestPutAsk) {
						obRow.put_ask = bestPutAsk.price
						obRow.put_ask_iv = getDeltaAndIV(bestPutAsk, obRow.put_ask, spotPrice[marketSelector])
						obRow.put_ask_iv = obRow.put_ask_iv.toFixed(1)
						obRow.put_ask = Math.round(obRow.put_ask * 100) / 100
					}
				}

				return obRow
			})
			setQuotesRows(quotesRow)
		}
	}, [activeExpiration, spotPrice, marketSelector, orders, ivData])

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
				Deep ITM / near-dated option IV is default to 0%.
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
