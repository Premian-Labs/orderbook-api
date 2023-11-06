import { expect } from 'chai'
import { RawData, WebSocket } from 'ws'
import { checkEnv } from '../src/config/checkConfig'
import {ethers, Wallet, ZeroAddress} from 'ethers'
import {chainId, privateKey, rpcUrl} from '../src/config/constants'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const provider = new ethers.JsonRpcProvider(rpcUrl)
const url = `ws://localhost:${process.env.HTTP_PORT}`
const wsConnection = new WebSocket(url)
const deployer = new Wallet(privateKey, provider)

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// after("closing WS connection", () => {
// 	wsConnection.close()
// })

// TODO: add WS typings
describe('test WS connectivity', () => {
	it('should connect to WS url', async () => {
		await delay(500)
		expect(wsConnection.readyState).to.eq(wsConnection.OPEN)
	})

	it('should prevent unauthorised access to ws', async () => {
		let errorMessage = ''
		let subscriptionMessage = ''
		const authMsg = {
			type: 'AUTH',
			apiKey: 'DUMMY_KEY',
			body: null,
		}

		let wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
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

		const webSocketFilter = {
			type: 'FILTER',
			channel: 'QUOTES',
			body: {
				chainId: chainId,
				taker: deployer.address.toLowerCase(),
			},
		}

		wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
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
		const authMsg = {
			type: 'AUTH',
			apiKey: process.env.TESTNET_ORDERBOOK_API_KEY,
			body: null,
		}

		const wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
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
		const webSocketFilter = {
			type: 'FILTER',
			channel: 'QUOTES',
			body: {
				chainId: chainId,
				taker: deployer.address.toLowerCase(),
			},
		}
		const wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
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

		const rfqRequest = {
			type: 'RFQ',
			body: {
				poolAddress: '0x770f9e3eb81ed29491a2efdcfa2edd34fdd24a72', // dummy address
				side: 'ask',
				chainId: chainId,
				size: '1000000000000000',
				taker: deployer.address.toLowerCase(),
			},
		}

		const RFQChannelKey = `rfq:${rfqRequest.body.chainId}:${rfqRequest.body.poolAddress}:${rfqRequest.body.side}:${rfqRequest.body.taker}`

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
		const msg = {
			type: 'UNSUBSCRIBE',
			channel: 'QUOTES',
			body: null,
		}
		const wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
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
		const webSocketFilter = {
			type: 'FILTER',
			channel: 'RFQ',
			body: {
				chainId: chainId,
			},
		}
		// params to broadcast rfq request
		const rfqRequest = {
			type: 'RFQ',
			body: {
				poolAddress: '0x770f9e3eb81ed29491a2efdcfa2edd34fdd24a72', // dummy lowercased address
				side: 'bid',
				chainId: chainId,
				size: '1000000000000000',
				taker: deployer.address.toLowerCase(),
			},
		}

		const wsCallback = (data: RawData) => {
			const message = JSON.parse(data.toString())
			switch (message.type) {
				case 'RFQ': {
					// expect to receive broadcast rfq request
					expect(message).deep.eq(rfqRequest)
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
		const RFQChannelKey = `rfq:${rfqRequest.body.chainId}:${rfqRequest.body.poolAddress}:${rfqRequest.body.side}:${rfqRequest.body.taker}`
		expect(infoMessages[1]).eq(
			`Published RFQ to ${RFQChannelKey} Redis channel`
		)
	})
})
