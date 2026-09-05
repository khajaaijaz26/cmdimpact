import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateFit, type FitProduct, type Preferences } from '../src/lib/fit.ts';
import { calculateOwnershipCost } from '../src/lib/cost.ts';
import { summarizePassport } from '../src/lib/passport.ts';

const product: FitProduct = {
	id: 'local-doorbell',
	name: 'Local Doorbell',
	brand: 'Example',
	power: ['wired'],
	network: ['wifi-2.4'],
	ecosystems: ['google-home'],
	ecosystemCoverage: 'verified',
	storage: ['microSD'],
	subscription: 'none',
	internet: 'limited-offline',
};

const base: Preferences = {
	power: 'wired',
	network: 'wifi-2.4',
	ecosystem: 'google-home',
	storage: 'local',
	subscription: 'avoid',
	offline: 'important',
};

test('fit verdict prioritizes hard blockers and preserves honest unknowns', () => {
	assert.equal(evaluateFit(product, base).status, 'fit');
	assert.equal(evaluateFit(product, { ...base, power: 'battery' }).status, 'no');
	assert.equal(evaluateFit(product, { ...base, ecosystem: 'alexa' }).status, 'limited');
	assert.equal(
		evaluateFit({ ...product, network: [] }, { ...base, network: 'wifi-5' }).status,
		'unknown',
	);
});

test('ownership cost includes upfront and recurring costs without accepting negatives', () => {
	assert.deepEqual(calculateOwnershipCost({ hardwarePrice: 100, quantity: 2, accessories: 20, installation: 30, monthlySubscription: 5, monthlyOther: 0, years: 2 }), {
		hardware: 200, upfront: 250, recurring: 120, total: 370, monthlyEquivalent: 370 / 24, quantity: 2, years: 2,
	});
	assert.equal(calculateOwnershipCost({ hardwarePrice: -100, quantity: 0, accessories: 0, installation: 0, monthlySubscription: 0, monthlyOther: 0, years: 0 }).total, 0);
});

test('tech passport summarizes a worldwide profile without duplicate platforms', () => {
	assert.deepEqual(summarizePassport({ country: '  United Arab Emirates  ', region: 'middle-east', currency: 'AED', platforms: ['android', 'windows', 'android', ''] }), {
		market: 'United Arab Emirates', platformCount: 2, platforms: ['android', 'windows'],
	});
});
