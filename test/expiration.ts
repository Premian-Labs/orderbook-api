import dotenv from 'dotenv'
import axios from 'axios'
import { checkEnv } from '../src/config/checkConfig'

dotenv.config()
// NOTE: integration tests can only be run on development mode & with testnet credentials
checkEnv(true)

const url = `http://localhost:${process.env.HTTP_PORT}`

describe('Expiration & Position Management', () => {
	it('should successfully settle options in a specified Option', async () => {})

	it('should prevent settling options with an invalid expiration', async () => {})

	it('should successfully exercise options in a specified Option', async () => {})

	it('should prevent exercising options with an invalid expiration', async () => {})

	it('should successfully annihilate options in a specified Option', async () => {})

	it('should prevent annihilation attempt is ZERO balance in either long or short tokens', async () => {})
})
