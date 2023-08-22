import Ajv from 'ajv';

const ajv = new Ajv();

// Follows the typings of QuoteRequest
export const validatePostQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			poolKey: {
				type: 'object',
				properties: {
					base: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
					quote: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
					oracleAdapter: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
					strike: { type: 'string' },
					maturity: { type: 'integer' },
					isCallPool: { type: 'boolean' },
				},
				required: [
					'base',
					'quote',
					'oracleAdapter',
					'strike',
					'maturity',
					'isCallPool',
				],
				additionalProperties: false,
			},
			chainId: {
				type: 'string',
				pattern: '^42161$|^421613$',
			},
			provider: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
			taker: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
			price: { type: 'string' }, // serialized bigint representation
			size: { type: 'string' }, // serialized bigint representation
			isBuy: { type: 'boolean' },
			deadline: { type: 'integer' },
			salt: { type: 'integer' },
			signature: {
				type: 'object',
				properties: {
					r: { type: 'string' },
					s: { type: 'string' },
					v: { type: 'integer' },
				},
				required: ['r', 's', 'v'],
				additionalProperties: false,
			},
		},
		required: [
			'poolKey',
			'chainId',
			'provider',
			'taker',
			'price',
			'size',
			'isBuy',
			'deadline',
			'salt',
			'signature',
		],
		additionalProperties: false,
	},
	minItems: 1,
	maxItems: 1000,
});

export const validateFillQuotes = ajv.compile({
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
});

export const validateDeleteQuotes = ajv.compile({
	type: 'object',
	properties: {
		quoteId: { type: 'string', pattern: '[a-fA-F0-9]{64}$' },
	},
	required: ['quoteId'],
	additionalProperties: false,
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
