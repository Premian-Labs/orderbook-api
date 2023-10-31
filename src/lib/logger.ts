import { transports, createLogger } from 'winston'

const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
}

const level = () => {
	const env = process.env.ENV || 'development'
	const isDevelopment = env === 'development'
	return isDevelopment ? 'debug' : 'info'
}

// TODO: add json parser for logging (similar to orderbook api)
// Create the logger instance that has to be exported
// and used to log messages.
const Logger = createLogger({
	level: level(),
	transports: [new transports.Console()],
	levels,
	defaultMeta: {
		service: 'Quotes',
	},
})

export default Logger
