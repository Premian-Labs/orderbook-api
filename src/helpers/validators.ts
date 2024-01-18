import Ajv from 'ajv'
import arb from '../config/arbitrum.json'
import arbGoerli from '../config/arbitrumGoerli.json'

const ajv = new Ajv()
const chainConfig = process.env.ENV == 'production' ? arb : arbGoerli
const supportedTokens = Object.keys(chainConfig.tokens)

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
	maxItems: 200,
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
			pattern: '^\\d+$',
		},
		type: {
			type: 'string',
			pattern: '^C$|^P$',
		},
		size: {
			type: 'string',
			pattern: '^\\d+$',
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
			pattern: '^[0-9]*$',
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
		}
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
				base: {
					type: 'string',
					pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
				},
				quote: {
					type: 'string',
					pattern: supportedTokens.map((token) => `^${token}$`).join('|'),
				},
			},
			required: ['base', 'quote'],
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
