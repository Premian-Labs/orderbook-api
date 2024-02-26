import axios from 'axios'
import { expect } from 'chai'
import { ethers, formatUnits, MaxUint256 } from 'ethers'
import { ISolidStateERC20__factory } from '@premia/v3-abi/typechain'
import { arbitrum, arbitrumGoerli } from '@premia/v3-abi/deployment'

import { checkEnv } from '../config/checkConfig'
import {
	CollateralApprovalResponse,
	PublishQuoteRequest,
	TokenApproval,
} from '../types/validate'
import {
	PostQuotesResponseParsed,
	ReturnedOrderbookQuote,
} from '../types/quote'
import {
	privateKey,
	routerAddr,
	rpcUrl,
	supportedTokens,
} from '../config/constants'
import { RejectedTokenBalance, TokenBalance } from '../types/balances'
import { baseUrl, deployPools, getMaturity, setApproval } from './helpers/utils'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)
const dummyAddr = '0xF51E1DDd22722837414efE08D3d3f2F8c121DFB6'
const collateralTypes = ['USDC']
const quote: PublishQuoteRequest = {
	base: 'WETH',
	quote: 'USDC',
	expiration: getMaturity(),
	strike: 2200,
	type: `P`,
	side: 'ask',
	size: 1,
	price: 0.1,
	deadline: 120,
}

before(async () => {
	console.log(`Setting Collateral Approvals to Max and Deploying Pool(s)`)
	await setApproval(collateralTypes, signer, MaxUint256)
	await deployPools([quote])
	console.log(`Initialization Complete`)
})

describe('Balances, Approvals & Open Orders', () => {
	it('should get option balances returned as float values', async () => {
		// TODO: implement once Moralis introduces ARB testnet support
	})

	it('should get collateral balances', async () => {
		const url = `${baseUrl}/account/collateral_balances`
		interface CollateralBalancesResponse {
			success: TokenBalance[]
			failed: RejectedTokenBalance[]
		}

		const containerBalRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const dummyBalRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				walletAddr: dummyAddr,
			},
		})

		const containerResData =
			containerBalRequest.data as CollateralBalancesResponse
		const dummyResData = dummyBalRequest.data as CollateralBalancesResponse

		expect(containerResData.failed).is.empty
		expect(containerResData.success).is.not.empty
		expect(containerResData.success.map((x) => x.symbol)).deep.eq(
			supportedTokens
		)

		expect(dummyResData.failed).is.empty
		expect(dummyResData.success).is.not.empty
		expect(dummyResData.success.map((x) => x.symbol)).deep.eq(supportedTokens)

		expect(containerResData).not.deep.eq(dummyResData)
	})

	it('should get native balance', async () => {
		const url = `${baseUrl}/account/native_balance`
		const containerNatBalRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const dummyNatBalRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				walletAddr: dummyAddr,
			},
		})

		expect(containerNatBalRequest.data).gte(0)
		expect(dummyNatBalRequest.data).to.gte(0)

		expect(containerNatBalRequest.data).not.deep.eq(dummyNatBalRequest.data)
	})

	it('should set collateral approvals', async () => {
		const provider = new ethers.JsonRpcProvider(rpcUrl)
		const signer = new ethers.Wallet(privateKey, provider)

		const url = `${baseUrl}/account/collateral_approval`
		const approvals: TokenApproval[] = [
			{
				token: 'testWETH',
				amt: 10,
			},
			{
				token: 'USDC',
				amt: 'max',
			},
		]
		const postApprovalsRequest = await axios.post(url, approvals, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const responseData = postApprovalsRequest.data as CollateralApprovalResponse

		expect(responseData.failed).is.empty
		expect(responseData.success).is.not.empty

		for (const approval of approvals) {
			const erc20Addr =
				process.env.ENV == 'production'
					? arbitrum.tokens[approval.token]
					: arbitrumGoerli.tokens[approval.token]
			const erc20 = ISolidStateERC20__factory.connect(erc20Addr, signer)
			const decimals = await erc20.decimals()
			const allowance = await erc20.allowance(signer.address, routerAddr)

			if (approval.amt === 'max') {
				expect(allowance).to.eq(MaxUint256)
			} else {
				expect(parseInt(formatUnits(allowance, Number(decimals)))).is.eq(
					approval.amt
				)
			}
		}
	})

	it('should get open orders', async () => {
		const quotesURL = `${baseUrl}/orderbook/quotes`

		const quoteResponse = await axios.post(quotesURL, [quote], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const quotes: PostQuotesResponseParsed = quoteResponse.data

		expect(quotes.failed).is.empty
		expect(quotes.created).is.not.empty

		const ordersURL = `${baseUrl}/account/orders`

		const ordersRequest = await axios.get(ordersURL, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const ordersResponse = ordersRequest.data as ReturnedOrderbookQuote[]
		expect(ordersResponse).to.include.deep.members(quotes.created)

		const dummyOrdersRequest = await axios.get(ordersURL, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
			params: {
				walletAddr: dummyAddr,
			},
		})

		const dummyOrdersResponse =
			dummyOrdersRequest.data as ReturnedOrderbookQuote[]
		expect(dummyOrdersResponse).is.empty
	})
})
