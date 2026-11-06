import {
	ArrowDownCircleIcon,
	ArrowUpCircleIcon,
	BanknotesIcon,
	ChevronDownIcon,
	ChevronUpIcon,
} from "@heroicons/react/20/solid";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import ServerFlag from "@/components/ServerFlag";
import { Card, CardContent } from "@/components/ui/card";
import { useStatus } from "@/hooks/use-status";
import {
	calculateFleetValuation,
	convertCurrencyAmount,
	type TargetCurrencyCode,
	useExchangeRates,
} from "@/lib/billing-value";
import { formatBytes } from "@/lib/format";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import SkeletonBar from "./loading/SkeletonBar";
import NumericText from "./NumericText";

const TARGET_CURRENCIES: TargetCurrencyCode[] = ["CNY", "USD", "HKD", "EUR"];

type ServerOverviewProps = {
	loading?: boolean;
	online: number;
	offline: number;
	total: number;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
	servers?: NezhaServer[];
	now?: number;
};

export default function ServerOverview({
	loading = false,
	online,
	offline,
	total,
	up,
	down,
	upSpeed,
	downSpeed,
	servers = [],
	now = Date.now(),
}: ServerOverviewProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { status, setStatus } = useStatus();
	const [showValuationPanel, setShowValuationPanel] = useState(false);
	const [valuationSortBy, setValuationSortBy] = useState<
		"remainingValue" | "monthlyCost"
	>("remainingValue");
	const [valuationSortOrder, setValuationSortOrder] = useState<"desc" | "asc">(
		"desc",
	);

	const {
		backgroundImage: customBackgroundImage,
		disableAnimatedMan,
		customIllustration,
	} = useRuntimeConfig();

	const {
		ratesFromCny,
		isLive,
		targetCurrency,
		targetSymbol,
		setTargetCurrency,
		refreshRates,
	} = useExchangeRates();

	const fleetValuation = useMemo(
		() =>
			calculateFleetValuation(
				servers,
				now || Date.now(),
				targetCurrency,
				ratesFromCny,
			),
		[servers, now, targetCurrency, ratesFromCny],
	);

	const sortedValuations = useMemo(() => {
		const list = [...fleetValuation.valuations];
		list.sort((a, b) => {
			const valA =
				valuationSortBy === "monthlyCost"
					? a.monthlyCostTarget
					: a.remainingValueTarget;
			const valB =
				valuationSortBy === "monthlyCost"
					? b.monthlyCostTarget
					: b.remainingValueTarget;
			if (valA !== valB) {
				return valuationSortOrder === "desc" ? valB - valA : valA - valB;
			}
			return b.remainingValueTarget - a.remainingValueTarget;
		});
		return list;
	}, [fleetValuation.valuations, valuationSortBy, valuationSortOrder]);

	const handleValuationSortClick = (
		field: "remainingValue" | "monthlyCost",
	) => {
		if (valuationSortBy === field) {
			setValuationSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
		} else {
			setValuationSortBy(field);
			setValuationSortOrder("desc");
		}
	};

	const cycleCurrency = (e: React.MouseEvent) => {
		e.stopPropagation();
		const idx = TARGET_CURRENCIES.indexOf(targetCurrency);
		const next = TARGET_CURRENCIES[(idx + 1) % TARGET_CURRENCIES.length];
		setTargetCurrency(next);
	};

	const usdToTarget = convertCurrencyAmount(
		1,
		"USD",
		targetCurrency,
		ratesFromCny,
	).rate;
	const eurToTarget = convertCurrencyAmount(
		1,
		"EUR",
		targetCurrency,
		ratesFromCny,
	).rate;
	const hkdToTarget = convertCurrencyAmount(
		1,
		"HKD",
		targetCurrency,
		ratesFromCny,
	).rate;

	return (
		<div className="flex flex-col gap-3">
			<section
				aria-busy={loading}
				className={cn(
					"grid grid-cols-2 gap-4 lg:grid-cols-5 server-overview",
					loading && "pointer-events-none",
				)}
			>
				<Card
					onClick={() => {
						setStatus("all");
					}}
					className={cn(
						"group cursor-pointer transition-all hover:ring-blue-500 dark:hover:ring-blue-600",
						{
							"bg-card/70": customBackgroundImage,
						},
					)}
				>
					<CardContent
						className={cn(
							"relative flex h-full items-center px-5 py-3",
							loading && "[&>section]:invisible",
						)}
					>
						{loading && <OverviewPlaceholder />}
						<section className="flex flex-col gap-1">
							<p className="text-sm font-medium md:text-base">
								{t("serverOverview.totalServers")}
							</p>
							<div className="flex items-center gap-2">
								<span className="relative flex h-2 w-2">
									<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
								</span>
								<NumericText value={total} className="text-lg font-semibold" />
							</div>
						</section>
					</CardContent>
				</Card>

				<Card
					onClick={() => {
						setStatus("online");
					}}
					className={cn(
						"cursor-pointer ring-1 transition-all hover:ring-green-500 dark:hover:ring-green-600",
						{
							"bg-card/70": customBackgroundImage,
						},
						{
							"border-transparent ring-2 ring-green-500 dark:ring-green-600":
								status === "online",
						},
					)}
				>
					<CardContent
						className={cn(
							"relative flex h-full items-center px-5 py-3",
							loading && "[&>section]:invisible",
						)}
					>
						{loading && <OverviewPlaceholder />}
						<section className="flex flex-col gap-1">
							<p className="text-sm font-medium md:text-base">
								{t("serverOverview.onlineServers")}
							</p>
							<div className="flex items-center gap-2">
								<span className="relative flex h-2 w-2">
									<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
								</span>
								<NumericText value={online} className="text-lg font-semibold" />
							</div>
						</section>
					</CardContent>
				</Card>

				<Card
					onClick={() => {
						setStatus("offline");
					}}
					className={cn(
						"cursor-pointer ring-1 transition-all hover:ring-red-500 dark:hover:ring-red-600",
						{
							"bg-card/70": customBackgroundImage,
						},
						{
							"border-transparent ring-2 ring-red-500 dark:ring-red-600":
								status === "offline",
						},
					)}
				>
					<CardContent
						className={cn(
							"relative flex h-full items-center px-5 py-3",
							loading && "[&>section]:invisible",
						)}
					>
						{loading && <OverviewPlaceholder />}
						<section className="flex flex-col gap-1">
							<p className="text-sm font-medium md:text-base">
								{t("serverOverview.offlineServers")}
							</p>
							<div className="flex items-center gap-2">
								<span className="relative flex h-2 w-2">
									<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
								</span>
								<NumericText
									value={offline}
									className="text-lg font-semibold"
								/>
							</div>
						</section>
					</CardContent>
				</Card>

				<Card
					className={cn(
						"group ring-1 hover:ring-purple-500 dark:hover:ring-purple-600",
						{
							"bg-card/70": customBackgroundImage,
						},
					)}
				>
					<CardContent
						className={cn(
							"flex h-full items-center relative px-5 py-3",
							loading && "[&>section]:invisible",
						)}
					>
						{loading && <OverviewPlaceholder network />}
						<section className="flex flex-col gap-1 w-full">
							<div className="flex items-center w-full justify-between">
								<p className="text-sm font-medium md:text-base">
									{t("serverOverview.network")}
								</p>
							</div>
							<section className="flex items-start flex-row z-10 pr-0 gap-1">
								<NumericText
									value={`↑${formatBytes(up)}`}
									className="sm:text-[12px] text-[10px] text-blue-800 dark:text-blue-400 text-nowrap font-medium"
								/>
								<NumericText
									value={`↓${formatBytes(down)}`}
									className="sm:text-[12px] text-[10px] text-purple-800 dark:text-purple-400 text-nowrap font-medium"
								/>
							</section>
							<section className="flex flex-col sm:flex-row -mr-1 sm:items-center items-start gap-1">
								<p className="text-[11px] flex items-center text-nowrap font-semibold">
									<ArrowUpCircleIcon className="size-3 mr-0.5 sm:mb-px" />
									{formatBytes(upSpeed)}/s
								</p>
								<p className="text-[11px] flex items-center text-nowrap font-semibold">
									<ArrowDownCircleIcon className="size-3 mr-0.5" />
									{formatBytes(downSpeed)}/s
								</p>
							</section>
						</section>
						{!loading && !disableAnimatedMan && customIllustration && (
							<img
								className="absolute right-3 top-[-85px] z-50 w-20 scale-90 group-hover:opacity-50 md:scale-100 transition-all"
								alt={"custom-illustration"}
								src={customIllustration}
								loading="eager"
							/>
						)}
					</CardContent>
				</Card>

				<Card
					onClick={() => {
						if (fleetValuation.billedCount > 0) {
							setShowValuationPanel((prev) => !prev);
						}
					}}
					className={cn(
						"col-span-2 lg:col-span-1 group cursor-pointer ring-1 transition-all hover:ring-amber-500 dark:hover:ring-amber-500",
						{
							"bg-card/70": customBackgroundImage,
							"ring-2 ring-amber-500 dark:ring-amber-500": showValuationPanel,
						},
					)}
				>
					<CardContent
						className={cn(
							"flex h-full items-center relative px-5 py-3",
							loading && "[&>section]:invisible",
						)}
					>
						{loading && <OverviewPlaceholder network />}
						<section className="flex flex-col gap-1 w-full">
							<div className="flex items-center w-full justify-between gap-1">
								<p className="text-sm font-medium md:text-base flex items-center gap-1 text-nowrap">
									<span>剩余价值 / 月估</span>
								</p>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={cycleCurrency}
										title="点击切换折算货币 (CNY / USD / HKD / EUR)"
										className="rounded-[5px] bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300 transition-colors"
									>
										{targetCurrency}
									</button>
									{fleetValuation.billedCount > 0 &&
										(showValuationPanel ? (
											<ChevronUpIcon className="size-3.5 text-muted-foreground" />
										) : (
											<ChevronDownIcon className="size-3.5 text-muted-foreground" />
										))}
								</div>
							</div>
							<section className="flex items-baseline gap-1.5 z-10">
								<NumericText
									value={`${targetSymbol}${fleetValuation.totalRemainingValue.toFixed(2)}`}
									className="text-base sm:text-[17px] font-bold text-amber-600 dark:text-amber-400 text-nowrap leading-tight"
								/>
								<span className="text-[10px] text-muted-foreground text-nowrap">
									({fleetValuation.paidCount}台计费)
								</span>
							</section>
							<section className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
								<span className="text-nowrap font-semibold text-emerald-600 dark:text-emerald-400">
									每月预估: {targetSymbol}
									{fleetValuation.totalMonthlyCost.toFixed(2)}
								</span>
								<span className="text-nowrap font-medium text-muted-foreground">
									年预估 {targetSymbol}
									{fleetValuation.totalYearlyCost.toFixed(0)}
								</span>
							</section>
						</section>
					</CardContent>
				</Card>
			</section>

			{showValuationPanel && fleetValuation.valuations.length > 0 && (
				<Card
					className={cn(
						"overflow-hidden border-stone-200/80 dark:border-stone-800/80 transition-all",
						{
							"bg-card/80 backdrop-blur-md": customBackgroundImage,
						},
					)}
				>
					<CardContent className="p-4">
						<div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-stone-200/60 dark:border-stone-800">
							<div className="flex items-center gap-2 flex-wrap min-w-0">
								<BanknotesIcon className="size-4 shrink-0 text-amber-500" />
								<h3 className="text-xs sm:text-sm font-semibold whitespace-nowrap">
									VPS 资产、剩余价值与每月预估费用明细
								</h3>
								<span className="rounded-[5px] bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
									每月预估总费用: {targetSymbol}
									{fleetValuation.totalMonthlyCost.toFixed(2)}/月 · 年预估:{" "}
									{targetSymbol}
									{fleetValuation.totalYearlyCost.toFixed(2)}/年
								</span>
								<span className="text-[11px] text-muted-foreground">
									({isLive ? "实时汇率" : "基准汇率"}:
									{targetCurrency !== "USD" &&
										` 1 USD ≈ ${usdToTarget.toFixed(2)} ${targetCurrency} ·`}
									{targetCurrency !== "EUR" &&
										` 1 EUR ≈ ${eurToTarget.toFixed(2)} ${targetCurrency} ·`}
									{targetCurrency !== "HKD" &&
										` 1 HKD ≈ ${hkdToTarget.toFixed(2)} ${targetCurrency}`}
									)
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-1.5 shrink-0">
								<div className="flex items-center gap-1 mr-1">
									<button
										type="button"
										onClick={() => handleValuationSortClick("remainingValue")}
										className={cn(
											"shrink-0 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors",
											valuationSortBy === "remainingValue"
												? "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/50"
												: "bg-secondary text-muted-foreground hover:text-foreground",
										)}
									>
										按剩余价值
										{valuationSortBy === "remainingValue"
											? valuationSortOrder === "desc"
												? " ↓"
												: " ↑"
											: ""}
									</button>
									<button
										type="button"
										onClick={() => handleValuationSortClick("monthlyCost")}
										className={cn(
											"shrink-0 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors",
											valuationSortBy === "monthlyCost"
												? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/50"
												: "bg-secondary text-muted-foreground hover:text-foreground",
										)}
									>
										按预估月费
										{valuationSortBy === "monthlyCost"
											? valuationSortOrder === "desc"
												? " ↓"
												: " ↑"
											: ""}
									</button>
								</div>
								{TARGET_CURRENCIES.map((code) => (
									<button
										key={code}
										type="button"
										onClick={() => setTargetCurrency(code)}
										className={cn(
											"shrink-0 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors",
											targetCurrency === code
												? "bg-amber-500 text-white"
												: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
										)}
									>
										{code}
									</button>
								))}
								<button
									type="button"
									onClick={() => void refreshRates()}
									className="shrink-0 whitespace-nowrap rounded-[6px] bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
								>
									刷新汇率
								</button>
							</div>
						</div>

						<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
							{sortedValuations.map((item) => (
								<div
									key={item.serverId}
									onClick={() => {
										saveMainPageScrollPosition();
										navigate(`/server/${item.serverId}`);
									}}
									className="flex flex-col gap-1.5 rounded-[10px] border border-stone-200/70 dark:border-stone-800/80 bg-background/50 p-2.5 cursor-pointer hover:border-amber-500/60 transition-all"
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-1.5 min-w-0">
											<ServerFlag country_code={item.countryCode} />
											<span className="text-xs font-semibold truncate">
												{item.serverName}
											</span>
										</div>
										<div className="flex items-center gap-1.5 shrink-0">
											{!item.isFree &&
												!item.isOneTime &&
												item.monthlyCostTarget > 0 && (
													<span className="rounded-[4px] bg-emerald-500/10 px-1 py-0.5 text-[10px] font-semibold font-mono text-emerald-600 dark:text-emerald-400">
														月估 {targetSymbol}
														{item.monthlyCostTarget.toFixed(1)}
													</span>
												)}
											<span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
												{item.isFree
													? "免费"
													: item.isOneTime
														? "永久/一次性"
														: `余值 ${targetSymbol}${item.remainingValueTarget.toFixed(2)}`}
											</span>
										</div>
									</div>

									<div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
										<span>
											套餐:{" "}
											{item.isFree
												? "免费"
												: item.isOneTime
													? item.nativePrice > 0
														? `${item.nativeCurrencySymbol}${item.nativePrice}/永久`
														: "一次性/永久"
													: `${item.nativeCurrencySymbol}${item.nativePrice}/${item.cycleLabel}`}
											{item.nativeCurrencyCode !== targetCurrency &&
											!item.isFree &&
											item.nativePrice > 0
												? ` (≈${targetSymbol}${item.priceInTarget.toFixed(1)})`
												: ""}
										</span>
										<span>
											{item.isOneTime
												? "永久有效"
												: item.isExpired
													? "已过期"
													: `剩余 ${item.remainingDays} 天 (${(item.remainingPercentage * 100).toFixed(0)}%)`}
										</span>
									</div>

									{!item.isOneTime && (
										<div className="h-[3.5px] w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
											<div
												className={cn(
													"h-full rounded-full transition-all",
													item.remainingDays <= 7
														? "bg-red-500"
														: item.remainingDays <= 15
															? "bg-amber-500"
															: "bg-emerald-500",
												)}
												style={{
													width: `${Math.min(100, Math.max(0, item.remainingPercentage * 100))}%`,
												}}
											/>
										</div>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function OverviewPlaceholder({ network = false }: { network?: boolean }) {
	return (
		<div
			aria-hidden="true"
			className="absolute inset-x-5 inset-y-3 flex flex-col justify-center gap-1"
		>
			<div className="flex h-5 items-center md:h-6">
				<SkeletonBar className="h-4 w-20 max-w-full" />
			</div>
			{network ? (
				<>
					<div className="flex h-[15px] items-center sm:h-[18px]">
						<SkeletonBar className="h-3 w-28 max-w-full" />
					</div>
					<div className="flex flex-col gap-1 sm:flex-row">
						{[0, 1].map((key) => (
							<div key={key} className="flex h-[16.5px] items-center">
								<SkeletonBar className="h-3 w-14" />
							</div>
						))}
					</div>
				</>
			) : (
				<div className="flex h-7 items-center">
					<SkeletonBar className="h-5 w-12" />
				</div>
			)}
		</div>
	);
}
