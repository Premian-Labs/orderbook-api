import axios from 'axios'
import { URLSearchParams } from 'url'

// verified to exist in checkConfig
const port = process.env.HTTP_PORT!
type requestType =  'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function apiRequest(method: requestType, endpoint: string, data?: any, queryParams?: any) {
	const url = `https://localhost:${port}/${endpoint}`
	switch (method){
		case 'GET':{
			const params = new URLSearchParams(queryParams);
			const urlParams = url.concat(`/?${params}`)
			return  await axios.get(urlParams)
		}
		case 'POST':{
			return await axios.post(url, data)
		}
		case 'DELETE':{
			return await axios.delete(url, data)
		}
		case 'PATCH': {
			return await axios.patch(url, data);
		}
		default: {
			return await axios.post(url, data)
		}
	}
}
