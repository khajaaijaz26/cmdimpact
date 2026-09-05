export type Power = 'battery' | 'wired' | 'poe';
export type Network = 'wifi-2.4' | 'wifi-5' | 'ethernet';
export type Ecosystem = 'alexa' | 'google-home' | 'apple-home';
export type Storage = 'cloud' | 'device' | 'microSD' | 'nvr' | 'homebase';

export type FitProduct = {
	id: string;
	name: string;
	brand: string;
	power: Power[];
	network: Network[];
	ecosystems: Ecosystem[];
	ecosystemCoverage: 'verified' | 'unknown';
	storage: Storage[];
	subscription: 'none' | 'optional' | 'recordings';
	internet: 'required' | 'limited-offline' | 'unknown';
};

export type Preferences = {
	power: Power | 'any';
	network: Network | 'any';
	ecosystem: Ecosystem | 'any';
	storage: 'local' | 'cloud' | 'any';
	subscription: 'avoid' | 'okay';
	offline: 'important' | 'not-important';
};

export type FitDetail = {
	kind: 'match' | 'limit' | 'blocker' | 'unknown';
	text: string;
};

export type FitVerdict = {
	status: 'fit' | 'limited' | 'no' | 'unknown';
	label: 'Fits' | 'Fits with limits' | "Doesn't fit" | 'Unknown';
	score: number;
	details: FitDetail[];
};

export const labels = {
	power: { battery: 'Battery', wired: 'Doorbell wiring', poe: 'Power over Ethernet' },
	network: { 'wifi-2.4': '2.4 GHz Wi-Fi', 'wifi-5': '5 GHz Wi-Fi', ethernet: 'Ethernet' },
	ecosystem: { alexa: 'Amazon Alexa', 'google-home': 'Google Home', 'apple-home': 'Apple Home' },
	storage: {
		cloud: 'Cloud',
		device: 'On-device',
		microSD: 'microSD',
		nvr: 'NVR',
		homebase: 'Local hub',
	},
} as const;

export function evaluateFit(product: FitProduct, preferences: Preferences): FitVerdict {
	const details: FitDetail[] = [];

	if (preferences.power !== 'any') {
		if (product.power.includes(preferences.power)) {
			details.push({ kind: 'match', text: `${labels.power[preferences.power]} installation is supported.` });
		} else {
			details.push({ kind: 'blocker', text: `${labels.power[preferences.power]} installation is not supported.` });
		}
	}

	if (preferences.network !== 'any') {
		if (product.network.length === 0) {
			details.push({ kind: 'unknown', text: 'The manufacturer source does not confirm its network bands.' });
		} else if (product.network.includes(preferences.network)) {
			details.push({ kind: 'match', text: `${labels.network[preferences.network]} is supported.` });
		} else {
			details.push({ kind: 'blocker', text: `${labels.network[preferences.network]} is not supported.` });
		}
	}

	if (preferences.ecosystem !== 'any') {
		if (product.ecosystemCoverage === 'unknown') {
			details.push({ kind: 'unknown', text: 'Ecosystem support was not confirmed in the cited specifications.' });
		} else if (product.ecosystems.includes(preferences.ecosystem)) {
			details.push({ kind: 'match', text: `${labels.ecosystem[preferences.ecosystem]} integration is listed.` });
		} else {
			details.push({ kind: 'limit', text: `${labels.ecosystem[preferences.ecosystem]} integration is not listed; use the maker's app instead.` });
		}
	}

	if (preferences.storage !== 'any') {
		const hasLocalStorage = product.storage.some((item) => item !== 'cloud');
		const matches = preferences.storage === 'local' ? hasLocalStorage : product.storage.includes('cloud');
		if (matches) {
			details.push({ kind: 'match', text: `${preferences.storage === 'local' ? 'Local' : 'Cloud'} recording is available.` });
		} else {
			details.push({ kind: 'blocker', text: `${preferences.storage === 'local' ? 'Local' : 'Cloud'} recording is not listed.` });
		}
	}

	if (preferences.subscription === 'avoid') {
		if (product.subscription === 'recordings') {
			details.push({ kind: 'limit', text: 'Live features work, but recorded video history needs a paid plan.' });
		} else {
			details.push({ kind: 'match', text: 'A paid plan is not required for the listed core recording option.' });
		}
	}

	if (preferences.offline === 'important') {
		if (product.internet === 'required') {
			details.push({ kind: 'limit', text: 'Core remote features depend on working internet and cloud access.' });
		} else if (product.internet === 'limited-offline') {
			details.push({ kind: 'match', text: 'The manufacturer documents some useful local behavior during an outage.' });
		} else {
			details.push({ kind: 'unknown', text: 'Useful behavior during an internet outage is not clearly documented.' });
		}
	}

	if (details.length === 0) {
		details.push({ kind: 'unknown', text: 'Choose at least one specific requirement for a meaningful verdict.' });
	}

	const counts = details.reduce(
		(total, detail) => ({ ...total, [detail.kind]: total[detail.kind] + 1 }),
		{ match: 0, limit: 0, blocker: 0, unknown: 0 },
	);
	const status = counts.blocker ? 'no' : counts.limit ? 'limited' : counts.unknown ? 'unknown' : 'fit';
	const label = { fit: 'Fits', limited: 'Fits with limits', no: "Doesn't fit", unknown: 'Unknown' }[status] as FitVerdict['label'];
	const score = Math.max(0, 100 - counts.blocker * 45 - counts.limit * 18 - counts.unknown * 8);

	return { status, label, score, details };
}
