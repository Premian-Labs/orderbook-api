import React, { useEffect, useMemo } from 'react'
import './styles/Main.css'
import './styles/Account.css'
import { getCollateralBalance, getNativeBalance, getSpotPrice } from './utils/apiGetters'
import { APIKey, chainId, WALLET_ADDRESS } from './config'
import { getOwnOrders, prepareOrders } from './utils/getOrderbookState'
import { Column, useSortBy, useTable } from 'react-table'
import {
	TokenBalance,
	ReturnedOrderbookQuote,
	SpotPrice,
	Market,
	OptionsTableData,
	OwnOrdersRows,
	WSMsg,
	AuthMessage,
	FilterMessage,
} from './types'
import logo from './logo.svg'
import moment from 'moment'
import { connectWS, delay } from './utils/ws'

const COLUMNS = [
	{
		Header: 'Instrument Name',
		accessor: 'instrument' as const,
	},
	{
		Header: 'Side',
		accessor: 'side' as const,
	},
	{
		Header: 'Remaining Amount',
		accessor: 'amount' as const,
	},
	{
		Header: 'Price',
		accessor: 'price' as const,
	},
	{
		Header: 'Expires',
		accessor: 'expiration' as const,
	},
]
function Account() {
	const [showResults, setShowResults] = React.useState(true)
	const [ethBalance, setEthBalance] = React.useState(0)
	const [collateralBalance, setCollateralBalance] = React.useState([] as TokenBalance[])

	const [rawOrders, setRawOrders] = React.useState([] as ReturnedOrderbookQuote[])
	const [orders, setOrders] = React.useState([] as OptionsTableData[])
	const [ordersRows, setOrdersRows] = React.useState([] as OwnOrdersRows[])

	const [expirations, setExpirations] = React.useState([] as string[])
	const [activeExpiration, setActiveExpiration] = React.useState('')

	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)
	const [spotPrice, setSpotPrice] = React.useState({
		WBTC: 43000,
		WETH: 2200,
		ARB: 1.9,
	} as SpotPrice)

	const columns = useMemo<Column<OwnOrdersRows>[]>(() => COLUMNS, [])
	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
		{ columns, data: ordersRows, autoResetSortBy: false },
		useSortBy,
	)

	const getData = () => {
		console.log('fetching account data...')

		getNativeBalance().then(setEthBalance).catch(console.error)
		getCollateralBalance().then(setCollateralBalance).catch(console.error)
		getSpotPrice()
			.then((coins) => setSpotPrice(coins))
			.catch(console.error)
		getOwnOrders().then(setRawOrders).catch(console.error)
	}

	useEffect(() => {
		getData()
		const interval = setInterval(() => {
			getData()
		}, 30 * 1000)

		return () => clearTimeout(interval)
	}, [])

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
						provider: WALLET_ADDRESS.toLowerCase(),
						taker: '*',
					},
				}
				ws.send(JSON.stringify(webSocketFilter))
			})
			.catch(console.error)

		return () => (wsLink ? wsLink.close() : void 0)
	}, [])

	useEffect(() => {
		prepareOrders(marketSelector, spotPrice[marketSelector], rawOrders).then((groupedOrders) => {
			setOrders(groupedOrders)
			const expirations = groupedOrders.map((order) => order.expiration)
			setExpirations(expirations)
			if (!activeExpiration) setActiveExpiration(expirations[0])
		})
	}, [rawOrders, marketSelector])

	const prepareRows = () => {
		const activeExpirationOrders = orders.find((order) => order.expiration === activeExpiration)
		if (activeExpirationOrders) {
			const ordersRows: OwnOrdersRows[] = activeExpirationOrders.positions
				.flatMap((positions) => positions.quotes)
				.filter((order) => order.base === marketSelector)
				.map((order) => {
					const priceUSD = order.type === 'C' ? order.price * spotPrice[marketSelector] : order.price * order.strike
					const expiresInSec: number = order.ts + order.deadline - moment.utc().unix()

					return {
						// BTC-25MAR23-420-C
						instrument: `${order.base}-${order.expiration}-${order.strike}-${order.type}`,
						side: order.side,
						price: priceUSD.toFixed(2),
						amount: order.remainingSize,
						expiration: moment.utc().startOf('day').seconds(expiresInSec).format('mm [min] ss [sec]'),
						expiresInSec: expiresInSec,
					}
				})
				.filter((row) => row.expiresInSec > 0)

			setOrdersRows(ordersRows)
		}
	}

	useEffect(() => {
		prepareRows()
		const interval = setInterval(() => {
			prepareRows()
		}, 1000)

		return () => clearTimeout(interval)
	}, [activeExpiration, marketSelector, orders])

	return (
		<div className="app">
			<div className="app-container">
				<img hidden={orders.length > 0} src={logo} className="app-logo" alt="logo" />
				<p hidden={orders.length > 0}>Loading your positions...</p>
				<p hidden={orders.length === 0}>Open Orders</p>
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
				<div style={{ display: ordersRows.length > 0 ? 'block' : 'none' }} className="positions-container">
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
						<table style={{ display: ordersRows.length > 0 ? 'table' : 'none' }} {...getTableProps()}>
							<thead>
								{headerGroups.map((headerGroup) => (
									<tr {...headerGroup.getHeaderGroupProps()}>
										{headerGroup.headers.map((column) => (
											<th
												className={column.isSorted ? 'sorted' : ''}
												{...column.getHeaderProps(column.getSortByToggleProps())}
											>
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
												return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
											})}
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>

				<p hidden={orders.length === 0}>Account Balance and Settings</p>
				<div style={{ display: orders.length > 0 ? 'block' : 'none' }} className="config">
					<p>
						Wallet Address: <code>{WALLET_ADDRESS}</code>
					</p>
					<p>
						Wallet Native Balance: <code>{ethBalance.toFixed(4)}</code> ETH
					</p>
					<p>Wallet Collateral Balance:</p>
					{collateralBalance.map((tokenBalance) => {
						return (
							<ul key={tokenBalance.symbol} className="collateral-balance">
								{tokenBalance.symbol}: <code>{Number(tokenBalance.balance).toFixed(4)}</code>
							</ul>
						)
					})}
					<p hidden={showResults}>
						API Key: <code>{process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY}</code>
					</p>
					<button className="sensitive-button" onClick={() => setShowResults(!showResults)}>
						{showResults ? 'Show' : 'Hide'} Sensetive Data
					</button>
				</div>
			</div>
		</div>
	)
}

export default Account
