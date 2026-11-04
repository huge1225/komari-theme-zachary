import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import LocalErrorBoundary from "@/components/LocalErrorBoundary";
import { ServerDetailChartLoading } from "@/components/loading/ServerDetailLoading";
import { ConnectChart } from "@/features/server-detail/ConnectChart";
import { CpuChart } from "@/features/server-detail/CpuChart";
import { DiskChart } from "@/features/server-detail/DiskChart";
import { GpuChart } from "@/features/server-detail/GpuChart";
import { MemChart } from "@/features/server-detail/MemChart";
import { NetworkChart } from "@/features/server-detail/NetworkChart";
import { PeriodSelector } from "@/features/server-detail/PeriodSelector";
import { ProcessChart } from "@/features/server-detail/ProcessChart";
import { projectRealtimeSeries } from "@/features/server-detail/realtime-series";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import {
	fetchKomariRecentFrames,
	findServerByIdentifier,
	resolveServerNumericId,
} from "@/lib/komari-adapter";
import { fetchSetting } from "@/lib/nezha-api";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export default function ServerDetailChart({
	server_id,
}: {
	server_id: string;
}) {
	const { t } = useTranslation();
	const { lastData, connected, messageHistory } = useWebSocketContext();
	const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("realtime");
	const [recentFrames, setRecentFrames] = useState<NezhaWebsocketResponse[]>([]);

	const resolvedServerId = resolveServerNumericId(server_id);

	useEffect(() => {
		const controller = new AbortController();
		fetchKomariRecentFrames(server_id, controller.signal)
			.then((frames) => {
				if (!controller.signal.aborted) {
					setRecentFrames(frames);
				}
			})
			.catch(() => undefined);
		return () => controller.abort();
	}, [server_id]);

	const combinedHistory = useMemo(() => {
		if (recentFrames.length === 0) return messageHistory;
		return [...messageHistory, ...recentFrames].slice(0, 60);
	}, [messageHistory, recentFrames]);

	const series = useMemo(
		() => projectRealtimeSeries(combinedHistory, lastData, resolvedServerId),
		[combinedHistory, lastData, resolvedServerId],
	);

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});
	const isTsdbEnabled = settingData?.data?.tsdb_enabled ?? true;

	useEffect(() => {
		if (!isTsdbEnabled && selectedPeriod !== "realtime") {
			setSelectedPeriod("realtime");
		}
	}, [isTsdbEnabled, selectedPeriod]);

	if (!connected && !lastData) {
		return <ServerDetailChartLoading />;
	}

	const nezhaWsData = lastData;

	if (!nezhaWsData) {
		return <ServerDetailChartLoading />;
	}

	const server = findServerByIdentifier(nezhaWsData.servers, server_id);

	if (!server) {
		return <ServerDetailChartLoading />;
	}

	const gpuStats = server.state.gpu || [];
	const gpuList = server.host.gpu || [];
	const gpuDetails = server.state.gpus || [];
	const chartResetKey = `${server.id}:${selectedPeriod}`;

	return (
		<section className="flex flex-col">
			<PeriodSelector
				selectedPeriod={selectedPeriod}
				onPeriodChange={setSelectedPeriod}
				isLogin={true}
				isTsdbEnabled={isTsdbEnabled}
			/>
			<section className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1 gap-3 server-charts">
				<LocalErrorBoundary title="CPU" resetKey={chartResetKey}>
					<CpuChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				{gpuStats.length >= 1 && gpuList.length === gpuStats.length
					? gpuList.map((gpu, index) => (
							<LocalErrorBoundary
								title={`GPU: ${gpu}`}
								resetKey={chartResetKey}
								key={index}
							>
								<GpuChart
									index={index}
									id={server.id}
									gpuStat={gpuStats[index]}
									gpuName={gpu}
									gpuMemory={gpuDetails[index]}
									series={series}
									period={selectedPeriod}
								/>
							</LocalErrorBoundary>
						))
					: gpuStats.length > 0
						? gpuStats.map((gpu, index) => (
								<LocalErrorBoundary
									title={`GPU #${index + 1}`}
									resetKey={chartResetKey}
									key={index}
								>
									<GpuChart
										index={index}
										id={server.id}
										gpuStat={gpu}
										gpuName={`#${index + 1}`}
										gpuMemory={gpuDetails[index]}
										series={series}
										period={selectedPeriod}
									/>
								</LocalErrorBoundary>
							))
						: null}
				<LocalErrorBoundary
					title={t("serverDetailChart.mem")}
					resetKey={chartResetKey}
				>
					<MemChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverDetailChart.disk")}
					resetKey={chartResetKey}
				>
					<DiskChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverDetailChart.process")}
					resetKey={chartResetKey}
				>
					<ProcessChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverOverview.network")}
					resetKey={chartResetKey}
				>
					<NetworkChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary title="TCP / UDP" resetKey={chartResetKey}>
					<ConnectChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
			</section>
		</section>
	);
}
