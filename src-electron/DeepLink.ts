const chartHashPattern = /^[a-f0-9]{32}$/i

export function parseChartDeepLink(value: string): string | null {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		return null
	}

	const hash = url.pathname.slice(1)
	if (
		url.protocol !== 'bridge:'
		|| url.host !== 'chart'
		|| url.username !== ''
		|| url.password !== ''
		|| url.search !== ''
		|| url.hash !== ''
		|| !chartHashPattern.test(hash)
	) {
		return null
	}

	return hash.toLowerCase()
}

export function findChartDeepLink(args: string[]): string | null {
	for (const arg of args) {
		const chartHash = parseChartDeepLink(arg)
		if (chartHash) return chartHash
	}
	return null
}
