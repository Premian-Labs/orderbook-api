import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Logger from './lib/logger';
import { ethers, Contract } from 'ethers';
import poolABI from './abis/IPool.json';
import { AJVQuote } from './helpers/types';
import { checkTestApiKey } from './helpers/auth';
import {
	validateDeleteQuotes,
	validateFillQuotes, validateGetAllQuotes,
	validateGetFillableQuotes, validateGetRFQQuotes,
	validatePostQuotes
} from "./helpers/validators";
import {getPoolAddress} from "./helpers/utils";

dotenv.config();

if (
	!process.env.ENV ||
	!process.env.WEB3_RPC_URL ||
	!process.env.WALLET_PRIVATE_KEY ||
	!process.env.API_KEY ||
	!process.env.POOL_FACTORY_ADDRESS
) {
	throw new Error(`Missing Premia V3 contract credentials or ENV`);
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
	//TODO: proxy to cloud POST /quotes
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
	//TODO: invoke Web3 fillQuoteOB
})

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
	const poolContract= new Contract(poolAddr, poolABI, signer);
	try {
		const cancelTx = await poolContract.cancelQuotesOB(req.body);
		await provider.waitForTransaction(cancelTx.hash, 1);
	} catch (e) {
		Logger.error(e);
		return res.status(500).json({ message: 'RPC provider error' });
	}

	res.status(201).json("Quotes deleted");
});

app.get('/orderbook/quotes', async (req, res) => {
	const valid = validateGetFillableQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetFillableQuotes.errors)}`
		);
		return res.send(validateGetFillableQuotes.errors);
	}
	//TODO: proxy to cloud GET quotes
});

app.get('/orderbook/orders', async (req, res) => {
	const valid = validateGetAllQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetAllQuotes.errors)}`
		);
		return res.send(validateGetAllQuotes.errors);
	}
	//TODO: proxy to cloud GET /orders
});

app.get('/orderbook/rfqs', async (req, res) => {
	const valid = validateGetRFQQuotes(req.query);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateGetRFQQuotes.errors)}`
		);
		return res.send(validateGetRFQQuotes.errors);
	}
	//TODO: proxy to cloud GET /rfq_quotes
});

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
