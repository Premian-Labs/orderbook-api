import dotenv from 'dotenv'
import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig'
import { PublishQuoteRequest, TokenApproval } from '../src/types/validate'
import {
	InvalidOrderbookQuote,
	ReturnedOrderbookQuote,
} from '../src/types/quote'
import { availableTokens, privateKey, rpcUrl } from '../src/config/constants'
import { expect } from 'chai'
import { RejectedTokenBalance, TokenBalance } from '../src/types/balances'
import arb from '../src/config/arbitrum.json'
import arbGoerli from '../src/config/arbitrumGoerli.json'
import { ISolidStateERC20__factory } from '../src/typechain'
import { ethers, formatEther } from 'ethers'

dotenv.config()
// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const baseUrl = `http://localhost:${process.env.HTTP_PORT}`
describe('Balances, Approvals & Open Orders', () => {
	// TODO: implement once Moralis introduces ARB Sepiola support
	it('should get option balances returned as float values', async () => {})

	// assert no failed queries and WETH, USDC balances > 0
	it('should get collateral balances', async () => {
		const url = `${baseUrl}/account/collateral_balances`
		const getCollateralBalancesRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		interface CollateralBalancesResponse {
			success: TokenBalance[]
			failed: RejectedTokenBalance[]
		}

		const responseData =
			getCollateralBalancesRequest.data as CollateralBalancesResponse

		expect(responseData.failed).is.empty
		expect(responseData.success).is.not.empty
		expect(responseData.success.map((x) => x.symbol)).deep.eq(availableTokens)
	})

	// response > 0
	it('should get native balances', async () => {
		const url = `${baseUrl}/account/native_balance`
		const getNativeBalanceRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		expect(getNativeBalanceRequest.data).gt(0)
	})

	// check allowance max and number
	it('should set collateral approvals', async () => {
		const provider = new ethers.JsonRpcProvider(rpcUrl)
		const signer = new ethers.Wallet(privateKey, provider)

		const url = `${baseUrl}/account/collateral_approval`
		const approvals: TokenApproval[] = [
			{
				token: 'WETH',
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

		interface CollateralApprovalResponse {
			success: TokenApproval[]
			failed: any[]
		}

		const responseData = postApprovalsRequest.data as CollateralApprovalResponse
		console.log(JSON.stringify(responseData))

		expect(responseData.failed).is.empty
		expect(responseData.success).is.not.empty

		for (const approval of approvals) {
			const erc20Addr =
				process.env.ENV == 'production'
					? arb.tokens[approval.token]
					: arbGoerli.tokens[approval.token]
			const erc20 = ISolidStateERC20__factory.connect(erc20Addr, signer)
			const allowance = await erc20.allowance.staticCall(
				signer.address,
				signer.address
			)

			expect(parseInt(formatEther(allowance))).is.eq(approval.amt)
		}
	})

	// first, allowance in the previous test must be set
	// then, POST the quote here
	it('should get open orders', async () => {
		const quote: PublishQuoteRequest = {
			base: 'WETH',
			quote: 'USDC',
			expiration: `17NOV23`,
			strike: 1800,
			type: `P`,
			side: 'ask',
			size: 1,
			price: 0.1,
			deadline: 120,
		}

		const quotesURL = `${baseUrl}/orderbook/quotes`
		// post quote to cancel
		const quoteResponse = await axios.post(quotesURL, [quote], {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})
		interface PostQuotesParsedResponse {
			created: ReturnedOrderbookQuote[]
			failed: {
				reason: string
				quote: InvalidOrderbookQuote
			}[]
			exists: ReturnedOrderbookQuote[]
		}

		const quotes: PostQuotesParsedResponse = quoteResponse.data
		expect(quotes.failed).is.empty
		expect(quotes.created).is.not.empty

		const ordersURL = `${baseUrl}/account/orders`
		// post quote to cancel
		const ordersRequest = await axios.get(ordersURL, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		const ordersResponse = ordersRequest.data as ReturnedOrderbookQuote
		expect(ordersResponse).to.include.deep.members(quotes.created)
	})
})
