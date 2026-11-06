import dayjs from "dayjs";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BackIcon } from "@/components/Icon";
import { ServerDetailLoading } from "@/components/loading/ServerDetailLoading";
import ServerFlag from "@/components/ServerFlag";
import TrafficUsageBar from "@/components/TrafficUsageBar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import {
	calculateServerValuation,
	type TargetCurrencyCode,
	useExchangeRates,
} from "@/lib/billing-value";
import { formatBytes } from "@/lib/format";
import { findServerByIdentifier } from "@/lib/komari-adapter";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { safeSessionStorage } from "@/lib/storage";
import { cn, formatNezhaInfo, parsePublicNote } from "@/lib/utils";
import NumericText from "./NumericText";
import PlanInfo from "./PlanInfo";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

const TARGET_CURRENCIES: TargetCurrencyCode[] = ["CNY", "USD", "HKD", "EUR"];

function getTrafficModeLabel(limitType?: string, trafficType?: string): string {
	const mode = (limitType || "").toLowerCase();
	if (mode === "sum") return "双向求和 (SUM)";
	if (mode === "max") return "单向取大 (MAX)";
	if (mode === "min") return "取较小值 (MIN)";
	if (mode === "up") return "仅计上行 (UP)";
	if (mode === "down") return "仅计下行 (DOWN)";
	if (trafficType === "1") return "单向计费";
	return "双向计费";
}

export default function ServerDetailOverview({
	server_id,
}: {
	server_id: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();
	const {
		ratesFromCny,
		isLive,
		targetCurrency,
		setTargetCurrency,
	} = useExchangeRates();

	const [hasHistory, setHasHistory] = useState(false);

	useEffect(() => {
		const previousPath = safeSessionStorage.getItem("fromMainPage");
		if (previousPath) {
			setHasHistory(true);
		}

		return () => {
			if (previousPath) {
				safeSessionStorage.removeItem("fromMainPage");
			}
		};
	}, []);

	const { lastData, connected } = useWebSocketContext();

	const server = useMemo(
		() =>
			lastData ? findServerByIdentifier(lastData.servers, server_id) : undefined,
		[lastData, server_id],
	);

	const valuation = useMemo(
		() =>
			server && lastData
				? calculateServerValuation(
						server,
						lastData.now || Date.now(),
						targetCurrency,
						ratesFromCny,
					)
				: null,
		[server, lastData, targetCurrency, ratesFromCny],
	);

	if (!connected && !lastData) {
		return <ServerDetailLoading />;
	}

	const linkClick = () => {
		if (hasHistory) {
			navigate(-1);
		} else {
			navigate("/");
		}
	};

	const nezhaWsData = lastData;

	if (!nezhaWsData || !server) {
		return <ServerDetailLoading />;
	}

	const {
		name,
		online,
		uptime,
		version,
		arch,
		mem_total,
		disk_total,
		country_code,
		platform,
		platform_version,
		cpu_info,
		gpu_info,
		load_1,
		load_5,
		load_15,
		net_out_transfer,
		net_in_transfer,
		last_active_time_string,
		boot_time_string,
		tcp,
		udp,
		process,
	} = formatNezhaInfo(nezhaWsData.now, server);

	const parsedNote = parsePublicNote(server.public_note);
	const komariMeta = parsedNote?.komariMeta;
	const memUsed = server.state.mem_used || 0;
	const swapUsed = server.state.swap_used || 0;
	const swapTotal = server.host.swap_total || 0;
	const diskUsed = server.state.disk_used || 0;
	const hasTrafficQuota =
		(parsedNote?.planDataMod?.trafficLimitBytes ?? 0) > 0;

	countries.registerLocale(enLocale);

	return (
		<div
			className={cn("flex flex-col gap-3", {
				"bg-card/70 p-4 rounded-[10px]": customBackgroundImage,
			})}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div
					onClick={linkClick}
					className="flex flex-none cursor-pointer font-semibold leading-none items-center break-all tracking-tight gap-1.5 text-xl server-name"
				>
					<BackIcon />
					<span>{name}</span>
				</div>
				<div className="flex items-center gap-1.5 flex-wrap">
					{komariMeta?.group && (
						<Badge
							variant="secondary"
							className="text-[10px] rounded-[6px] px-2 py-0.5 font-medium"
						>
							分组: {komariMeta.group}
						</Badge>
					)}
					{komariMeta?.virtualization && (
						<Badge
							variant="outline"
							className="text-[10px] rounded-[6px] px-2 py-0.5 font-mono"
						>
							{komariMeta.virtualization}
						</Badge>
					)}
					{parsedNote?.planDataMod && <PlanInfo parsedData={parsedNote} />}
				</div>
			</div>

			{/* VPS 账单与剩余价值 + 周期流量配额卡片 */}
			{(valuation || hasTrafficQuota) && (
				<Card
					className={cn(
						"rounded-[12px] border-stone-200/80 dark:border-stone-800/80 shadow-xs",
						{
							"bg-card/60": customBackgroundImage,
						},
					)}
				>
					<CardContent className="p-3.5 sm:p-4 flex flex-col gap-3">
						{valuation && (
							<div className="flex flex-col gap-2.5">
								<div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 dark:border-stone-800 pb-2">
									<div className="flex items-center gap-2">
										<span className="h-2 w-2 rounded-full bg-amber-500" />
										<span className="text-xs sm:text-sm font-semibold">
											当前 VPS 剩余价值与账单详情
										</span>
										{!valuation.isFree && !valuation.isOneTime && (
											<span className="text-[11px] text-muted-foreground">
												(
												{valuation.nativeCurrencyCode === targetCurrency
													? `${isLive ? "实时汇率" : "基准汇率"}`
													: `1 ${valuation.nativeCurrencyCode} ≈ ${valuation.exchangeRateToTarget.toFixed(4)} ${targetCurrency}`}
												)
											</span>
										)}
									</div>
									<div className="flex items-center gap-1">
										{TARGET_CURRENCIES.map((code) => (
											<button
												key={code}
												type="button"
												onClick={() => setTargetCurrency(code)}
												className={cn(
													"rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
													targetCurrency === code
														? "bg-amber-500 text-white"
														: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
												)}
											>
												{code}
											</button>
										))}
									</div>
								</div>

								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
									<div className="flex flex-col gap-0.5">
										<span className="text-[11px] text-muted-foreground">
											当前剩余价值 ({targetCurrency})
										</span>
										<div className="flex items-baseline gap-1.5 flex-wrap">
											<span className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
												{valuation.isFree
													? "免费 (0.00)"
													: valuation.isOneTime
														? "一次性 / 永久"
														: `${valuation.targetCurrencySymbol}${valuation.remainingValueTarget.toFixed(2)}`}
											</span>
											{!valuation.isFree &&
												!valuation.isOneTime &&
												valuation.nativeCurrencyCode !== targetCurrency && (
													<span className="text-[11px] font-mono text-muted-foreground">
														({valuation.nativeCurrencySymbol}
														{valuation.remainingValueNative.toFixed(2)}{" "}
														{valuation.nativeCurrencyCode})
													</span>
												)}
										</div>
									</div>

									<div className="flex flex-col gap-0.5">
										<span className="text-[11px] text-muted-foreground">
											套餐续费价格 / 周期
										</span>
										<div className="flex items-baseline gap-1 flex-wrap text-xs sm:text-sm font-semibold">
											<span>
												{valuation.isFree
													? "免费套餐"
													: valuation.isOneTime
														? "一次性买断"
														: `${valuation.nativeCurrencySymbol}${valuation.nativePrice} / ${valuation.cycleLabel} (${valuation.cycleDays}天)`}
											</span>
											{!valuation.isFree &&
												!valuation.isOneTime &&
												valuation.nativeCurrencyCode !== targetCurrency && (
													<span className="text-[11px] font-normal text-muted-foreground">
														≈ {valuation.targetCurrencySymbol}
														{valuation.priceInTarget.toFixed(2)}
													</span>
												)}
										</div>
									</div>

									<div className="flex flex-col gap-0.5">
										<span className="text-[11px] text-muted-foreground">
											每月预估费用 ({targetCurrency})
										</span>
										{valuation.isFree || valuation.isOneTime ? (
											<div className="text-xs sm:text-sm font-semibold">
												无周期续费费用
											</div>
										) : (
											<div className="flex flex-col gap-0.5">
												<div className="flex items-baseline gap-1.5 flex-wrap">
													<span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
														{valuation.targetCurrencySymbol}
														{valuation.monthlyCostTarget.toFixed(2)}/月
													</span>
													{valuation.nativeCurrencyCode !== targetCurrency && (
														<span className="text-[11px] font-mono text-muted-foreground">
															({valuation.nativeCurrencySymbol}
															{valuation.monthlyCostNative.toFixed(2)}/月)
														</span>
													)}
												</div>
												<span className="text-[10.5px] text-muted-foreground">
													日均 {valuation.targetCurrencySymbol}
													{valuation.dailyCostTarget.toFixed(2)} · 年预估{" "}
													{valuation.targetCurrencySymbol}
													{valuation.yearlyCostTarget.toFixed(1)}
												</span>
											</div>
										)}
									</div>

									<div className="flex flex-col gap-0.5">
										<span className="text-[11px] text-muted-foreground">
											到期时间与剩余周期
										</span>
										<div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold">
											<span>
												{valuation.isOneTime
													? "永久有效"
													: valuation.endDateIso
														? dayjs(valuation.endDateIso).format("YYYY-MM-DD")
														: "未设置"}
											</span>
											{!valuation.isOneTime && (
												<Badge
													variant="secondary"
													className={cn(
														"text-[10px] px-1.5 py-0 rounded-[5px]",
														valuation.remainingDays <= 7
															? "bg-red-500/15 text-red-600 dark:text-red-400"
															: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
													)}
												>
													{valuation.isExpired
														? "已过期"
														: `剩余 ${valuation.remainingDays} 天 (${(valuation.remainingPercentage * 100).toFixed(1)}%)`}
												</Badge>
											)}
											<Badge
												variant="outline"
												className="text-[9.5px] px-1.5 py-0 rounded-[5px]"
											>
												{valuation.isOneTime
													? "长期买断"
													: valuation.autoRenewal
														? "自动续费"
														: "手动续费"}
											</Badge>
										</div>
									</div>
								</div>

								{!valuation.isOneTime && (
									<div className="h-[5px] w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
										<div
											className={cn(
												"h-full rounded-full transition-all duration-500",
												valuation.remainingDays <= 7
													? "bg-red-500"
													: valuation.remainingDays <= 15
														? "bg-amber-500"
														: "bg-emerald-500",
											)}
											style={{
												width: `${Math.min(100, Math.max(0, valuation.remainingPercentage * 100))}%`,
											}}
										/>
									</div>
								)}
							</div>
						)}

						{hasTrafficQuota && parsedNote && (
							<div
								className={cn(
									"flex flex-col gap-1.5",
									valuation &&
										"pt-2 border-t border-stone-200/60 dark:border-stone-800",
								)}
							>
								<div className="flex items-center justify-between text-xs">
									<span className="font-semibold">
										周期流量配额与使用进度
									</span>
									<span className="text-[11px] text-muted-foreground">
										计费方式:{" "}
										{getTrafficModeLabel(
											parsedNote.planDataMod?.trafficLimitType,
											parsedNote.planDataMod?.trafficType,
										)}
									</span>
								</div>
								<TrafficUsageBar
									parsedData={parsedNote}
									netInTransfer={net_in_transfer}
									netOutTransfer={net_out_transfer}
								/>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<div>
				<section className="flex flex-wrap gap-2">
					<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
						<CardContent className="px-1.5 py-1">
							<section className="flex flex-col items-start gap-0.5">
								<p className="text-xs text-muted-foreground">
									{t("serverDetail.status")}
								</p>
								<Badge
									className={cn(
										"text-[9px] rounded-[6px] w-fit px-1 py-0 -mt-[0.3px] dark:text-white",
										{
											" bg-green-800": online,
											" bg-red-600": !online,
										},
									)}
								>
									{online
										? t("serverDetail.online")
										: t("serverDetail.offline")}
								</Badge>
							</section>
						</CardContent>
					</Card>
					{online && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.uptime")}
									</p>
									<NumericText
										value={
											uptime / 86400 >= 1
												? `${Math.floor(uptime / 86400)} ${t("serverDetail.days")} ${Math.floor((uptime % 86400) / 3600)} ${t("serverDetail.hours")}`
												: `${Math.floor(uptime / 3600)} ${t("serverDetail.hours")}`
										}
										className="text-xs"
									/>
								</section>
							</CardContent>
						</Card>
					)}
					{version && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.version")}
									</p>
									<div className="text-xs">{version} </div>
								</section>
							</CardContent>
						</Card>
					)}
					{arch && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.arch")}
									</p>
									<div className="text-xs">{arch} </div>
								</section>
							</CardContent>
						</Card>
					)}
					{komariMeta?.virtualization && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">虚拟化</p>
									<div className="text-xs">{komariMeta.virtualization}</div>
								</section>
							</CardContent>
						</Card>
					)}

					{mem_total ? (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.mem")}
									</p>
									<div className="text-xs">
										{memUsed > 0
											? `${formatBytes(memUsed)} / ${formatBytes(mem_total)}`
											: formatBytes(mem_total)}
									</div>
								</section>
							</CardContent>
						</Card>
					) : null}

					{swapTotal > 0 ? (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">Swap</p>
									<div className="text-xs">
										{formatBytes(swapUsed)} / {formatBytes(swapTotal)}
									</div>
								</section>
							</CardContent>
						</Card>
					) : null}

					{disk_total ? (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.disk")}
									</p>
									<div className="text-xs">
										{diskUsed > 0
											? `${formatBytes(diskUsed)} / ${formatBytes(disk_total)}`
											: formatBytes(disk_total)}
									</div>
								</section>
							</CardContent>
						</Card>
					) : null}

					{country_code && (
						<TooltipProvider delayDuration={100}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
										<CardContent className="px-1.5 py-1">
											<section className="flex flex-col items-start gap-0.5">
												<p className="text-xs text-muted-foreground">
													{t("serverDetail.region")}
												</p>
												<section className="flex items-start gap-1">
													<div className="text-xs text-start">
														{country_code?.toUpperCase()}
													</div>
													{country_code && (
														<ServerFlag
															className="text-[11px] -mt-px"
															country_code={country_code}
														/>
													)}
												</section>
											</section>
										</CardContent>
									</Card>
								</TooltipTrigger>
								<TooltipContent>
									<p>{countries.getName(country_code?.toUpperCase(), "en")}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</section>

				<section className="flex flex-wrap gap-2 mt-1">
					{platform && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.system")}
									</p>
									<div className="text-xs">
										{" "}
										{platform}{" "}
										{platform_version ? ` - ${platform_version}` : ""}
									</div>
								</section>
							</CardContent>
						</Card>
					)}
					{cpu_info.length > 0 && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">{"CPU"}</p>
									<div className="text-xs"> {cpu_info.join(", ")}</div>
								</section>
							</CardContent>
						</Card>
					)}
					{gpu_info.length > 0 && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">{"GPU"}</p>
									<div className="text-xs">{gpu_info.join(", ")}</div>
								</section>
							</CardContent>
						</Card>
					)}
				</section>

				<section className="flex flex-wrap gap-2 mt-1">
					<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
						<CardContent className="px-1.5 py-1">
							<section className="flex flex-col items-start gap-0.5">
								<p className="text-xs text-muted-foreground">{"Load"}</p>
								<div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
									{[
										{ label: "1m", value: load_1 },
										{ label: "5m", value: load_5 },
										{ label: "15m", value: load_15 },
									].map(({ label, value }) => (
										<div key={label} className="flex items-center gap-1">
											<span className="text-[10px] text-muted-foreground">
												{label}
											</span>
											<NumericText value={`${value}`} className="text-xs" />
										</div>
									))}
								</div>
							</section>
						</CardContent>
					</Card>

					{(tcp > 0 || udp > 0 || process > 0) && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										连接数 / 进程
									</p>
									<div className="flex items-center gap-2 text-xs tabular-nums">
										<span>TCP {tcp}</span>
										<span>UDP {udp}</span>
										<span>进程 {process}</span>
									</div>
								</section>
							</CardContent>
						</Card>
					)}

					{net_out_transfer ? (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.upload")}
									</p>
									<NumericText
										value={formatBytes(net_out_transfer)}
										className="text-xs"
									/>
								</section>
							</CardContent>
						</Card>
					) : null}
					{net_in_transfer ? (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">
										{t("serverDetail.download")}
									</p>
									<NumericText
										value={formatBytes(net_in_transfer)}
										className="text-xs"
									/>
								</section>
							</CardContent>
						</Card>
					) : null}
				</section>

				<section className="flex flex-wrap gap-2 mt-1">
					{server?.state.temperatures &&
						server?.state.temperatures.length > 0 && (
							<section className="flex flex-wrap gap-2 ml-1.5">
								<Accordion type="single" collapsible className="w-fit">
									<AccordionItem value="item-1" className="border-none">
										<AccordionTrigger className="text-xs py-0 text-muted-foreground font-normal">
											{t("serverDetail.temperature")}
										</AccordionTrigger>
										<AccordionContent className="pb-0">
											<section className="flex items-start flex-wrap gap-2">
												{server?.state.temperatures.map((item, index) => (
													<div
														className="text-xs flex items-center"
														key={index}
													>
														<p className="font-semibold">{item.Name}</p>:{" "}
														{item.Temperature.toFixed(2)} °C
													</div>
												))}
											</section>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</section>
						)}
				</section>

				<section className="flex flex-wrap gap-2 mt-1">
					<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
						<CardContent className="px-1.5 py-1">
							<section className="flex flex-col items-start gap-0.5">
								<p className="text-xs text-muted-foreground">
									{t("serverDetail.bootTime")}
								</p>
								<div className="text-xs">
									{boot_time_string ? boot_time_string : "N/A"}
								</div>
							</section>
						</CardContent>
					</Card>
					<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
						<CardContent className="px-1.5 py-1">
							<section className="flex flex-col items-start gap-0.5">
								<p className="text-xs text-muted-foreground">
									{t("serverDetail.lastActive")}
								</p>
								<NumericText
									value={
										last_active_time_string ? last_active_time_string : "N/A"
									}
									className="text-xs"
								/>
							</section>
						</CardContent>
					</Card>
					{komariMeta?.plainRemark && (
						<Card className="rounded-[10px] bg-transparent border-none shadow-none ring-0">
							<CardContent className="px-1.5 py-1">
								<section className="flex flex-col items-start gap-0.5">
									<p className="text-xs text-muted-foreground">备注说明</p>
									<div className="text-xs">{komariMeta.plainRemark}</div>
								</section>
							</CardContent>
						</Card>
					)}
				</section>
			</div>
		</div>
	);
}
