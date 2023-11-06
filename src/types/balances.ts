export interface TokenBalance {
	token_address: string
	symbol: string
	balance: number | string
}
export interface NFTBalance {
	token_address: string
	amount: number
	name: string
	exposure: 'SHORT' | 'LONG'
}

export interface OptionPositions {
	open: NFTBalance[]
	expired: NFTBalance[]
}
