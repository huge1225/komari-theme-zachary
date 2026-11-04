import { formatBytes } from "@/lib/format";
import { cn, type PublicNoteData, parseTrafficVolumeBytes } from "@/lib/utils";

interface TrafficUsageBarProps {
	parsedData: PublicNoteData | null;
	netInTransfer: number;
	netOutTransfer: number;
	className?: string;
}

export default function TrafficUsageBar({
	parsedData,
	netInTransfer,
	netOutTransfer,
	className,
}: TrafficUsageBarProps) {
	const plan = parsedData?.planDataMod;
	if (!plan) return null;

	const limitBytes =
		typeof plan.trafficLimitBytes === "number" && plan.trafficLimitBytes > 0
			? plan.trafficLimitBytes
			: parseTrafficVolumeBytes(plan.trafficVol);

	if (!limitBytes || limitBytes <= 0) {
		return null;
	}

	const limitType = (plan.trafficLimitType || "").toLowerCase();
	const trafficType = plan.trafficType;

	let usedBytes = 0;
	if (limitType === "sum") {
		usedBytes = netInTransfer + netOutTransfer;
	} else if (limitType === "max") {
		usedBytes = Math.max(netInTransfer, netOutTransfer);
	} else if (limitType === "min") {
		usedBytes = Math.min(netInTransfer, netOutTransfer);
	} else if (limitType === "up") {
		usedBytes = netOutTransfer;
	} else if (limitType === "down") {
		usedBytes = netInTransfer;
	} else if (trafficType === "1") {
		usedBytes = Math.max(netInTransfer, netOutTransfer);
	} else {
		usedBytes = netInTransfer + netOutTransfer;
	}

	const rawPercent = (usedBytes / limitBytes) * 100;
	const clampedPercent = Math.min(Math.max(rawPercent, 0), 100);

	const barColorClass =
		rawPercent >= 90
			? "bg-red-500"
			: rawPercent >= 70
				? "bg-amber-500"
				: "bg-emerald-500";

	return (
		<section className={cn("flex w-full flex-col gap-1 pt-0.5", className)}>
			<div className="flex w-full items-center justify-between text-[10px] leading-none text-muted-foreground">
				<span className="font-medium tracking-tight">
					{formatBytes(usedBytes)} / {formatBytes(limitBytes)}
				</span>
				<span
					className={cn(
						"font-mono font-semibold",
						rawPercent >= 90
							? "text-red-500"
							: rawPercent >= 70
								? "text-amber-500"
								: "text-emerald-600 dark:text-emerald-400",
					)}
				>
					{rawPercent.toFixed(1)}%
				</span>
			</div>
			<div className="h-[4px] w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
				<div
					className={cn(
						"h-full rounded-full transition-all duration-500 ease-out",
						barColorClass,
					)}
					style={{ width: `${clampedPercent}%` }}
				/>
			</div>
		</section>
	);
}
