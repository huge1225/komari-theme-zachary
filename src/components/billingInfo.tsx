import { useTranslation } from "react-i18next";
import {
	convertCurrencyAmount,
	parseAmountAndCurrency,
	resolveCycleDaysAndMonths,
	useExchangeRates,
} from "@/lib/billing-value";
import {
	cn,
	getDaysBetweenDatesWithAutoRenewal,
	type PublicNoteData,
} from "@/lib/utils";

import RemainPercentBar from "./RemainPercentBar";

export default function BillingInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	const { t } = useTranslation();
	const { ratesFromCny, targetCurrency, targetSymbol } = useExchangeRates();

	if (!parsedData?.billingDataMod) {
		return null;
	}

	let isNeverExpire = false;
	let daysLeftObject = {
		days: 0,
		cycleLabel: "",
		remainingPercentage: 0,
	};
	const hasBillingDates =
		Boolean(parsedData.billingDataMod.startDate) ||
		Boolean(parsedData.billingDataMod.endDate);

	if (parsedData?.billingDataMod?.endDate) {
		if (parsedData.billingDataMod.endDate.startsWith("0000-00-00")) {
			isNeverExpire = true;
		} else {
			try {
				daysLeftObject = getDaysBetweenDatesWithAutoRenewal(
					parsedData.billingDataMod,
				);
			} catch (error) {
				console.error(error);
				return (
					<div className={cn("text-[10px] text-muted-foreground text-red-600")}>
						{t("billingInfo.remaining")}: {t("billingInfo.error")}
					</div>
				);
			}
		}
	}

	const meta = parsedData.komariMeta;
	const { price, currencyCode, isFree, isOneTime } = parseAmountAndCurrency(
		parsedData.billingDataMod.amount,
		meta?.currency,
		meta?.price,
	);
	const { cycleDays } = resolveCycleDaysAndMonths(
		parsedData.billingDataMod.cycle,
		meta?.billingCycle,
	);

	let remainingValueTarget = 0;
	let monthlyCostTarget = 0;
	if (!isFree && !isOneTime && price > 0 && cycleDays > 0) {
		const monthlyNative = (price / cycleDays) * 30;
		monthlyCostTarget = convertCurrencyAmount(
			monthlyNative,
			currencyCode,
			targetCurrency,
			ratesFromCny,
		).converted;

		if (!isNeverExpire && daysLeftObject.days > 0) {
			const remainingNative = (price / cycleDays) * daysLeftObject.days;
			remainingValueTarget = convertCurrencyAmount(
				remainingNative,
				currencyCode,
				targetCurrency,
				ratesFromCny,
			).converted;
		}
	}

	return daysLeftObject.days >= 0 ? (
		<>
			{parsedData.billingDataMod.amount &&
			parsedData.billingDataMod.amount !== "0" &&
			parsedData.billingDataMod.amount !== "-1" ? (
				<div
					className={cn(
						"flex flex-wrap items-center gap-x-1 text-[10px] text-muted-foreground",
					)}
				>
					<span className="text-nowrap">
						{t("billingInfo.price")}: {parsedData.billingDataMod.amount}/
						{parsedData.billingDataMod.cycle}
					</span>
					{monthlyCostTarget > 0 && (
						<span className="text-nowrap font-medium text-emerald-600 dark:text-emerald-400">
							· 月估 {targetSymbol}
							{monthlyCostTarget.toFixed(1)}
						</span>
					)}
				</div>
			) : parsedData.billingDataMod.amount === "0" ? (
				<p className={cn("text-[10px] text-green-600 ")}>
					{t("billingInfo.free")}
				</p>
			) : parsedData.billingDataMod.amount === "-1" ? (
				<p className={cn("text-[10px] text-pink-600 ")}>
					{t("billingInfo.usage-baseed")}
				</p>
			) : null}
			{hasBillingDates && (
				<div
					className={cn(
						"flex flex-wrap items-center gap-x-1 text-[10px] text-muted-foreground",
					)}
				>
					<span className="text-nowrap">
						{t("billingInfo.remaining")}:{" "}
						{isNeverExpire
							? t("billingInfo.indefinite")
							: `${daysLeftObject.days} ${t("billingInfo.days")}`}
					</span>
					{remainingValueTarget > 0 && (
						<span className="text-nowrap font-medium text-amber-600 dark:text-amber-400">
							· 余值 {targetSymbol}
							{remainingValueTarget.toFixed(1)}
						</span>
					)}
				</div>
			)}
			{hasBillingDates && !isNeverExpire && (
				<RemainPercentBar
					className="mt-0.5"
					value={daysLeftObject.remainingPercentage * 100}
				/>
			)}
		</>
	) : (
		<>
			{parsedData.billingDataMod.amount &&
			parsedData.billingDataMod.amount !== "0" &&
			parsedData.billingDataMod.amount !== "-1" ? (
				<p className={cn("text-[10px] text-muted-foreground ")}>
					{t("billingInfo.price")}: {parsedData.billingDataMod.amount}/
					{parsedData.billingDataMod.cycle}
				</p>
			) : parsedData.billingDataMod.amount === "0" ? (
				<p className={cn("text-[10px] text-green-600 ")}>
					{t("billingInfo.free")}
				</p>
			) : parsedData.billingDataMod.amount === "-1" ? (
				<p className={cn("text-[10px] text-pink-600 ")}>
					{t("billingInfo.usage-baseed")}
				</p>
			) : null}
			<p className={cn("text-[10px] text-muted-foreground text-red-600")}>
				{t("billingInfo.expired")}: {daysLeftObject.days * -1}{" "}
				{t("billingInfo.days")}
			</p>
		</>
	);
}
