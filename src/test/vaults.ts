import axios from 'axios'
import { expect } from 'chai'

import { checkEnv } from '../config/checkConfig'
import { baseUrl, getMaturity } from './helpers/utils'
import { isArray } from 'lodash'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const vaultQuoteUrl = `${baseUrl}/vaults/quote`
const vaultTradeUrl = `${baseUrl}/vaults/trade`

//TODO: implement once sepolia migration is complete
describe('Vault Quotes', () => {
	it('should return a valid quote', async () => {})

	it('should reject queries with wrong AJV schemas', async () => {})

	it('should reject queries for non existing vaults', async () => {})

	it('should reject a request with a bad option expiration', async () => {})
})

describe('Vault Trade', () => {
	it('should return a valid quote', async () => {})

	it('should reject trade attempt with wrong AJV schemas', async () => {})

	it('should reject trade attempt if premiumLimit is missing', async () => {})

	it('should reject trade attempt for non existing vault', async () => {})

	it('should reject trade attempt with a bad option expiration', async () => {})
})
