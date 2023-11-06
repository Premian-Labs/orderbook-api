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
    poolAddress: string
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
