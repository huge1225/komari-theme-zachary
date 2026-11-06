import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import { cn } from "@/lib/utils";
import type { MetricPeriod } from "@/types/nezha-api";

const DAY_PERIOD_OPTIONS: { value: MetricPeriod; days: number }[] = [
	{ value: "1d", days: 1 },
	{ value: "2d", days: 2 },
	{ value: "3d", days: 3 },
	{ value: "4d", days: 4 },
	{ value: "5d", days: 5 },
	{ value: "6d", days: 6 },
	{ value: "7d", days: 7 },
];

export function PeriodSelector({
	selectedPeriod,
	onPeriodChange,
	isLogin,
	isTsdbEnabled,
}: {
	selectedPeriod: ChartPeriod;
	onPeriodChange: (period: ChartPeriod) => void;
	isLogin: boolean;
	isTsdbEnabled: boolean;
}) {
	const { t } = useTranslation();
	const [lastDayPeriod, setLastDayPeriod] = useState<MetricPeriod>(
		selectedPeriod !== "realtime" ? selectedPeriod : "1d",
	);

	const activeDayPeriod: MetricPeriod =
		selectedPeriod !== "realtime" ? selectedPeriod : lastDayPeriod;
	const isRealtime = selectedPeriod === "realtime";
	const isHistoryActive = !isRealtime;
	const isLocked = !isTsdbEnabled || !isLogin;

	const formatDayLabel = (days: number) =>
		`${days} ${t("serverDetail.days", "天")}`;

	const handleSelectDayPeriod = (val: string) => {
		const nextPeriod = val as MetricPeriod;
		setLastDayPeriod(nextPeriod);
		onPeriodChange(nextPeriod);
	};

	const dayDropdown = (
		<div
			onClick={() => {
				if (!isLocked && isRealtime) {
					onPeriodChange(activeDayPeriod);
				}
			}}
			className="flex items-center"
		>
			<Select
				value={activeDayPeriod}
				onValueChange={handleSelectDayPeriod}
				disabled={isLocked}
			>
				<SelectTrigger
					className={cn(
						"h-7 w-auto min-w-[76px] gap-1.5 rounded-full border-0 px-3 py-1 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 transition-all",
						isHistoryActive
							? "bg-white dark:bg-background text-foreground ring-1 ring-border/60 dark:ring-border/40"
							: "bg-transparent text-muted-foreground hover:text-foreground",
						isLocked && "cursor-not-allowed opacity-40 grayscale",
					)}
				>
					<SelectValue>
						{formatDayLabel(
							DAY_PERIOD_OPTIONS.find((o) => o.value === activeDayPeriod)
								?.days ?? 1,
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent align="start" className="min-w-[96px]">
					{DAY_PERIOD_OPTIONS.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							className="text-xs cursor-pointer"
						>
							{formatDayLabel(option.days)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);

	return (
		<TooltipProvider delayDuration={120}>
			<div className="relative flex items-center gap-1 mb-3 flex-wrap sm:-mt-5 -mt-3 p-0.5 bg-muted dark:bg-muted/40 rounded-full w-fit border border-border/60 dark:border-border">
				<button
					type="button"
					onClick={() => onPeriodChange("realtime")}
					className={cn(
						"relative cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-all",
						isRealtime
							? "bg-white dark:bg-background text-foreground ring-1 ring-border/60 dark:ring-border/40"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<div className="relative z-20 flex items-center gap-1.5">
						<span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 dark:bg-emerald-400"></span>
						{t("serverDetailChart.realtime", "实时")}
					</div>
				</button>

				{isLocked ? (
					<Tooltip>
						<TooltipTrigger asChild>{dayDropdown}</TooltipTrigger>
						<TooltipContent>
							{!isTsdbEnabled
								? t(
										"serverDetailChart.tsdbRequired",
										"Enable TSDB to use historical data",
									)
								: t("serverDetailChart.loginRequired", "Please login to view")}
						</TooltipContent>
					</Tooltip>
				) : (
					dayDropdown
				)}
			</div>
		</TooltipProvider>
	);
}
