import dotenv from 'dotenv'
import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig'

dotenv.config()
// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const url = `http://localhost:${process.env.HTTP_PORT}`
describe('Balances, Approvals & Open Orders', () => {
	// TODO: implement once Moralis introduces ARB Sepiola support
	it('should get option balances returned as float values', async () => {})

	// assert no failed queries and WETH, USDC balances > 0
	it('should get collateral balances', async () => {})

	// response > 0
	it('should get native balances', async () => {})

	// check allowanse max and number
	it('should set collateral approvals', async () => {})

	// first, allowance in the prvious test must be set
	// then, POST the quote here
	it('should get open orders', async () => {})

})
