import { transports, createLogger, format } from 'winston'
import dotenv from 'dotenv'

dotenv.config()
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

const transport = [new transports.Console()]

const Logger = createLogger({
	format: format.combine(
		format.json({
			replacer: (key, value) => {
				if (value instanceof Error) {
					return { message: value.message, stack: value.stack }
				}
				return value
			},
		})
		// format.prettyPrint({
		//   colorize: true
		// })
	),
	level: level(),
	transports: transport,
	levels,
	defaultMeta: {
		service: 'Premia-v3-API',
	},
})

export default Logger
