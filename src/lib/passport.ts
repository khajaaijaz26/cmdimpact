export type TechPassport = {
	country: string;
	region: string;
	currency: string;
	platforms: string[];
};

export function summarizePassport(passport: TechPassport) {
	const platforms = [...new Set(passport.platforms.filter(Boolean))];
	return {
		market: passport.country.trim() || 'Worldwide',
		platformCount: platforms.length,
		platforms,
	};
}
