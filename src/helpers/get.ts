import { PoolKey, TokenAddresses } from '../types/quote';
import { Contract } from 'ethers';
import Logger from '../lib/logger';
import PoolFactoryABI from '../abi/IPoolFactory.json';
import { provider } from '../config/constants';
import arb from '../config/arbitrum.json';
import arbGoerli from '../config/arbitrumGoerli.json';

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
