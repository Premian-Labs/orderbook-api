import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig'
import { PublishQuoteRequest, TokenApproval } from '../src/types/validate'
import {
	PostQuotesResponseParsed,
	ReturnedOrderbookQuote,
} from '../src/types/quote'
import {
	availableTokens,
	privateKey,
	routerAddress,
	rpcUrl,
} from '../src/config/constants'
import { expect } from 'chai'
import { RejectedTokenBalance, TokenBalance } from '../src/types/balances'
import arb from '../src/config/arbitrum.json'
import arbGoerli from '../src/config/arbitrumGoerli.json'
import { ISolidStateERC20__factory } from '@premia/v3-abi/typechain'
import { ethers, formatUnits, MaxUint256 } from 'ethers'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const baseUrl = `http://localhost:${process.env.HTTP_PORT}`
describe('Balances, Approvals & Open Orders', () => {
	it('should get option balances returned as float values', async () => {
		// TODO: implement once Moralis introduces ARB testnet support
	})

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

	it('should get native balance', async () => {
		const url = `${baseUrl}/account/native_balance`
		const getNativeBalanceRequest = await axios.get(url, {
			headers: {
				'x-apikey': process.env.TESTNET_ORDERBOOK_API_KEY,
			},
		})

		expect(getNativeBalanceRequest.data).gt(0)
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

		interface CollateralApprovalResponse {
			success: TokenApproval[]
			failed: any[]
		}

		const responseData = postApprovalsRequest.data as CollateralApprovalResponse

		expect(responseData.failed).is.empty
		expect(responseData.success).is.not.empty

		for (const approval of approvals) {
			const erc20Addr =
				process.env.ENV == 'production'
					? arb.tokens[approval.token]
					: arbGoerli.tokens[approval.token]
			const erc20 = ISolidStateERC20__factory.connect(erc20Addr, signer)
			const decimals = await erc20.decimals()
			const allowance = await erc20.allowance(signer.address, routerAddress)

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
		const quote: PublishQuoteRequest = {
			base: 'WETH',
			quote: 'USDC',
			expiration: `29DEC23`,
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

		const quotes: PostQuotesResponseParsed = quoteResponse.data

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
