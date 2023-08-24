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

dotenv.config();

if (
	!process.env.ENV ||
	!process.env.WEB3_RPC_URL ||
	!process.env.WALLET_PRIVATE_KEY ||
	!process.env.WALLET_ADDRESS ||
	!process.env.API_KEY ||
	!process.env.BASE_URL
) {
	throw new Error(`Missing Premia V3 credentials or ENV`);
}

const rpc_url = process.env.WEB3_RPC_URL;
const privateKey = process.env.WALLET_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(rpc_url);
const signer = new ethers.Wallet(privateKey, provider);

const app = express();
app.use(cors());

app.use(express.json());
app.use(
	express.urlencoded({
		extended: true,
	})
);

app.use(checkTestApiKey);

// publish quote to orderbook (orderbook proxy)
app.post('/orderbook/quotes', async (req, res) => {
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
// fill quote in the orderbook (goes to arbitrum one)
app.patch('/orderbook/quotes', async (req, res) => {
	const valid = validateFillQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateFillQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	//TODO: invoke Web3 fillQuoteOB
});
// cancels quote in both redis and onchain on arbitrum one
app.delete('/orderbook/quotes', async (req, res) => {
	const valid = validateDeleteQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateDeleteQuotes.errors)}`
		);
		return res.send(validateDeleteQuotes.errors);
	}

	const poolAddr = await getPoolAddress(req.body.poolKey);
	// TODO: new Contract invocation can be inefficient
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
// gets best quotes for a given market up to a specific size (orderbook proxy)
app.get('/orderbook/quotes', async (req, res) => {
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
// gets all quotes for a given market (returns  bid/ask quotes) (orderbook proxy)
app.get('/orderbook/orders', async (req, res) => {
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
// get personalized/private quotes for accounts (orderbook proxy)
app.get('/orderbook/private_quotes', async (req, res) => {
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

//TODO: Settle Expired Positions
//TODO: Exercise Expired Position

// functionality lives in our cloud and used proxy to reach out cloud
//TODO: Get Current positions (my positions -> expired vs. unexpired) -> check Moralis funcitonality (host in our own cloud) -> use orderbook proxy
//TODO: Get active orders (my open orders) use orderbook proxy
//TODO: Wallet Balances (ETH, USDC) use orderbook proxy
//TODO: Approve tokens for trading (or embed into api call)
//TODO: for cancelling quotes, we need to verify the api call is coming from the address owner (signature verification)

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
