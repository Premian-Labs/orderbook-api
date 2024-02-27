import { expect } from 'chai'
import { RawData, WebSocket } from 'ws'
import { ethers, Wallet, ZeroAddress } from 'ethers'

import { checkEnv } from '../config/checkConfig'
import { chainId, privateKey, rpcUrl } from '../config/constants'
import {
	AuthMessage,
	ErrorMessage,
	FilterMessage,
	InfoMessage,
	RFQMessage,
	RFQMessageParsed,
	UnsubscribeMessage,
} from '../types/ws'
import {
	createExpiration,
	createPoolKey,
	mapRFQMessage,
} from '../helpers/create'
import { PublishQuoteRequest } from '../types/validate'
import { PoolKeySerialized } from '../types/quote'
import { baseUrl, delay, deployPools, getMaturity } from './helpers/utils'
import axios from 'axios'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const provider = new ethers.JsonRpcProvider(rpcUrl)
const url = `ws://localhost:${process.env.HTTP_PORT}`
const wsConnection = new WebSocket(url)
const deployer = new Wallet(privateKey, provider)

const quote: PublishQuoteRequest = {
	base: 'testWETH',
	quote: 'USDC',
	expiration: getMaturity(),
	strike: 2200,
	type: `C`,
	side: 'ask',
	size: 1,
	price: 0.1,
	deadline: 120,
}

let poolAddress: string

before(async () => {
	const deployment = await deployPools([quote])

	// get pool address (used for redis key)
	if (deployment.created.length > 0) {
		poolAddress = deployment.created[0].poolAddress
	} else if (deployment.existed.length > 0) {
		poolAddress = deployment.existed[0].poolAddress
	} else {
		console.log(`Failed to deploy pool!`)
	}

	poolAddress = poolAddress.toLowerCase()
})

describe('test WS connectivity', () => {
	it('should connect to WS url', async () => {
		await delay(500)
		expect(wsConnection.readyState).to.eq(wsConnection.OPEN)
	})

	it('should prevent unauthorised access to ws', async () => {
		let errorMessage = ''
		let subscriptionMessage = ''
		const authMsg: AuthMessage = {
			type: 'AUTH',
			apiKey: 'DUMMY_KEY',
			body: null,
		}

		let wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessage = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'ERROR': {
					errorMessage = message.message
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)
		wsConnection.send(JSON.stringify(authMsg))
		await delay(2000)
		wsConnection.off('message', wsCallback)
		expect(errorMessage).to.eq(`NOT_FOUND`)

		const webSocketFilter: FilterMessage = {
			type: 'FILTER',
			channel: 'QUOTES',
			body: {
				chainId: chainId,
				taker: deployer.address.toLowerCase(),
			},
		}

		wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessage = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'ERROR': {
					subscriptionMessage = message.message
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)
		wsConnection.send(JSON.stringify(webSocketFilter))
		await delay(2000)
		wsConnection.off('message', wsCallback)
		expect(subscriptionMessage).to.eq(`Not Authorized`)
	})

	it('should authorise to ws API', async () => {
		let infoMessage = ''
		const authMsg: AuthMessage = {
			type: 'AUTH',
			apiKey: process.env.TESTNET_ORDERBOOK_API_KEY!,
			body: null,
		}

		const wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessage = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'INFO': {
					infoMessage = message.message
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)
		wsConnection.send(JSON.stringify(authMsg))
		await delay(2000)
		wsConnection.off('message', wsCallback)
		expect(infoMessage).to.eq(`Session authorized. Subscriptions enabled.`)
	})
})

describe('WS streaming', () => {
	it('should request quote and subscribe on private & public Quotes stream', async () => {
		let infoMessages: string[] = []

		// listen to public quotes AND private quotes (since we provide takerAddress)
		const webSocketFilter: FilterMessage = {
			type: 'FILTER',
			channel: 'QUOTES',
			body: {
				chainId: chainId,
				taker: deployer.address.toLowerCase(),
			},
		}
		const wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessage = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'INFO': {
					infoMessages.push(message.message)
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)
		wsConnection.send(JSON.stringify(webSocketFilter))
		await delay(2000)
		expect(infoMessages[0]).to.eq(
			`Subscribed to quotes:${webSocketFilter.body.chainId}:*:*:${ZeroAddress},quotes:${webSocketFilter.body.chainId}:*:*:${webSocketFilter.body.taker} channel.`
		)

		// generate an rfq request
		const getRFQMessage = await axios.get(`${baseUrl}/rfq/message`, {
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

		const rfqRequest = getRFQMessage.data as RFQMessage

		const RFQChannelKey = `rfq:${rfqRequest.body.chainId}:${poolAddress}:${rfqRequest.body.side}:${rfqRequest.body.taker}`

		// request a quote
		wsConnection.send(JSON.stringify(rfqRequest))
		await delay(2000)
		wsConnection.off('message', wsCallback)
		expect(infoMessages[1]).to.eq(
			`Published RFQ to ${RFQChannelKey} Redis channel`
		)
	})

	it('should be able to unsubscribe from Quotes stream', async () => {
		let infoMessage = ''
		const msg: UnsubscribeMessage = {
			type: 'UNSUBSCRIBE',
			channel: 'QUOTES',
			body: null,
		}
		const wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessage = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'INFO': {
					infoMessage = message.message
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)
		wsConnection.send(JSON.stringify(msg))
		await delay(2000)
		wsConnection.off('message', wsCallback)
		expect(infoMessage).to.eq('Unsubscribed from QUOTES channel')
	})
})

describe('RFQ WS flow', () => {
	it('should be able to publish and receive rfq stream via ws', async () => {
		let actionChecks: string[] = []
		let infoMessages: string[] = []
		// params to listen to rfq requests
		const webSocketFilter: FilterMessage = {
			type: 'FILTER',
			channel: 'RFQ',
			body: {
				chainId: chainId,
			},
		}

		// generate an rfq request
		const getRFQMessage = await axios.get(`${baseUrl}/rfq/message`, {
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
				direction: 'sell',
			},
		})

		const rfqRequest = getRFQMessage.data as RFQMessage

		const wsCallback = (data: RawData) => {
			const message: InfoMessage | ErrorMessage | RFQMessageParsed = JSON.parse(
				data.toString()
			)
			switch (message.type) {
				case 'RFQ': {
					// expect to receive broadcast rfq request
					expect(message.body).deep.eq(mapRFQMessage(rfqRequest.body))
					actionChecks.push('RFQ')
					break
				}
				case 'INFO': {
					// first INFO message will be confirmation of RFQ subscription
					// second INFO message will be confirmation of PUBLISHING RFQ message
					infoMessages.push(message.message)
					actionChecks.push('PUBLISHED')
					break
				}
				default: {
					throw `Wrong message type ${message.type}`
				}
			}
		}

		wsConnection.on('message', wsCallback)

		wsConnection.send(JSON.stringify(webSocketFilter))
		await delay(2000)
		wsConnection.send(JSON.stringify(rfqRequest))
		await delay(2000)

		wsConnection.off('message', wsCallback)
		wsConnection.close()

		expect(actionChecks.includes('PUBLISHED')).to.be.true
		expect(actionChecks.includes('RFQ')).to.be.true

		expect(infoMessages[0]).eq('Subscribed to rfq:421613:*:*:* channel.')
		const RFQChannelKey = `rfq:${rfqRequest.body.chainId}:${poolAddress}:${rfqRequest.body.side}:${rfqRequest.body.taker}`
		expect(infoMessages[1]).eq(
			`Published RFQ to ${RFQChannelKey} Redis channel`
		)
	})
})
