import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Logger from './lib/logger';
import { ethers, Contract } from 'ethers';
import poolABI from './abi/IPool.json';
import { AJVQuote } from './helpers/types';
import { checkTestApiKey } from './helpers/auth';
import {
	validateDeleteQuotes,
	validateFillQuotes,
	validateGetAllQuotes,
	validateGetFillableQuotes,
	validateGetRFQQuotes,
	validatePostQuotes,
} from './helpers/validators';
import { getPoolAddress } from './helpers/utils';
import { proxyHTTPRequest } from './helpers/proxy';
import orderbookUrl from './config/constants.json'

dotenv.config();

if (
	!process.env.ENV ||
	!process.env.WALLET_PRIVATE_KEY ||
	!process.env.WALLET_ADDRESS ||
	!process.env.BASE_URL
) {
	throw new Error(`Missing Core Credentials`);
}

if (process.env.ENV == 'development' && (!process.env.TESTNET_RPC_URL || !process.env.TESTNET_ORDERBOOK_API_KEY)){
	throw new Error(`Missing Testnet Credentials`);
}

if (process.env.ENV == 'production' && (!process.env.MAINNET_RPC_URL || !process.env.MAINNET_ORDERBOOK_API_KEY)){
	throw new Error(`Missing Mainnet Credentials`);
}

const orderbook_url = process.env.ENV == 'production'? orderbookUrl.ArbOrderbookUrl : orderbookUrl.ArbGoerliOrderbookUrl
const rpc_url = process.env.ENV == 'production'? process.env.TESTNET_RPC_URL: process.env.TESTNET_RPC_URL;
const privateKey = process.env.WALLET_PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(rpc_url);
const signer = new ethers.Wallet(privateKey, provider);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, }));
app.use(checkTestApiKey);


app.post('/orderbook/quotes', async (req, res) => {
	// TODO: publish quote to orderbook (orderbook proxy)
	const valid = validatePostQuotes(req.body);
	Logger.debug(`Post request body: ${JSON.stringify(req.body)}`);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
		);
		return res.send(validatePostQuotes.errors);
	}

	const requestBody: AJVQuote[] = req.body;
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'GET',
		null,
		requestBody
	);
	return res.sendStatus(proxyResponse.status);
});

app.patch('/orderbook/quotes', async (req, res) => {
	const valid = validateFillQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateFillQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	//TODO: Approve tokens for trading
	//TODO: invoke Web3 fillQuoteOB
});

app.delete('/orderbook/quotes', async (req, res) => {
	// TODO: cancel quote directly onchain (no orderbook proxy)
	const valid = validateDeleteQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateDeleteQuotes.errors)}`
		);
		return res.send(validateDeleteQuotes.errors);
	}
	const poolAddr = await getPoolAddress(req.body.poolKey);
	const poolContract = new Contract(poolAddr, poolABI, signer);
	try {
		const cancelTx = await poolContract.cancelQuotesOB(req.body);
		await provider.waitForTransaction(cancelTx.hash, 1);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'RPC provider error' });
	}

	res.status(201).json('Quotes deleted');
});

app.get('/orderbook/quotes', async (req, res) => {
	//TODO: orderbook proxy
	const valid = validateGetFillableQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetFillableQuotes.errors)}`
		);
		return res.send(validateGetFillableQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'GET',
		req.query,
		null
	);
	return res.sendStatus(proxyResponse.status);
});

app.get('/orderbook/orders', async (req, res) => {
	// TODO: gets all quotes for a given market (returns  bid/ask quotes) (orderbook proxy)
	const valid = validateGetAllQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetAllQuotes.errors)}`
		);
		return res.send(validateGetAllQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'orders',
		'GET',
		req.query,
		null
	);
	return res.sendStatus(proxyResponse.status);
});

app.get('/orderbook/private_quotes', async (req, res) => {
	//TODO: use proxy to get get personalized/private quotes for accounts
	const valid = validateGetRFQQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetRFQQuotes.errors)}`
		);
		return res.send(validateGetRFQQuotes.errors);
	}
	const proxyResponse = await proxyHTTPRequest(
		'rfq_quotes',
		'GET',
		req.query,
		null
	);
	return res.sendStatus(proxyResponse.status);
});

app.post('/pool/settle', async  (req, res) => {
	//TODO: check that account has a short position before attempting to settle
})

app.post('/pool/exercise', async  (req, res) => {
	//TODO: check that account has a long position before attempting to exercise
})

app.get('/account/positions', async  (req, res) => {
	//TODO: Get Current positions (my positions -> expired vs. unexpired) -> check Moralis funcitonality (host in our own cloud) -> use orderbook proxy
})

app.get('/account/orders', async  (req, res) => {
	//TODO: Get active orders (my open orders) use orderbook proxy
})

app.get('/account/balances', async  (req, res) => {
	//TODO: Wallet Balances (ETH, USDC) use orderbook proxy (Moralis)
})

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
