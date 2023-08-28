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

export async function processExpiredOptions(
	expiredOptions: Option[],
	type: number
) {
	for (const expOption of expiredOptions) {
		// TODO: validate that option has expired
		// TODO: use moment to validate expiration and create timestamp
		const expirationMoment = moment(expOption.expiration, 'DD-mm-YY');

		// Create Pool Key
		const poolKey: PoolKey = {
			base:
				process.env.ENV == 'production'
					? arb.tokens[expOption.base]
					: arbGoerli.tokens[expOption.base],
			quote:
				process.env.ENV == 'production'
					? arb.tokens[expOption.quote]
					: arbGoerli.tokens[expOption.quote],
			oracleAdapter:
				process.env.ENV == 'production'
					? arb.ChainlinkAdapterProxy
					: arbGoerli.ChainlinkAdapterProxy,
			strike: parseEther(expOption.strike.toString()),
			maturity: expirationMoment.unix(),
			isCallPool: expOption.type === 'C',
		};

		// Get PoolAddress
		const poolAddr = await getPoolAddress(poolKey);

		const pool = IPool__factory.connect(poolAddr, signer);
		const balance = await pool.balanceOf(walletAddr, type);
		const side = type === 0 ? 'Short' : 'Long';
		Logger.info(`${side} Balance: `, formatEther(balance));

		const settleTx = await pool.settle();
		await provider.waitForTransaction(settleTx.hash, 1);
	}
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
	quote: PublishQuoteRequest,
	expiration: number
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
		maturity: expiration,
		isCallPool: quote.type === 'C',
	};
}
