import React, { useEffect } from 'react'
import logo from './logo.svg'
import './Main.css'
import { ReturnedOrderbookQuote } from '../../src/types/quote'
import { getOrderbookState, groupOrders } from './utils/getOrderbookState'
import {Market} from "./types";

function Main() {
	const [callOrders, setCallOrders] = React.useState([] as [string, ReturnedOrderbookQuote[]][])
	const [putOrders, setPutOrders] = React.useState([] as [string, ReturnedOrderbookQuote[]][])
	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)

	useEffect(() => {
		getOrderbookState('ALL')
			.then((orders) => {
				const [groupedCalls, groupedPuts] = groupOrders(marketSelector, orders)
				setCallOrders(groupedCalls)
				setPutOrders(groupedPuts)
			})
			.catch(console.error)
	}, [marketSelector])
	return (
		<div className="App">
			<div className="App-container">
				<img hidden={callOrders.length > 0} src={logo} className="App-logo" alt="logo"/>
				<p hidden={callOrders.length > 0}>Loading orderbook state...</p>
				<div hidden={callOrders.length === 0 && putOrders.length === 0} className='selector'>
					<button className={marketSelector === 'WETH' ? 'selector-btn-active' : 'selector-btn'}
									onClick={() => setMarketSelector('WETH')}>ETH
					</button>
					<button className={marketSelector === 'WBTC' ? 'selector-btn-active' : 'selector-btn'}
									onClick={() => setMarketSelector('WBTC')}>BTC
					</button>
				</div>

				<div className="PositionsContainer">
					<div hidden={callOrders.length === 0} className="Positions">
						<h1>CALLS</h1>
						{callOrders.map(([expiration, quotes]) => (
							<p>
								<h4>{expiration}</h4>
								{quotes
									.sort((a, b) => a.strike - b.strike)
									.map((quote) => {
										return (
											<ul>
												{' '}
												price: {quote.price.toFixed(4)}, strike: {quote.strike}, size: {quote.remainingSize}
											</ul>
										)
									})}
							</p>
						))}
					</div>

					<div hidden={putOrders.length === 0} className="Positions">
						<h1>PUTS</h1>
						{putOrders.map(([expiration, quotes]) => (
							<p>
								<h4>{expiration}</h4>
								{quotes
									.sort((a, b) => a.strike - b.strike)
									.map((quote) => {
										return (
											<ul>
												{' '}
												price: ${quote.price.toFixed(4)}, strike: {quote.strike},  size: {quote.remainingSize}
											</ul>
										)
									})}
							</p>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

export default Main
