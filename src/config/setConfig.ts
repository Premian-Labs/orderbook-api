import dotenv from 'dotenv';

dotenv.config();

export function checkEnv(integrationTest: boolean = false) {
	if (
		!process.env.ENV ||
		!process.env.WALLET_PRIVATE_KEY ||
		!process.env.WALLET_ADDRESS ||
		!process.env.WS_ENDPOINT ||
		!process.env.HTTP_PORT
	) {
		throw new Error(`Missing Core Credentials`);
	}

	if (process.env.ENV !== 'development' && integrationTest) {
		throw new Error('Integration test can only be run in development mode');
	}

	const useTestnet = process.env.ENV == 'development' || integrationTest;

	if (
		useTestnet &&
		(!process.env.TESTNET_RPC_URL || !process.env.TESTNET_ORDERBOOK_API_KEY)
	) {
		throw new Error(`Missing Testnet Credentials`);
	}

	if (
		process.env.ENV == 'production' &&
		(!process.env.MAINNET_RPC_URL || !process.env.MAINNET_ORDERBOOK_API_KEY)
	) {
		throw new Error(`Missing Mainnet Credentials`);
	}

	// TODO: remove when moralis migration to cloud happens
	if (!process.env.MORALIS_KEY || !process.env.ENV) {
		throw new Error(`Balance Credentials Missing`);
	}
}
