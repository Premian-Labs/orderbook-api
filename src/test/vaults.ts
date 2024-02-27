import axios from 'axios'
import { expect } from 'chai'

import { baseUrl, getMaturity } from './helpers/utils'
import { VaultQuoteResponse } from '../types/validate'

const vaultQuoteUrl = `${baseUrl}/vaults/quote`

/*
IMPORTANT: Due to lack of testnet coverage for vaults,  vault testing is done using
production env (MAINNET) and only read operations are done for vaults.
 */
if (process.env.ENV !== 'production')
	throw new Error(`Vault test need to use production env`)

describe('Vault Quotes', () => {
	it('should return a valid quote for a call option', async () => {
		const getCallVaultQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'C',
				size: 1,
				direction: 'buy',
			},
		})

		const callVaultQuoteResponse = getCallVaultQuote.data as VaultQuoteResponse

		expect(typeof callVaultQuoteResponse).to.equal('object')
		expect(Object.keys(callVaultQuoteResponse)).deep.equal([
			'market',
			'quote',
			'takerFee',
		])
		expect(typeof callVaultQuoteResponse.quote).to.equal('number')
		expect(callVaultQuoteResponse.quote).to.be.gt(0)
		expect(typeof callVaultQuoteResponse.takerFee).to.equal('number')
		expect(callVaultQuoteResponse.quote).to.be.gt(0)
	})

	it('should return a valid quote for a put option', async () => {
		const getPutVaulteQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'P',
				size: 1,
				direction: 'buy',
			},
		})

		const putVaultQuoteResponse = getPutVaulteQuote.data as VaultQuoteResponse

		expect(typeof putVaultQuoteResponse).to.equal('object')
		expect(Object.keys(putVaultQuoteResponse)).deep.equal([
			'market',
			'quote',
			'takerFee',
		])
		expect(typeof putVaultQuoteResponse.quote).to.equal('number')
		expect(putVaultQuoteResponse.quote).to.be.gt(0)
		expect(typeof putVaultQuoteResponse.takerFee).to.equal('number')
		expect(putVaultQuoteResponse.quote).to.be.gt(0)
	})

	it('should reject out of delta bounds query', async () => {
		const getInvalidVaulteQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 100,
				type: 'P',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		expect(getInvalidVaulteQuote.status).to.eq(400)
		expect(getInvalidVaulteQuote.data.message).to.eq(
			'execution reverted: Vault__OutOfDeltaBounds()'
		)
	})

	// NOTE: This validation covers BOTH vaults/quote & rfq/request as they share the same validation check
	it('should reject bad param schema', async () => {
		const invalidBaseQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'ABCD',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'P',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidQuoteQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'WNTC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'P',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidExpQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: '01JAN23',
				strike: 2900,
				type: 'P',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidStrikeQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 'XXX',
				type: 'P',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidTypeQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'p',
				size: 1,
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidSizeQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'P',
				size: 'ten',
				direction: 'buy',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		const invalidDirectionQuote = await axios.get(vaultQuoteUrl, {
			headers: {
				'x-apikey': process.env.MAINNET_ORDERBOOK_API_KEY,
			},
			params: {
				base: 'WETH',
				quote: 'USDC',
				expiration: getMaturity(),
				strike: 2900,
				type: 'P',
				size: 1,
				direction: 'long',
			},
			validateStatus: function (status) {
				return status <= 500
			},
		})

		expect(invalidBaseQuote.status).to.eq(400)
		expect(invalidQuoteQuote.status).to.eq(400)
		expect(invalidExpQuote.status).to.eq(400)
		expect(invalidStrikeQuote.status).to.eq(400)
		expect(invalidTypeQuote.status).to.eq(400)
		expect(invalidSizeQuote.status).to.eq(400)
		expect(invalidDirectionQuote.status).to.eq(400)

		expect(invalidBaseQuote.data[0].message.startsWith('must match pattern')).to
			.be.true
		expect(invalidQuoteQuote.data[0].message.startsWith('must match pattern'))
			.to.be.true
		expect(invalidExpQuote.data.message.startsWith('Invalid expiration date'))
			.to.be.true
		expect(
			invalidStrikeQuote.data[0].message.startsWith(
				'must match pattern "^[0-9]{1,}([.][0-9]*)?$"'
			)
		).to.be.true
		expect(
			invalidTypeQuote.data[0].message.startsWith(
				'must match pattern "^C$|^P$"'
			)
		).to.be.true
		expect(
			invalidSizeQuote.data[0].message.startsWith(
				'must match pattern "^[0-9]{1,}([.][0-9]*)?$"'
			)
		).to.be.true
		expect(
			invalidDirectionQuote.data[0].message.startsWith(
				'must match pattern "^buy$|^sell$"'
			)
		).to.be.true
	})
})
