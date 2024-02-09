import { NavLink } from 'react-router-dom'
import './Navbar.css'
import React, { useEffect } from 'react'
import { SpotPrice } from './types'
import { getSpotPrice } from './utils/apiGetters'

export const Navbar = () => {
	const [spotPrice, setSpotPrice] = React.useState({
		WBTC: 0.0,
		ARB: 0.0,
		WETH: 0.0,
	} as SpotPrice)

	useEffect(() => {
		getSpotPrice()
			.then((coins) => setSpotPrice(coins))
			.catch(console.error)

		const interval = setInterval(() => {
			getSpotPrice()
				.then((coins) => setSpotPrice(coins))
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
				<span>BTC: ${spotPrice.WBTC.toFixed(0)}</span>
				<span>ETH: ${spotPrice.WETH.toFixed(1)}</span>
				<span>ARB: ${spotPrice.ARB.toFixed(2)}</span>
			</div>
		</nav>
	)
}
