import express from 'express'
import { verifyKey } from '@unkey/api'

// UNKEY API KEY middleware
export async function checkTestApiKey(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) {
	const providedKey = req.headers['x-apikey']
	if (!providedKey)
		return res.status(401).json({ message: 'API key not provided' })

	const { result, error } = await verifyKey(providedKey.toString())

	if (error) {
		return res.status(401).json({ message: 'Failed to validate api key' })
	}

	if (!result.valid)
		// if key is invalid, code will give the reason (NOT_FOUND, FORBIDDEN, KEY_USAGE_EXCEEDED, RATELIMITED)
		return res.status(401).json({ message: `${result.code}` })

	next()
}
