import dotenv from 'dotenv';
import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig';

dotenv.config();
// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true);

const url = `https://localhost:${process.env.HTTP_PORT}`
describe("Balances, Approvals & Open Orders", () => {
	it('should get option balances returned as float values', async () => {
	});

	it('should get open orders', async () => {
	});

	it('should get collateral balances', async () => {
	});

	it('should get native balances', async () => {
	});

	it('should set collateral approvals', async () => {
	});
})