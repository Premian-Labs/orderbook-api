import Ajv from 'ajv';
import arb from '../config/arbitrum.json';
import arbGoerli from '../config/arbitrumGoerli.json';

const ajv = new Ajv();
const chainConfig = process.env.ENV == 'production' ? arb : arbGoerli;
const supportedTokens = Object.keys(chainConfig.tokens);

export const validatePostQuotes = ajv.compile({
	type: 'array',
	items: {
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
			strike: { type: 'number' },
			type: {
				type: 'string',
				pattern: '^C$|^P$',
			},
			side: {
				type: 'string',
				pattern: '^buy$|^sell$',
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
	maxItems: 1000,
});

export const validatePositionManagement = ajv.compile({
	type: 'array',
	items: {
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
			strike: { type: 'number' },
			type: {
				type: 'string',
				pattern: '^C$|^P$',
			},
		},
		required: ['base', 'quote', 'expiration', 'strike', 'type'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 1000,
});

//TODO convert fillquote to match QuoteOBMessage type + PoolKey
export const validateFillQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			quoteId: {
				type: 'string',
				pattern: '[a-fA-F0-9]{64}$',
			},
			size: {
				type: 'string',
				pattern: '^[0-9]*$',
			},
		},
		required: ['quoteId', 'size'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 1000,
});

// TODO: remove poolAddress and instead pass in poolKey
export const validateDeleteQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			poolAddress: {
				type: 'string',
				pattern: '^0x[a-fA-F0-9]{40}$',
			},
			quoteId: {
				type: 'string',
				pattern: '[a-fA-F0-9]{64}$',
			},
		},
		required: ['poolAddress', 'quoteId'],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 1000,
});

export const validateGetFillableQuotes = ajv.compile({
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
		chainId: {
			type: 'string',
			pattern: '^42161$|^421613$',
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
	required: ['poolAddress', 'size', 'side', 'chainId'],
	additionalProperties: false,
});

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
		chainId: {
			type: 'string',
			pattern: '^42161$|^421613$',
		},
		provider: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
	},
	required: ['chainId'],
	additionalProperties: false,
});

export const validateGetRFQQuotes = ajv.compile({
	type: 'object',
	properties: {
		poolAddress: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
		side: {
			type: 'string',
			pattern: '^bid$|^ask$',
		},
		chainId: {
			type: 'string',
			pattern: '^42161$|^421613$',
		},
		taker: {
			type: 'string',
			pattern: '^0x[a-fA-F0-9]{40}$',
		},
	},
	required: ['poolAddress', 'side', 'taker', 'chainId'],
	additionalProperties: false,
});

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
});
