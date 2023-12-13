import moment from 'moment'

export function nextYearOfMaturities() {
	const FRIDAY = 5
	const maturities = []

	const today = moment.utc().startOf('day')
	const nextYear = today.clone().add(1, 'year')

	if (moment.utc().day() === FRIDAY && moment.utc().hour() < 8)
		maturities.push(today)

	const tomorrow = today.clone().add(1, 'day').add(8, 'hours')

	const afterTomorrow = today.clone().add(2, 'day').add(8, 'hours')

	const nextFriday = today.clone().day(FRIDAY).add(8, 'hours')

	maturities.push(tomorrow, afterTomorrow)

	if (
		!nextFriday.isSame(today, 'day') &&
		!nextFriday.isSame(tomorrow, 'day') &&
		!nextFriday.isSame(afterTomorrow, 'day')
	)
		maturities.push(nextFriday)

	const next2ndFriday = nextFriday.clone().add(1, 'week')
	const next3rdFriday = nextFriday.clone().add(2, 'week')
	const next4thFriday = nextFriday.clone().add(3, 'week')

	maturities.push(next2ndFriday)

	if (next3rdFriday.diff(today, 'days') < 30) maturities.push(next3rdFriday)
	if (next4thFriday.diff(today, 'days') < 30) maturities.push(next4thFriday)

	let increment = 1
	let monthlyPointer = today.clone().startOf('month').add(increment, 'month')

	while (monthlyPointer.isBefore(nextYear, 'month')) {
		const lastDay = today
			.clone()
			.startOf('month')
			.add(increment, 'month')
			.endOf('month')
			.startOf('day')

		const lastFriday8AM = lastDay
			.subtract((lastDay.day() + 2) % 7, 'days')
			.add(8, 'hours')

		monthlyPointer = today.clone().startOf('month').add(increment, 'month')

		increment++
		maturities.push(lastFriday8AM)
	}

	return maturities
}
