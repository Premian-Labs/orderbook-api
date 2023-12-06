import { OrderbookQuote, PoolKeySerialized } from './quote'

export type ChannelType = 'QUOTES' | 'RFQ'

export interface FilterMessage {
	type: 'FILTER'
	channel: ChannelType
	body: {
		poolAddress?: string
		side?: 'bid' | 'ask'
		chainId: string
		// bigInt string representation
		size?: string
		taker?: string
		provider?: string
	}
}

export interface UnsubscribeMessage {
	type: 'UNSUBSCRIBE'
	channel: ChannelType
	body: null
}

export interface AuthMessage {
	type: 'AUTH'
	apiKey: string
	body: null
}

export interface RFQMessage {
	type: 'RFQ'
	body: {
		poolKey: PoolKeySerialized
		side: 'bid' | 'ask'
		chainId: string
		// bigInt string representation
		size: string
		taker: string
	}
}

export interface InfoMessage {
	type: 'INFO'
	body: null
	message: string
}

export interface ErrorMessage {
	type: 'ERROR'
	body: null
	message: string
}

export interface PostQuoteMessage {
	type: 'POST_QUOTE'
	body: OrderbookQuote
}

export interface FillQuoteMessage {
	type: 'FILL_QUOTE'
	body: OrderbookQuote
	size: string
}

export interface DeleteQuoteMessage {
	type: 'DELETE_QUOTE'
	body: OrderbookQuote
}
