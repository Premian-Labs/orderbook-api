import { NavLink } from 'react-router-dom'
import './Navbar.css'
import React, { useEffect } from 'react'
import { CoinPrice } from './types'
import axios from 'axios'
import { COINCAP_API } from './config'

export async function getCoinsPrice() {
	// TODO: add spot price endpoint to orderbook-API
	const btcData = await axios.get(`${COINCAP_API}/bitcoin`)
	const ethData = await axios.get(`${COINCAP_API}/ethereum`)
	// const arbData = await axios.get(`${COINCAP_API}/arbitrum`)

	const prices: CoinPrice = {
		WBTC: Number(btcData.data['data']['rateUsd']),
		WETH: Number(ethData.data['data']['rateUsd']),
		ARB: 0,
	}
	return prices
}

export const Navbar = () => {
	const [coinPrice, setCoinPrice] = React.useState({
		WBTC: 0.0,
		ARB: 0.0,
		WETH: 0.0,
	} as CoinPrice)

	useEffect(() => {
		getCoinsPrice()
			.then((coins) => setCoinPrice(coins))
			.catch(console.error)

		const interval = setInterval(() => {
			getCoinsPrice()
				.then((coins) => setCoinPrice(coins))
				.catch(console.error)
			console.log('coins pricing update')
		}, 10 * 1000)

		return () => clearTimeout(interval)
	}, [])

	return (
		<nav>
			<div className="navigation">
				<NavLink
					to="/home"
					style={({ isActive, isPending, isTransitioning }) => {
						return {
							color: isActive ? 'white' : '#a2a2a2',
						}
					}}
				>
					Home
				</NavLink>
				<NavLink
					to="/account"
					style={({ isActive, isPending, isTransitioning }) => {
						return {
							color: isActive ? 'white' : '#a2a2a2',
						}
					}}
				>
					Account
				</NavLink>
				<NavLink
					to="/history"
					style={({ isActive, isPending, isTransitioning }) => {
						return {
							color: isActive ? 'white' : '#a2a2a2',
						}
					}}
				>
					History
				</NavLink>
			</div>
			<div className="currencies">
				<span>BTC: ${coinPrice.WBTC.toFixed(0)}</span>
				<span>ETH: ${coinPrice.WETH.toFixed(1)}</span>
				{/*<span>ARB: ${coinPrice.ARB.toFixed(2)}</span>*/}
			</div>
		</nav>
	)
}
