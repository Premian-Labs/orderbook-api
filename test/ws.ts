import { expect } from 'chai'
import { WebSocket } from 'ws'
import { checkEnv } from '../src/config/checkConfig'

// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const url = `ws://localhost:${process.env.HTTP_PORT}`
const wsConnection = new WebSocket(url)

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('test WS connectivity', () => {
	it('should connect to ws', async () => {
		let infoMessage = ''
		const authMsg = {
			type: 'AUTH',
			apiKey: process.env.TESTNET_ORDERBOOK_API_KEY,
			body: null,
		}

		wsConnection.on('message', (data) => {
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
		})

		await delay(500)
		expect(wsConnection.readyState === wsConnection.OPEN).to.be.true

		wsConnection.send(JSON.stringify(authMsg))
		await delay(500)
		expect(infoMessage).to.eq(`Session authorized. Subscriptions enabled.`)
	})

	it('should prevent unauthorised access ws')

})

describe('WS streaming', () => {
	it('should request quote and subscribe on private & public Quotes stream')
	it('should be able to unsubscribe from Quotes stream ws')
})

describe('RFQ WS flow', () => {
	it('should be able to publish and receive rfq stream via ws')
})