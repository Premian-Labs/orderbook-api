import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import moment from 'moment';
import Logger from './lib/logger';
import {ethers, Contract, parseEther, MaxUint256, parseUnits, ZeroAddress} from 'ethers';
import poolABI from './abi/IPool.json';
import {
	Option,
	PoolKey,
	PublishQuoteProxyRequest,
	PublishQuoteRequest,
	TokenType
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
import { getPoolAddress, processExpiredOptions, annihilateOptions } from './helpers/utils';
import { proxyHTTPRequest } from './helpers/proxy';
import arb from './config/arbitrum.json'
import arbGoerli from './config/arbitrumGoerli.json'
import { getQuote, signQuote, createQuote, serializeQuote } from './helpers/quote';
import {ERC20Base__factory} from "./typechain";

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
export const walletAddr = process.env.WALLET_ADDRESS
export const provider = new ethers.JsonRpcProvider(rpc_url);
export const chainId = process.env.ENV == 'production' ? '42161' : '421613'
export const signer = new ethers.Wallet(privateKey, provider);
const routerAddress = process.env.ENV == 'production' ?  arb.ERC20Router : arbGoerli.ERC20Router;

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

	// 1. Validate incoming object array
	const valid = validatePostQuotes(req.body);
	if (!valid) {
		res.status(400);
		Logger.error(
			`Validation error: ${JSON.stringify(validatePostQuotes.errors)}`
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

		// TODO: abstract as a function createExpiration
		const expirationMoment = moment.utc(quote.expiration, 'DDMMMYY');

		// check if option expiration is a valid date
		if (!expirationMoment.isValid()) {
			const err = `Invalid expiration date: ${quote.expiration}`
			Logger.error(err);
			return res.status(400).json({ message: err });
		}

		// check if option expiration is Friday
		if (expirationMoment.day() !== 5)  {
			const err = `${expirationMoment.toJSON()} is not Friday!`
			Logger.error(err);
			return res.status(400).json({ message: err });
		}

		// check if option maturity is more than 30 days, than it can only expire last Friday of that month
		const daysToExpiration = expirationMoment.diff(moment().startOf('day'), 'days');
		if (daysToExpiration > 30) {
			const lastDay = expirationMoment.clone().endOf('month').startOf('day');
			lastDay.subtract((lastDay.day() + 2) % 7, 'days')

			if (!lastDay.isSame(expirationMoment)) {
				const err = `${expirationMoment.toJSON()} is not the last Friday of the month!`;
				Logger.error(err);
				return res.status(400).json({ message: err });
			}
		}

		// Set time to 8:00 AM
		const expiration = expirationMoment.add(8, 'hours').unix()

		// TODO: abstract as a function createPoolKey
		// 2.3 Create Pool Key
		const poolKey: PoolKey = {
			base: process.env.ENV == 'production' ? arb.tokens[quote.base] : arbGoerli.tokens[quote.base],
			quote: process.env.ENV == 'production' ? arb.tokens[quote.quote]: arbGoerli.tokens[quote.quote],
			oracleAdapter:process.env.ENV == 'production' ? arb.ChainlinkAdapterProxy: arbGoerli.ChainlinkAdapterProxy,
			strike: parseEther(quote.strike.toString()),
			maturity: expiration,
			isCallPool: quote.type === 'C',
		}

		// 2.4 Get PoolAddress
		const poolAddr = await getPoolAddress(poolKey);

		// 2.5 Generate a initial quote object
		const quoteOB = await getQuote(
			process.env.WALLET_ADDRESS!,
			parseEther(quote.size.toString()),
			quote.side === 'buy',
			parseEther(quote.price.toString()),
			deadline,
			quote.taker
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
	// TODO: request object must have pool key components
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
	// TODO: request object must have pool key components
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

	res.status(201).json({ message : `Quote ${req.body.quoteId} deleted` });
});

app.post('/orderbook/validate_quote', async (req, res) => {
// TODO: check if a quote is valid - Web3 call
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
	const proxyResponse = await proxyHTTPRequest(
		'quotes',
		'GET',
		req.query,
		null
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
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
	const proxyResponse = await proxyHTTPRequest(
		'orders',
		'GET',
		req.query,
		null
	);
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

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
	return res.status(proxyResponse.status).json(proxyResponse.data);
});

app.post('/pool/settle', async  (req, res) => {
	//TODO: validate req.body
	/*
	[
		{
			base: 'WETH'
			quote: 'USDC'
			expiration: '22FEB19'
			strike: 1700
			type: 'C' | 'P'
		}
	]
	*/

	try {
		await processExpiredOptions(req.body as Option[], TokenType.SHORT)
	} catch(e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
})

app.post('/pool/exercise', async  (req, res) => {
	//TODO: validate req.body
	/*
	[
		{
			base: 'WETH'
			quote: 'USDC'
			expiration: '22FEB19'
			strike: 1700
			type: 'C' | 'P'
		}
	]
	*/

	try {
		await processExpiredOptions(req.body as Option[], TokenType.LONG)
	} catch(e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);
})

app.post('/pool/annihilate', async  (req, res) => {
	//TODO: validate req.body
	/*
[
    {
        base: 'WETH'
        quote: 'USDC'
        expiration: '22FEB19'
        strike: 1700
        type: 'C' | 'P'
    }
]
*/

	try {
		await annihilateOptions(req.body as Option[])
	} catch(e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);




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

app.post('/account/token_approval', async  (req, res) => {

	// TODO: convert to req.body. Just an example.
	const approvals = { WETH: 17, USDC: 'max'}

	//TODO: validate that tokens in req body exist in token object for specified chain
	//TODO: validate that approval qty is either a number or 'max'

	try{
		for (const token in approvals){
			const erc20Addr =  process.env.ENV == 'production' ? arb.tokens[token] : arbGoerli.tokens[token]
			const erc20 = ERC20Base__factory.connect(erc20Addr, signer);

			if (approvals[token] === 'max'){
				const response = await erc20.approve(routerAddress, MaxUint256.toString());
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${token} approval set to MAX`);
			}else{
				const qty = approvals[token] == 'USDC'? parseUnits(approvals[token].toString(), 6): parseEther(approvals[token].toString())
				const response =  await erc20.approve(routerAddress, qty);
				await provider.waitForTransaction(response.hash, 1);
				Logger.info(`${token} approval  set to ${approvals[token]}`);
			}
		}
	} catch(e) {
		return res.status(500).json({ message: e });
	}

	res.sendStatus(201);

})

app.post('/account/option_approval', async  (req, res) => {
 //TODO: what is the best way to deal with this?
})
app.listen(process.env.HTTP_PORT, () => {
	Logger.info(`HTTP listening on port ${process.env.HTTP_PORT}`);
});
