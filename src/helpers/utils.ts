import { PoolKey, Option, TokenType, PublishQuoteRequest } from './types';
import { Contract, formatEther, parseEther } from 'ethers';
import Logger from '../lib/logger';
import PoolFactoryABI from '../abi/IPoolFactory.json';
import { provider, signer, walletAddr } from '../index';
import arb from '../config/arbitrum.json';
import arbGoerli from '../config/arbitrumGoerli.json';
import moment from 'moment/moment';
import { IPool__factory } from '../typechain';

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
	const strExp = expOption.expiration as string

	// 1. verified the option has expired
	const optionHasExpired = optionExpired(strExp)
	if (!optionHasExpired){
		throw new Error ('Option has not expired')
	}
	// 2. validate and convert option exp to timestamp
	expOption.expiration = createExpiration(strExp);

	// 3. check that there is a balance for the option being settled/exercised
	const poolKey: PoolKey = createPoolKey(expOption)
	const poolAddr = await getPoolAddress(poolKey);
	const pool = IPool__factory.connect(poolAddr, signer);
	const balance = await pool.balanceOf(walletAddr, tokenType);
	Logger.info(`${tokenType === 0 ? 'Short' : 'Long'} Balance: `, formatEther(balance));

	//TODO: verify that a zero balance indeed comes as 0n
	if (balance === 0n) {
		throw new Error ('No balance to settle')
	}

	return pool
}

export async function annihilateOptions(annihilateOptions: Option[]) {
	for (const option of annihilateOptions) {
		// TODO: use moment to validate expiration and create timestamp
		const expirationMoment = moment(option.expiration, 'DD-mm-YY');

		// Create Pool Key
		const poolKey: PoolKey = {
			base:
				process.env.ENV == 'production'
					? arb.tokens[option.base]
					: arbGoerli.tokens[option.base],
			quote:
				process.env.ENV == 'production'
					? arb.tokens[option.quote]
					: arbGoerli.tokens[option.quote],
			oracleAdapter:
				process.env.ENV == 'production'
					? arb.ChainlinkAdapterProxy
					: arbGoerli.ChainlinkAdapterProxy,
			strike: parseEther(option.strike.toString()),
			maturity: expirationMoment.unix(),
			isCallPool: option.type === 'C',
		};

		// Get PoolAddress
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
			const annihilateTx = await pool.annihilate(annihilateSize, {
				gasLimit: 1400000,
			});
			await provider.waitForTransaction(annihilateTx.hash, 1);
		} else {
			throw new Error(`No positions to annihilate: ${option}`);
		}
	}
}

export function createExpiration(exp: string): number {
	const expirationMoment = moment.utc(exp, 'DDMMMYY');

	// 1. check if option expiration is a valid date
	if (!expirationMoment.isValid()) {
		throw new Error(`Invalid expiration date: ${exp}`);
	}

	// 2. check if option expiration is Friday
	if (expirationMoment.day() !== 5) {
		throw new Error(`${expirationMoment.toJSON()} is not Friday!`);
	}

	// 3. if option maturity > 30 days, validate expire is last Friday of the month
	const daysToExpiration = expirationMoment.diff(
		moment().startOf('day'),
		'days'
	);

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
	return expirationMoment.add(8, 'hours').unix();
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
		maturity: expiration ? expiration: quote.expiration,
		isCallPool: quote.type === 'C',
	};
}

export function optionExpired ( exp: string) {
	const maturity = moment.utc(exp, 'DDMMMYYYY').set({
		hour: 8,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	const maturitySec = maturity.valueOf() / 1000;
	const ts = Math.trunc(new Date().getTime() / 1000);

	return maturitySec < ts
}
