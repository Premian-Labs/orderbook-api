import React, { useEffect } from 'react'
import './Main.css'
import './Account.css'
import { CollateralBalances } from './types'
import { getCollateralBalance, getNativeBalance } from './utils/apiGetters'
import { WALLET_ADDRESS } from './config'
import { TokenBalance } from '../../src/types/balances'

function Account() {
	const [showResults, setShowResults] = React.useState(true)
	const [ethBalance, setEthBalance] = React.useState(0)
	const [collateralBalance, setCollateralBalance] = React.useState([] as TokenBalance[])
	useEffect(() => {
		getNativeBalance().then(setEthBalance).catch(console.error)
	}, [])

	useEffect(() => {
		getCollateralBalance().then(setCollateralBalance).catch(console.error)
	}, [])

	return (
		<div className="app">
			<div className="app-container">
				<p>Account Balance, Positions and Settings</p>
				<div className="config">
					<p>Wallet Address: {WALLET_ADDRESS}</p>
					<p>Wallet Native Balance (Eth): {ethBalance}</p>
					<p>Wallet Collateral Balance:</p>
					{collateralBalance.map((tokenBalance) => {
						return (
							<ul className="collateral-balance">
								{tokenBalance.symbol}: {tokenBalance.balance}
							</ul>
						)
					})}
					<p hidden={showResults}>{`API Key: ${process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY}`}</p>
					<button onClick={() => setShowResults(!showResults)}>{showResults ? 'Show' : 'Hide'} Sensetive Data</button>
				</div>
			</div>
		</div>
	)
}

export default Account
