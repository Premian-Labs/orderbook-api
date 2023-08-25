import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import moment from 'moment';
import Logger from './lib/logger';
import { ethers, Contract, parseEther } from 'ethers';
import poolABI from './abi/IPool.json';
import {
    PoolKey,
		PublishQuoteProxyRequest,
    PublishQuoteRequest,
} from './helpers/types';
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
import arb from './config/arbitrum.json'
import arbGoerli from './config/arbitrumGoerli.json'
import { getQuote, signQuote, createQuote, serializeQuote } from './helpers/quote';

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

const rpc_url = process.env.ENV == 'production' ? process.env.MAINNET_RPC_URL : process.env.TESTNET_RPC_URL;
const privateKey = process.env.WALLET_PRIVATE_KEY;
export const provider = new ethers.JsonRpcProvider(rpc_url);
export const chainId = process.env.ENV == 'production' ? '42161' : '421613'
const signer = new ethers.Wallet(privateKey, provider);


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, }));
app.use(checkTestApiKey);


app.post('/orderbook/quotes', async (req, res) => {
	/*
	NOTE: sample object array in req.body
		[
			{
				base: 'WETH'
				quote: 'USDC'
				expiration: '22FEB19'
				strike: 1700
				type: 'C' | 'P'
				side: 'buy' | 'sell'
				size: 1.5
				price: 0.21
				deadline: 300 (seconds)
			},
			{
				base: 'WETH'
				quote: 'USDC
				expiration: 22FEB19
				strike: 1400
				type: 'C' | 'P'
				side: 'buy' | 'sell'
				size: 1.9
				price: 0.15
				deadline: 300 (seconds)
			},
		]
*/

	// TODO: update schema to reflect the above object array
	// 1. Validate incoming object array
	const valid = validatePostQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validateFillQuotes.errors)}`
		);
		return res.send(validateFillQuotes.errors);
	}
	let serializedQuotes: PublishQuoteProxyRequest[] = []
	// 2. Loop through each order and convert to signed quote object
	for (const quote of req.body as PublishQuoteRequest[]) {
		// 2.1 Check that deadline is valid and generate deadline timestamp
		const ts = Math.trunc(new Date().getTime() / 1000);
		let deadline: number
		if (quote.deadline < 60) {
			return res.status(400).json({
				message: 'Quote deadline is invalid (cannot be less than 60 sec)',
				quote: quote,
			});
		} else {
			deadline = ts + quote.deadline
		}
		// 2.2 Validate maturity and generate timestamp
		// TODO: use moment to validate expiration and create timestamp
		const expirationMoment = moment(quote.expiration, 'DD-mm-YY')
		// check expirationMoment.day() == 5
		// if expiration is > 30 days, then only valid friday is the last friday of the month
		// set 8AM if valid

		// 2.3 Create Pool Key
		const poolKey: PoolKey = {
			base: process.env.ENV == 'production' ? arb.tokens[quote.base] : arbGoerli.tokens[quote.base],
			quote: process.env.ENV == 'production' ? arb.tokens[quote.quote]: arbGoerli.tokens[quote.quote],
			oracleAdapter:process.env.ENV == 'production' ? arb.ChainlinkAdapterProxy: arbGoerli.ChainlinkAdapterProxy,
			strike: parseEther(quote.strike.toString()),
			maturity: expirationMoment.unix(),
			isCallPool: quote.type === 'C',
		}

		// 2.4 Get PoolAddress
		const poolAddr = await getPoolAddress(poolKey);

		// TODO: pass takerAddress [optional]
		// 2.5 Generate a initial quote object
		const quoteOB = await getQuote(
			process.env.WALLET_ADDRESS!,
			parseEther(quote.size.toString()),
			quote.side === 'buy',
			parseEther(quote.price.toString()),
			deadline,
		);

		// 2.6 Sign quote object
		const signedQuote = await signQuote(provider, poolAddr, quoteOB);
		const publishQuote = createQuote(poolKey, quoteOB, signedQuote);

		// 2.7 Serialize quote
		const serializedQuote = serializeQuote(publishQuote)

		// 2.8 Add chain id to quote object
		const publishQuoteRequest = {
			...serializedQuote,
			chainId: chainId
		}

		// 2.9 Add quote the object array
		serializedQuotes.push(publishQuoteRequest)
  }

	// 3 Submit quote object array to orderbook API
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'POST',
		null,
		serializedQuotes
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
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

app.get('/orderbook/valid_quote', async (req, res) => {
// TODO: check if a quote is valid (maybe  this can just be done in fillQuote endpoint?
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

app.post('/account/approve', async  (req, res) => {
		// TODO add or remove approvals
		// TODO array of tokens to approve and optionally an amount (default will be max)
		// TODO return approval values
})

app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
