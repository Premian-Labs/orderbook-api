import { PoolKey } from './types';
import { Contract, JsonRpcProvider, ZeroAddress } from 'ethers';
import Logger from '../lib/logger';
import PoolFactoryABI from '../abi/IPoolFactory.json';

const provider = new JsonRpcProvider(process.env.WEB3_RPC_URL);
const poolFactory = new Contract(
	process.env.POOL_FACTORY_ADDRESS!,
	PoolFactoryABI,
	provider
);

const poolMap: Map<PoolKey, string> = new Map();
export async function getPoolAddress(poolKey: PoolKey) {
	const memPoolAddress = poolMap.get(poolKey);
	if (memPoolAddress) return memPoolAddress;

	let poolAddress: string;

	try {
		[poolAddress] = await poolFactory.getPoolAddress(poolKey);
	} catch (e) {
		try {
			[poolAddress] = await poolFactory.getPoolAddress(poolKey);
		} catch (e) {
			Logger.error(`Can not get pool address: ${JSON.stringify(e)}`);
			throw new Error(`Can not get pool address`);
		}
	}
	poolAddress = poolAddress.toLowerCase();
	if (poolAddress === ZeroAddress) {
		Logger.warn(`Pool is not deployable: ${JSON.stringify(poolKey)}`);
		throw new Error(`Pool is not deployable`);
	}
	poolMap.set(poolKey, poolAddress);
	return poolAddress;
}
