export interface TokenBalance {
	token_address: string;
	symbol: string;
	balance: number | string;
}

export interface MoralisTokenBalance extends TokenBalance {
	name: string;
	logo?: string | undefined;
	thumbnail?: string | undefined;
	decimals: number;
	possible_spam: boolean;
}
export interface NFTBalance {
	token_address: string;
	amount: number;
	name: string;
}

export interface OptionPositions {
	open: NFTBalance[];
	expired: NFTBalance[];
}
