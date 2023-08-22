import express from 'express';
import axios from 'axios';
import { UnkeyAuthRequest, UnkeyAuthResponse } from './types';

// UNKEY API KEY middleware
export async function checkTestApiKey(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) {
	const providedKey = req.headers['x-apikey'];
	if (!providedKey)
		return res.status(401).json({ message: 'API key not provided' });

	const authRequest: UnkeyAuthRequest = {
		key: providedKey.toString(),
	};
	try {
		const auth = await axios.post(
			'https://api.unkey.dev/v1/keys/verify',
			authRequest,
			{
				validateStatus: function (status) {
					return status < 500;
				},
			}
		);
		const response: UnkeyAuthResponse = auth.data;
		if (!response.valid)
			return res.status(401).json({ message: 'Invalid API key' });
	} catch (e) {
		return res.status(401).json({ message: 'Failed to validate api key' });
	}

	next();
}
