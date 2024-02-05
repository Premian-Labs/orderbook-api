import React from 'react'
import './Main.css'
import './Settings.css'

function Settings() {
	const [showResults, setShowResults] = React.useState(true)
	const onClick = () => setShowResults(!showResults)

	return (
		<div className="App">
			<div className="App-container">
				<div className="Config">
					<p>Settings page</p>
					<code>{`WALLET_ADDRESS: ${process.env.REACT_APP_WALLET_ADDRESS}`}</code>
					<code>{`TESTNET_API_KEY: ${process.env.REACT_APP_TESTNET_ORDERBOOK_API_KEY}`}</code>
					<code hidden={showResults}>{`MAINNET_API_KEY: ${process.env.REACT_APP_MAINNET_ORDERBOOK_API_KEY}`}</code>
					<button onClick={onClick}>{showResults ? 'Show' : 'Hide'} Sensetive Data</button>
				</div>
			</div>
		</div>
	)
}

export default Settings
