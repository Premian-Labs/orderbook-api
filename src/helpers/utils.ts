import {
	PoolKey,
	Option,
	TokenType,
	PublishQuoteRequest,
	OrderbookQuote,
	OrderbookQuoteDeserialized,
	MoralisTokenBalance,
	TokenAddresses, FillableQuote, OrderbookQuoteTradeDeserialized
} from './types';
import {
	Contract,
	formatEther,
	formatUnits,
	parseEther,
	toBigInt,
} from 'ethers';
import Logger from '../lib/logger';
import PoolFactoryABI from '../abi/IPoolFactory.json';
import { provider, signer, walletAddr } from '../index';
import arb from '../config/arbitrum.json';
import arbGoerli from '../config/arbitrumGoerli.json';
import moment from 'moment/moment';
import { IPool, IPool__factory } from '../typechain';

const poolFactoryAddr =
	process.env.ENV == 'production'
		? arb.PoolFactoryProxy
		: arbGoerli.PoolFactoryProxy;
const poolFactory = new Contract(poolFactoryAddr, PoolFactoryABI, provider);

const poolMap: Map<PoolKey, string> = new Map();
export async function getPoolAddress(poolKey: PoolKey) {
	const memPoolAddress = poolMap.get(poolKey);
	if (memPoolAddress) return memPoolAddress;

	let poolAddress: string;
	let isDeployed: boolean;

	try {
		[poolAddress, isDeployed] = await poolFactory.getPoolAddress(poolKey);
	} catch (e) {
		try {
			[poolAddress, isDeployed] = await poolFactory.getPoolAddress(poolKey);
		} catch (e) {
			Logger.error(`Can not get pool address: ${JSON.stringify(e)}`);
			throw new Error(`Can not get pool address`);
		}
	}
	poolAddress = poolAddress.toLowerCase();
	if (!isDeployed) {
		Logger.warn(`Pool is not deployed: ${JSON.stringify(poolKey)}`);
	}
	poolMap.set(poolKey, poolAddress);
	return poolAddress;
}

export async function preProcessExpOption(
	expOption: Option,
	tokenType: number
) {
	// NOTE: expiration is an incoming string only value but later converted to number
	const strExp = expOption.expiration as string;

	// 1. verified the option has expired
	const optionHasExpired = optionExpired(strExp);
	if (!optionHasExpired) {
		throw new Error('Option has not expired');
	}
	// 2. validate and convert option exp to timestamp
	expOption.expiration = createExpiration(strExp);

	// 3. check that there is a balance for the option being settled/exercised
	const poolKey: PoolKey = createPoolKey(expOption);
	const poolAddr = await getPoolAddress(poolKey);
	const pool = IPool__factory.connect(poolAddr, signer);
	const balance = await pool.balanceOf(walletAddr, tokenType);
	Logger.info(
		`${tokenType === 0 ? 'Short' : 'Long'} Balance: `,
		formatEther(balance)
	);

	//TODO: verify that a zero balance indeed comes as 0n
	if (balance === 0n) {
		throw new Error('No balance to settle');
	}

	return pool;
}

export async function preProcessAnnhilate(
	annihilateOption: Option
): Promise<[IPool, bigint]> {
	// NOTE: expiration is an incoming string only value but later converted to number
	const strExp = annihilateOption.expiration as string;

	// 1. validate and convert option exp to timestamp
	annihilateOption.expiration = createExpiration(strExp);

	// 2. create poolKey
	const poolKey = createPoolKey(annihilateOption);

	// 3. get & check balances
	const poolAddr = await getPoolAddress(poolKey);
	const pool = IPool__factory.connect(poolAddr, signer);

	const shortBalance = parseFloat(
		formatEther(await pool.balanceOf(walletAddr, TokenType.SHORT))
	);
	const longBalance = parseFloat(
		formatEther(await pool.balanceOf(walletAddr, TokenType.LONG))
	);

	Logger.info(
		'short token balance:',
		shortBalance,
		'\n',
		'long token balance:',
		longBalance
	);

	const annihilateSize = parseEther(
		Math.min(shortBalance, longBalance).toString()
	);

	if (annihilateSize > 0n) {
		return [pool, annihilateSize];
	} else {
		throw new Error(`No positions to annihilate`);
	}
}

// All options expire at 8 AM UTC.
// Maturities over 2 days expire on a Friday (weekly maturities).
// Maturities over 30 days expire on the last Friday of the calendar month (monthly maturities).
// Max maturity is 1 year.
export function createExpiration(exp: string): number {
	const expirationMoment = moment.utc(exp, 'DDMMMYY');

	// 1.0 check if option expiration is a valid date
	if (!expirationMoment.isValid()) {
		throw new Error(`Invalid expiration date: ${exp}`);
	}

	const today = moment.utc().startOf('day');
	// NOTE: this returns a floor integer value for day (ie 1.9 days -> 1)
	const daysToExpiration = expirationMoment.diff(today, 'days');

	// 1.1 check if option alread expired
	if (daysToExpiration <= 0) {
		throw new Error(`Invalid expiration date: ${exp} is in the past`);
	}

	// 1.2 check if option expiration is more than 1 year out
	if (expirationMoment.diff(today, 'years') > 0) {
		throw new Error(`Invalid expiration date: ${exp} is more then in 1 year`);
	}

	// 2. DAILY OPTIONS: if option expiration is tomorrow or the day after tomorrow, return as vaild
	if (daysToExpiration === 1 || daysToExpiration === 2) {
		// Set time to 8:00 AM
		return expirationMoment.add(8, 'hours').unix();
	}

	// 3. WEEKLY OPTIONS: check if option expiration is Friday
	if (expirationMoment.day() !== 5) {
		throw new Error(`${expirationMoment.toJSON()} is not Friday!`);
	}

	// 4. MONTHLY OPTIONS: if option maturity > 30 days, validate expire is last Friday of the month
	if (daysToExpiration > 30) {
		const lastDay = expirationMoment.clone().endOf('month').startOf('day');
		lastDay.subtract((lastDay.day() + 2) % 7, 'days');

		if (!lastDay.isSame(expirationMoment)) {
			throw new Error(
				`${expirationMoment.toJSON()} is not the last Friday of the month!`
			);
		}
	}

	// Set time to 8:00 AM
	return expirationMoment.unix();
}

export function createPoolKey(
	quote: PublishQuoteRequest | Option,
	expiration?: number
): PoolKey {
	return {
		base:
			process.env.ENV == 'production'
				? arb.tokens[quote.base]
				: arbGoerli.tokens[quote.base],
		quote:
			process.env.ENV == 'production'
				? arb.tokens[quote.quote]
				: arbGoerli.tokens[quote.quote],
		oracleAdapter:
			process.env.ENV == 'production'
				? arb.ChainlinkAdapterProxy
				: arbGoerli.ChainlinkAdapterProxy,
		strike: parseEther(quote.strike.toString()),
		maturity: expiration ? expiration : quote.expiration,
		isCallPool: quote.type === 'C',
	};
}

export function optionExpired(exp: string) {
	const maturity = moment.utc(exp, 'DDMMMYYYY').set({
		hour: 8,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	const maturitySec = maturity.valueOf() / 1000;
	const ts = Math.trunc(new Date().getTime() / 1000);

	return maturitySec < ts;
}

export async function validateBalances(
	tokenBalances: MoralisTokenBalance[],
	collateralToken: string,
	fillQuoteRequests: OrderbookQuoteTradeDeserialized[]
) {
	const [availableTokenBalance, decimals] = tokenBalances
		.filter((tokenBalance) => tokenBalance.symbol === collateralToken)
		.map((tokenBalance) => [
			parseFloat(formatUnits(tokenBalance.balance, tokenBalance.decimals)),
			tokenBalance.decimals,
		])[0];

	// Sums up fillQuoteRequests sizes
	const tradesTotalSize = fillQuoteRequests
		.map((fillQuoteRequest) =>
			parseFloat(formatUnits(fillQuoteRequest.tradeSize, decimals))
		)
		.reduce((sum, x) => sum + x);

	if (availableTokenBalance < tradesTotalSize) {
		throw new Error(`Not enough ${collateralToken} collateral to fill orders`);
	}
}

export function deserializeOrderbookQuote(
	quote: FillableQuote
): OrderbookQuoteTradeDeserialized {
	const deSerializedPoolKey = {
		base: quote.poolKey.base,
		quote: quote.poolKey.quote,
		oracleAdapter: quote.poolKey.oracleAdapter,
		strike: toBigInt(quote.poolKey.strike),
		maturity: toBigInt(quote.poolKey.maturity),
		isCallPool: quote.poolKey.isCallPool,
	};

	return {
		poolKey: deSerializedPoolKey,
		provider: quote.provider,
		taker: quote.taker,
		price: toBigInt(quote.price),
		size: toBigInt(quote.size),
		isBuy: quote.isBuy,
		deadline: toBigInt(quote.deadline),
		salt: toBigInt(quote.salt),
		chainId: quote.chainId,
		signature: quote.signature,
		quoteId: quote.quoteId,
		poolAddress: quote.poolAddress,
		tradeSize: toBigInt(quote.tradeSize),
		fillableSize: toBigInt(quote.fillableSize),
		ts: quote.ts,
	};
}

export function getTokenByAddress(
	tokenObject: TokenAddresses,
	address: string
) {
	const tokenName = Object.keys(tokenObject).find(
		(key) => tokenObject[key] === address
	);
	if (tokenName == undefined) {
		return '';
	}
	return tokenName;
}
