import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { getNextCycleTime, parsePublicNote } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

export type TargetCurrencyCode = "CNY" | "USD" | "HKD" | "EUR" | "GBP" | "JPY";

export interface CurrencyMeta {
	code: string;
	symbol: string;
	nameZh: string;
	nameEn: string;
}

export const CURRENCY_META_MAP: Record<string, CurrencyMeta> = {
	CNY: { code: "CNY", symbol: "¥", nameZh: "人民币", nameEn: "CNY" },
	USD: { code: "USD", symbol: "$", nameZh: "美元", nameEn: "USD" },
	EUR: { code: "EUR", symbol: "€", nameZh: "欧元", nameEn: "EUR" },
	GBP: { code: "GBP", symbol: "£", nameZh: "英镑", nameEn: "GBP" },
	HKD: { code: "HKD", symbol: "HK$", nameZh: "港币", nameEn: "HKD" },
	JPY: { code: "JPY", symbol: "JP¥", nameZh: "日元", nameEn: "JPY" },
	TWD: { code: "TWD", symbol: "NT$", nameZh: "新台币", nameEn: "TWD" },
	CAD: { code: "CAD", symbol: "CA$", nameZh: "加元", nameEn: "CAD" },
	AUD: { code: "AUD", symbol: "A$", nameZh: "澳元", nameEn: "AUD" },
	SGD: { code: "SGD", symbol: "S$", nameZh: "新币", nameEn: "SGD" },
	KRW: { code: "KRW", symbol: "₩", nameZh: "韩元", nameEn: "KRW" },
	RUB: { code: "RUB", symbol: "₽", nameZh: "卢布", nameEn: "RUB" },
	CHF: { code: "CHF", symbol: "CHF", nameZh: "瑞郎", nameEn: "CHF" },
	TRY: { code: "TRY", symbol: "₺", nameZh: "里拉", nameEn: "TRY" },
	INR: { code: "INR", symbol: "₹", nameZh: "卢比", nameEn: "INR" },
	MYR: { code: "MYR", symbol: "RM", nameZh: "林吉特", nameEn: "MYR" },
	THB: { code: "THB", symbol: "฿", nameZh: "泰铢", nameEn: "THB" },
	PHP: { code: "PHP", symbol: "₱", nameZh: "比索", nameEn: "PHP" },
	BRL: { code: "BRL", symbol: "R$", nameZh: "雷亚尔", nameEn: "BRL" },
};

/**
 * Fallback exchange rates: 1 CNY = X Foreign Currency
 * Used immediately before live API responds or if offline.
 */
const FALLBACK_RATES_FROM_CNY: Record<string, number> = {
	CNY: 1,
	USD: 0.138,
	EUR: 0.128,
	GBP: 0.109,
	HKD: 1.075,
	JPY: 21.15,
	TWD: 4.48,
	CAD: 0.193,
	AUD: 0.212,
	SGD: 0.186,
	KRW: 192.5,
	RUB: 13.5,
	CHF: 0.122,
	TRY: 4.75,
	INR: 11.65,
	MYR: 0.615,
	THB: 4.72,
	PHP: 8.08,
	BRL: 0.79,
};

const SYMBOL_TO_CODE_MAP: Array<[RegExp, string]> = [
	[/^(?:hk\$|hkd)/i, "HKD"],
	[/^(?:nt\$|twd|ntd)/i, "TWD"],
	[/^(?:ca\$|cad|c\$)/i, "CAD"],
	[/^(?:au\$|a\$|aud)/i, "AUD"],
	[/^(?:s\$|sgd)/i, "SGD"],
	[/^(?:jp¥|jpy|円|日元)/i, "JPY"],
	[/^(?:us\$|usd|\$|刀|美元|美金)/i, "USD"],
	[/^(?:cny|rmb|￥|¥|元|人民币)/i, "CNY"],
	[/^(?:eur|€|欧元)/i, "EUR"],
	[/^(?:gbp|£|英镑)/i, "GBP"],
	[/^(?:krw|₩|韩元)/i, "KRW"],
	[/^(?:rub|₽|卢布)/i, "RUB"],
	[/^(?:chf|瑞郎)/i, "CHF"],
	[/^(?:try|₺|里拉)/i, "TRY"],
	[/^(?:inr|₹|卢比)/i, "INR"],
	[/^(?:myr|rm|林吉特)/i, "MYR"],
	[/^(?:thb|฿|泰铢)/i, "THB"],
	[/^(?:php|₱|比索)/i, "PHP"],
	[/^(?:brl|r\$|雷亚尔)/i, "BRL"],
];

export function normalizeCurrencyCode(rawCurrency?: string): string {
	if (!rawCurrency) return "CNY";
	const trimmed = rawCurrency.trim();
	if (!trimmed) return "CNY";
	const upper = trimmed.toUpperCase();
	if (CURRENCY_META_MAP[upper]) return upper;

	for (const [pattern, code] of SYMBOL_TO_CODE_MAP) {
		if (pattern.test(trimmed)) {
			return code;
		}
	}
	return "CNY";
}

export function getCurrencySymbol(codeOrRaw?: string): string {
	const code = normalizeCurrencyCode(codeOrRaw);
	return CURRENCY_META_MAP[code]?.symbol || code;
}

export function parseAmountAndCurrency(
	amountStr?: string,
	explicitCurrency?: string,
	explicitPrice?: number,
): {
	price: number;
	currencyCode: string;
	currencySymbol: string;
	isFree: boolean;
	isOneTime: boolean;
} {
	if (typeof explicitPrice === "number") {
		if (explicitPrice === -1) {
			const code = normalizeCurrencyCode(explicitCurrency);
			return {
				price: 0,
				currencyCode: code,
				currencySymbol: getCurrencySymbol(code),
				isFree: false,
				isOneTime: true,
			};
		}
		if (explicitPrice > 0) {
			const code = normalizeCurrencyCode(explicitCurrency);
			return {
				price: explicitPrice,
				currencyCode: code,
				currencySymbol: getCurrencySymbol(code),
				isFree: false,
				isOneTime: false,
			};
		}
	}

	const raw = (amountStr || "").trim();
	if (!raw || raw === "0" || /^free|免费$/i.test(raw)) {
		const code = normalizeCurrencyCode(explicitCurrency);
		return {
			price: 0,
			currencyCode: code,
			currencySymbol: getCurrencySymbol(code),
			isFree: true,
			isOneTime: false,
		};
	}
	if (raw === "-1" || /^one-?time|永久|一次性$/i.test(raw)) {
		const code = normalizeCurrencyCode(explicitCurrency);
		return {
			price: 0,
			currencyCode: code,
			currencySymbol: getCurrencySymbol(code),
			isFree: false,
			isOneTime: true,
		};
	}

	const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
	const price = numMatch ? Number.parseFloat(numMatch[1]) : 0;

	const prefixOrSuffix = raw.replace(/[\d.,\s]/g, "").trim();
	const currencyCode = prefixOrSuffix
		? normalizeCurrencyCode(prefixOrSuffix)
		: normalizeCurrencyCode(explicitCurrency);

	return {
		price: Number.isFinite(price) && price > 0 ? price : 0,
		currencyCode,
		currencySymbol: getCurrencySymbol(currencyCode),
		isFree: price === 0,
		isOneTime: false,
	};
}

export function resolveCycleDaysAndMonths(
	cycleLabel?: string,
	explicitCycleDays?: number,
): { cycleDays: number; months: number; label: string } {
	if (typeof explicitCycleDays === "number" && explicitCycleDays > 0) {
		if (explicitCycleDays >= 28 && explicitCycleDays <= 32) {
			return { cycleDays: explicitCycleDays, months: 1, label: "月" };
		}
		if (explicitCycleDays >= 88 && explicitCycleDays <= 95) {
			return { cycleDays: explicitCycleDays, months: 3, label: "季" };
		}
		if (explicitCycleDays >= 175 && explicitCycleDays <= 186) {
			return { cycleDays: explicitCycleDays, months: 6, label: "半年" };
		}
		if (explicitCycleDays >= 360 && explicitCycleDays <= 370) {
			return { cycleDays: explicitCycleDays, months: 12, label: "年" };
		}
		if (explicitCycleDays >= 720 && explicitCycleDays <= 740) {
			return { cycleDays: explicitCycleDays, months: 24, label: "两年" };
		}
		if (explicitCycleDays >= 1080 && explicitCycleDays <= 1110) {
			return { cycleDays: explicitCycleDays, months: 36, label: "三年" };
		}
		return {
			cycleDays: explicitCycleDays,
			months: Math.max(1, Math.round(explicitCycleDays / 30)),
			label: `${explicitCycleDays}天`,
		};
	}

	const raw = (cycleLabel || "月").trim().toLowerCase();
	switch (raw) {
		case "月":
		case "m":
		case "mo":
		case "month":
		case "monthly":
			return { cycleDays: 30, months: 1, label: "月" };
		case "季":
		case "q":
		case "qr":
		case "quarterly":
			return { cycleDays: 90, months: 3, label: "季" };
		case "半":
		case "半年":
		case "h":
		case "half":
		case "semi-annually":
			return { cycleDays: 180, months: 6, label: "半年" };
		case "年":
		case "y":
		case "yr":
		case "year":
		case "annual":
		case "annually":
			return { cycleDays: 365, months: 12, label: "年" };
		case "两年":
		case "2y":
		case "biennial":
			return { cycleDays: 730, months: 24, label: "两年" };
		case "三年":
		case "3y":
		case "triennial":
			return { cycleDays: 1095, months: 36, label: "三年" };
		default: {
			const dayMatch = raw.match(/^(\d+)\s*(?:天|d|days?)?$/i);
			if (dayMatch) {
				const d = Number.parseInt(dayMatch[1], 10);
				if (d > 0) {
					return {
						cycleDays: d,
						months: Math.max(1, Math.round(d / 30)),
						label: `${d}天`,
					};
				}
			}
			return { cycleDays: 30, months: 1, label: cycleLabel || "月" };
		}
	}
}

// ============================================================================
// Live Exchange Rate Manager (Cached in memory + localStorage)
// ============================================================================
interface ExchangeRateCache {
	ratesFromCny: Record<string, number>;
	updatedAt: number;
	isLive: boolean;
}

const CACHE_KEY = "komari_nezha_exchange_rates_v1";
const TARGET_CURRENCY_KEY = "komari_nezha_target_currency_v1";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

let memoryRateCache: ExchangeRateCache = loadCachedRates();
let inflightFetch: Promise<ExchangeRateCache> | null = null;
const rateListeners = new Set<() => void>();

function loadCachedRates(): ExchangeRateCache {
	if (typeof window === "undefined") {
		return {
			ratesFromCny: { ...FALLBACK_RATES_FROM_CNY },
			updatedAt: Date.now(),
			isLive: false,
		};
	}
	try {
		const raw = window.localStorage.getItem(CACHE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (
				parsed &&
				typeof parsed.ratesFromCny === "object" &&
				typeof parsed.updatedAt === "number"
			) {
				return {
					ratesFromCny: {
						...FALLBACK_RATES_FROM_CNY,
						...parsed.ratesFromCny,
					},
					updatedAt: parsed.updatedAt,
					isLive: Boolean(parsed.isLive),
				};
			}
		}
	} catch {
		// Ignore storage errors
	}
	return {
		ratesFromCny: { ...FALLBACK_RATES_FROM_CNY },
		updatedAt: Date.now(),
		isLive: false,
	};
}

function notifyRateListeners() {
	for (const listener of rateListeners) {
		listener();
	}
}

export async function refreshExchangeRates(
	force = false,
): Promise<ExchangeRateCache> {
	const now = Date.now();
	if (
		!force &&
		memoryRateCache.isLive &&
		now - memoryRateCache.updatedAt < CACHE_TTL_MS
	) {
		return memoryRateCache;
	}
	if (inflightFetch) return inflightFetch;

	inflightFetch = (async () => {
		const endpoints = [
			"https://open.er-api.com/v6/latest/CNY",
			"https://api.exchangerate-api.com/v4/latest/CNY",
			"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.json",
		];

		for (const url of endpoints) {
			try {
				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), 5000);
				const res = await fetch(url, { signal: controller.signal });
				clearTimeout(timer);
				if (!res.ok) continue;
				const data = await res.json();

				const rawRates = data?.rates || data?.cny;
				if (rawRates && typeof rawRates === "object") {
					const normalized: Record<string, number> = {
						...FALLBACK_RATES_FROM_CNY,
					};
					for (const [k, v] of Object.entries(rawRates)) {
						if (typeof v === "number" && v > 0) {
							normalized[k.toUpperCase()] = v;
						}
					}
					normalized.CNY = 1;
					memoryRateCache = {
						ratesFromCny: normalized,
						updatedAt: Date.now(),
						isLive: true,
					};
					try {
						window.localStorage.setItem(
							CACHE_KEY,
							JSON.stringify(memoryRateCache),
						);
					} catch {
						// Ignore quota error
					}
					notifyRateListeners();
					return memoryRateCache;
				}
			} catch {
				// Try next endpoint
			}
		}
		return memoryRateCache;
	})().finally(() => {
		inflightFetch = null;
	});

	return inflightFetch;
}

export function convertCurrencyAmount(
	amount: number,
	fromCurrency: string,
	toCurrency: string,
	ratesFromCny: Record<string, number> = memoryRateCache.ratesFromCny,
): { converted: number; rate: number } {
	const fromCode = normalizeCurrencyCode(fromCurrency);
	const toCode = normalizeCurrencyCode(toCurrency);
	if (fromCode === toCode) {
		return { converted: amount, rate: 1 };
	}
	const fromPerCny =
		ratesFromCny[fromCode] ?? FALLBACK_RATES_FROM_CNY[fromCode] ?? 1;
	const toPerCny = ratesFromCny[toCode] ?? FALLBACK_RATES_FROM_CNY[toCode] ?? 1;
	// 1 CNY = fromPerCny FROM => 1 FROM = (1 / fromPerCny) CNY = (toPerCny / fromPerCny) TO
	const rate = toPerCny / fromPerCny;
	return {
		converted: amount * rate,
		rate,
	};
}

let currentTargetCurrency: TargetCurrencyCode = (() => {
	if (typeof window === "undefined") return "CNY";
	try {
		const saved = window.localStorage.getItem(TARGET_CURRENCY_KEY);
		if (
			saved === "CNY" ||
			saved === "USD" ||
			saved === "HKD" ||
			saved === "EUR" ||
			saved === "GBP" ||
			saved === "JPY"
		) {
			return saved;
		}
	} catch {
		// Ignore
	}
	return "CNY";
})();

export function setGlobalTargetCurrency(next: TargetCurrencyCode) {
	currentTargetCurrency = next;
	try {
		window.localStorage.setItem(TARGET_CURRENCY_KEY, next);
	} catch {
		// Ignore
	}
	notifyRateListeners();
}

export function useExchangeRates() {
	const [, setTick] = useState(0);

	useEffect(() => {
		const onUpdate = () => setTick((t) => t + 1);
		rateListeners.add(onUpdate);
		void refreshExchangeRates(false);
		return () => {
			rateListeners.delete(onUpdate);
		};
	}, []);

	return {
		ratesFromCny: memoryRateCache.ratesFromCny,
		updatedAt: memoryRateCache.updatedAt,
		isLive: memoryRateCache.isLive,
		targetCurrency: currentTargetCurrency,
		targetSymbol: getCurrencySymbol(currentTargetCurrency),
		setTargetCurrency: setGlobalTargetCurrency,
		refreshRates: () => refreshExchangeRates(true),
	};
}

// ============================================================================
// Per-Server & Fleet-Wide Remaining Value Calculations
// ============================================================================
export interface ServerValuation {
	serverId: number;
	serverName: string;
	countryCode: string;
	hasBilling: boolean;
	isFree: boolean;
	isOneTime: boolean;
	isExpired: boolean;
	autoRenewal: boolean;
	nativePrice: number;
	nativeCurrencyCode: string;
	nativeCurrencySymbol: string;
	cycleDays: number;
	cycleLabel: string;
	endDateIso: string;
	effectiveEndDateMs: number;
	remainingDays: number;
	remainingDaysExact: number;
	remainingPercentage: number;
	exchangeRateToTarget: number;
	targetCurrencyCode: string;
	targetCurrencySymbol: string;
	priceInTarget: number;
	remainingValueNative: number;
	remainingValueTarget: number;
	dailyCostTarget: number;
	monthlyCostTarget: number;
	yearlyCostTarget: number;
}

export function calculateServerValuation(
	server: NezhaServer,
	nowMs: number,
	targetCurrency: string = currentTargetCurrency,
	ratesFromCny: Record<string, number> = memoryRateCache.ratesFromCny,
): ServerValuation | null {
	const parsed = parsePublicNote(server.public_note);
	const billing = parsed?.billingDataMod;
	const meta = parsed?.komariMeta;

	if (!billing && (!meta || (meta.price === undefined && !meta.expiredAt))) {
		return null;
	}

	const { price, currencyCode, currencySymbol, isFree, isOneTime } =
		parseAmountAndCurrency(billing?.amount, meta?.currency, meta?.price);

	const { cycleDays, months, label: cycleLabel } = resolveCycleDaysAndMonths(
		billing?.cycle,
		meta?.billingCycle,
	);

	const autoRenewal =
		meta?.autoRenewal !== undefined
			? Boolean(meta.autoRenewal)
			: billing?.autoRenewal === "1";

	const rawEndDate = meta?.expiredAt || billing?.endDate || "";
	const parsedEndMs = rawEndDate ? dayjs(rawEndDate).valueOf() : NaN;
	const hasValidEnd =
		Number.isFinite(parsedEndMs) &&
		!rawEndDate.startsWith("0001-01-01") &&
		parsedEndMs > 946684800000; // > year 2000

	let effectiveEndDateMs = hasValidEnd
		? parsedEndMs
		: nowMs + cycleDays * 86_400_000;

	if (hasValidEnd && effectiveEndDateMs <= nowMs && autoRenewal) {
		try {
			effectiveEndDateMs = getNextCycleTime(effectiveEndDateMs, months, nowMs);
		} catch {
			while (effectiveEndDateMs <= nowMs) {
				effectiveEndDateMs += cycleDays * 86_400_000;
			}
		}
	}

	const diffMs = effectiveEndDateMs - nowMs;
	const isExpired = hasValidEnd && diffMs <= 0 && !autoRenewal;
	const remainingDaysExact = isExpired ? 0 : Math.max(0, diffMs / 86_400_000);
	const remainingDays = isExpired ? 0 : Math.max(0, Math.ceil(remainingDaysExact));

	const remainingPercentage =
		cycleDays > 0
			? Math.min(1, Math.max(0, remainingDaysExact / cycleDays))
			: 0;

	const dailyNative = cycleDays > 0 && price > 0 ? price / cycleDays : 0;
	const remainingValueNative =
		isFree || isOneTime || isExpired ? 0 : dailyNative * remainingDaysExact;

	const { converted: priceInTarget, rate: exchangeRateToTarget } =
		convertCurrencyAmount(price, currencyCode, targetCurrency, ratesFromCny);

	const remainingValueTarget = remainingValueNative * exchangeRateToTarget;
	const dailyCostTarget =
		cycleDays > 0 && priceInTarget > 0 ? priceInTarget / cycleDays : 0;
	const monthlyCostTarget = dailyCostTarget * 30;
	const yearlyCostTarget = dailyCostTarget * 365;

	return {
		serverId: server.id,
		serverName: server.name,
		countryCode: server.country_code,
		hasBilling: true,
		isFree,
		isOneTime,
		isExpired,
		autoRenewal,
		nativePrice: price,
		nativeCurrencyCode: currencyCode,
		nativeCurrencySymbol: currencySymbol,
		cycleDays,
		cycleLabel,
		endDateIso: hasValidEnd ? new Date(effectiveEndDateMs).toISOString() : "",
		effectiveEndDateMs,
		remainingDays,
		remainingDaysExact,
		remainingPercentage,
		exchangeRateToTarget,
		targetCurrencyCode: normalizeCurrencyCode(targetCurrency),
		targetCurrencySymbol: getCurrencySymbol(targetCurrency),
		priceInTarget,
		remainingValueNative,
		remainingValueTarget,
		dailyCostTarget,
		monthlyCostTarget,
		yearlyCostTarget,
	};
}

export interface FleetValuationSummary {
	targetCurrencyCode: string;
	targetCurrencySymbol: string;
	totalRemainingValue: number;
	totalMonthlyCost: number;
	totalYearlyCost: number;
	totalDailyCost: number;
	billedCount: number;
	paidCount: number;
	expiringSoonCount: number;
	nearestExpiryServer: ServerValuation | null;
	valuations: ServerValuation[];
}

export function calculateFleetValuation(
	servers: NezhaServer[],
	nowMs: number,
	targetCurrency: string = currentTargetCurrency,
	ratesFromCny: Record<string, number> = memoryRateCache.ratesFromCny,
): FleetValuationSummary {
	const valuations: ServerValuation[] = [];
	let totalRemainingValue = 0;
	let totalMonthlyCost = 0;
	let totalYearlyCost = 0;
	let totalDailyCost = 0;
	let paidCount = 0;
	let expiringSoonCount = 0;
	let nearestExpiryServer: ServerValuation | null = null;

	for (const server of servers) {
		const v = calculateServerValuation(
			server,
			nowMs,
			targetCurrency,
			ratesFromCny,
		);
		if (!v) continue;
		valuations.push(v);

		if (!v.isFree && !v.isOneTime && v.nativePrice > 0) {
			paidCount++;
			totalRemainingValue += v.remainingValueTarget;
			totalMonthlyCost += v.monthlyCostTarget;
			totalYearlyCost += v.yearlyCostTarget;
			totalDailyCost += v.dailyCostTarget;
		}

		if (!v.isExpired && v.endDateIso && v.remainingDays <= 7) {
			expiringSoonCount++;
		}
		if (
			!v.isExpired &&
			v.endDateIso &&
			(!nearestExpiryServer ||
				v.remainingDaysExact < nearestExpiryServer.remainingDaysExact)
		) {
			nearestExpiryServer = v;
		}
	}

	valuations.sort((a, b) => b.remainingValueTarget - a.remainingValueTarget);

	return {
		targetCurrencyCode: normalizeCurrencyCode(targetCurrency),
		targetCurrencySymbol: getCurrencySymbol(targetCurrency),
		totalRemainingValue,
		totalMonthlyCost,
		totalYearlyCost,
		totalDailyCost,
		billedCount: valuations.length,
		paidCount,
		expiringSoonCount,
		nearestExpiryServer,
		valuations,
	};
}
