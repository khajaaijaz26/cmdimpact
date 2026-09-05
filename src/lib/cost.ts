export type CostInput = {
	hardwarePrice: number;
	quantity: number;
	accessories: number;
	installation: number;
	monthlySubscription: number;
	monthlyOther: number;
	years: number;
};

export function calculateOwnershipCost(input: CostInput) {
	const money = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
	const quantity = Math.min(100, Math.max(1, Math.floor(money(input.quantity))));
	const years = Math.min(20, Math.max(1, Math.floor(money(input.years))));
	const hardware = money(input.hardwarePrice) * quantity;
	const upfront = hardware + money(input.accessories) + money(input.installation);
	const recurring = (money(input.monthlySubscription) + money(input.monthlyOther)) * 12 * years;
	const total = upfront + recurring;
	return { hardware, upfront, recurring, total, monthlyEquivalent: total / (years * 12), quantity, years };
}
