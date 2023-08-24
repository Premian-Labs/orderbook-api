import Ajv from 'ajv';

const ajv = new Ajv();


//FIXME: correct typings for float values and make product string more strict
export const validatePostQuotes = ajv.compile({
	type: 'array',
	items: {
		type: 'object',
		properties: {
			product: { type: 'string' },
			side: {
				type: 'string',
				pattern: '^buy$|^sell$'
			},
			deadline: { type: 'integer' },
			size: { type: 'number' },
			price: { type: 'number' },
		},
		required: [
			'product',
			'side',
			'size',
			'price',
			'deadline'
		],
		additionalProperties: false
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
