import Ajv from 'ajv'

import {
	prodTokens,
	prodTokensWithIVOracles,
	supportedTokens,
} from '../config/constants'

const ajv = new Ajv()

const validateOptionEntity = {
	base: {
		type: 'string',
		pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
	},
	quote: {
		type: 'string',
		pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
	},
	expiration: {
		type: 'string',
		pattern: '^\\d\\d\\w\\w\\w\\d\\d$',
	},
	strike: {
		type: 'number',
		exclusiveMinimum: 0,
	},
	type: {
		type: 'string',
		pattern: '^C$|^P$',
	},
}

export const validatePoolEntity = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			...validateOptionEntity,
		},
		required: ['base', 'quote', 'expiration', 'strike', 'type'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 100,
})

export const validatePostQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			...validateOptionEntity,
			side: {
				type: 'string',
				pattern: '^bid$|^ask$',
			},
			size: { type: 'number' },
			price: { type: 'number' },
			deadline: { type: 'integer' },
			taker: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
		},
		required: [
			'base',
			'quote',
			'expiration',
			'strike',
			'type',
			'side',
			'size',
			'price',
			'deadline',
		],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 500,
})

export const validatePositionManagement = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: validateOptionEntity,
		required: ['base', 'quote', 'expiration', 'strike', 'type'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 1000,
})

export const validateGetBalance = ajv.compile({
	type: 'object',
	properties: {
		walletAddr: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
	},
	required: [],
	additionalProperties: false,
})

export const validateFillQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			tradeSize: {
				type: 'number',
				exclusiveMinimum: 0,
			},
			quoteId: {
				type: 'string',
				pattern: '[a-fA-F0-9]{64}$',
			},
		},
		required: ['tradeSize', 'quoteId'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 25,
})

export const validateDeleteQuotes = ajv.compile({
	type: 'object',
	properties: {
		quoteIds: {
			type: 'array',
			items: {
				type: 'string',
				pattern: '[a-fA-F0-9]{64}$',
			},
			minItems: 1,
			maxItems: 25,
		},
	},
	required: ['quoteIds'],
	additionalProperties: false,
})

export const validateGetFillableQuotes = ajv.compile({
	type: 'object',
	properties: {
		base: {
			type: 'string',
			pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
		},
		quote: {
			type: 'string',
			pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
		},
		expiration: {
			type: 'string',
			pattern: '^\\d\\d\\w\\w\\w\\d\\d$',
		},
		strike: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
		type: {
			type: 'string',
			pattern: '^C$|^P$',
		},
		size: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
		side: {
			type: 'string',
			pattern: '^bid$|^ask$',
		},
		provider: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
		taker: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
	},
	required: ['base', 'quote', 'expiration', 'strike', 'type', 'size', 'side'],
	additionalProperties: false,
})

export const validateGetPools = ajv.compile({
	type: 'object',
	properties: {
		base: {
			type: 'string',
			pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
		},
		quote: {
			type: 'string',
			pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
		},
		expiration: {
			type: 'string',
			pattern: '^\\d\\d\\w\\w\\w\\d\\d$',
		},
	},
	required: [],
	additionalProperties: false,
})

export const validateGetAllQuotes = ajv.compile({
	type: 'object',
	properties: {
		poolAddress: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
		size: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
		side: {
			type: 'string',
			pattern: '^bid$|^ask$',
		},
		provider: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
		type: {
			type: 'string',
			pattern: '^invalid$',
		},
	},
	required: [],
	additionalProperties: false,
})

export const validateApprovals = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			token: {
				type: 'string',
				pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
			},
			amt: {
				oneOf: [{ type: 'number' }, { type: 'string', pattern: '^max$' }],
			},
		},
		required: ['token', 'amt'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: supportedTokens.length,
})

export const validateGetStrikes = ajv.compile({
	oneOf: [
		{
			type: 'object',
			properties: {
				market: {
					type: 'string',
					pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
				},
			},
			required: ['market'],
			additionalProperties: false,
		},
		{
			type: 'object',
			properties: {
				spotPrice: {
					type: 'string',
				},
			},
			required: ['spotPrice'],
			additionalProperties: false,
		},
	],
})

export const validateGetIV = ajv.compile({
	type: 'object',
	properties: {
		market: {
			type: 'string',
			pattern: prodTokensWithIVOracles.map((token) => `^${token}$`).join('|'),
		},
		expiration: {
			type: 'string',
			pattern: '^\\d\\d\\w\\w\\w\\d\\d$',
		},
		spotPrice: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
	},
	required: ['market', 'expiration'],
	additionalProperties: false,
})

export const validateGetSpot = ajv.compile({
	type: 'object',
	properties: {
		markets: {
			type: 'array',
			items: {
				type: 'string',
				pattern: prodTokens.map((token) => `^${token}$`).join('|'),
			},
			minItems: 1,
		},
	},
	required: ['markets'],
	additionalProperties: false,
})

export const validateQuoteRequest = ajv.compile({
	type: 'object',
	properties: {
		...validateOptionEntity,
		//NOTE: strike comes in as a string when passed via GET params, so we override validateOptionEntity
		strike: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
		size: {
			type: 'string',
			pattern: '^[0-9]{1,}([.][0-9]*)?$',
		},
		direction: {
			type: 'string',
			pattern: '^buy$|^sell$',
		},
	},
	required: [
		'base',
		'quote',
		'expiration',
		'strike',
		'type',
		'size',
		'direction',
	],
	additionalProperties: false,
})

export const validateVaultTrade = ajv.compile({
	type: 'object',
	properties: {
		...validateOptionEntity,
		size: { type: 'number' },
		direction: {
			type: 'string',
			pattern: '^buy$|^sell$',
		},
		premiumLimit: { type: 'number' },
	},
	required: [
		'base',
		'quote',
		'expiration',
		'strike',
		'type',
		'size',
		'direction',
		'premiumLimit',
	],
	additionalProperties: false,
})
