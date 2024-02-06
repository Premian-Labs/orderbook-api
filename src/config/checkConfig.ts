import dotenv from 'dotenv'

dotenv.config()

export function checkEnv(integrationTest: boolean = false) {
	if (
		!process.env.ENV ||
		!process.env.TESTNET_RPC_URL ||
		!process.env.MAINNET_RPC_URL ||
		!process.env.WALLET_PRIVATE_KEY ||
		!process.env.TESTNET_ORDERBOOK_API_KEY ||
		!process.env.MAINNET_ORDERBOOK_API_KEY ||
		!process.env.WALLET_ADDRESS ||
		!process.env.HTTP_PORT
	) {
		throw new Error(`Missing Core Credentials`)
	}

	if (process.env.ENV !== 'development' && integrationTest) {
		throw new Error('Integration test can only be run in development mode')
	}
}
