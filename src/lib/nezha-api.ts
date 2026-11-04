import type { ApiRequestOptions } from "@/lib/http";
import {
	komariFetchLoginUser,
	komariFetchMonitor,
	komariFetchServerGroup,
	komariFetchServerMetrics,
	komariFetchServerOnlineHistory,
	komariFetchService,
	komariFetchSetting,
} from "@/lib/komari-adapter";
import type {
	LoginUserResponse,
	MetricPeriod,
	MetricType,
	MonitorResponse,
	OnlineHistoryResponse,
	ServerGroupResponse,
	ServerMetricsResponse,
	ServiceResponse,
	SettingResponse,
} from "@/types/nezha-api";

export { API_ERROR_UNAUTHORIZED, isUnauthorizedError } from "@/lib/http";

export const fetchServerGroup = async (
	options?: ApiRequestOptions,
): Promise<ServerGroupResponse> => {
	return komariFetchServerGroup(options?.signal ?? undefined);
};

export const fetchLoginUser = async (
	options?: ApiRequestOptions,
): Promise<LoginUserResponse> => {
	return komariFetchLoginUser(options?.signal ?? undefined);
};

export type MonitorPeriod = "1d" | "7d" | "30d";

export const fetchMonitor = async (
	server_id: number | string,
	period?: MonitorPeriod,
	options?: ApiRequestOptions,
): Promise<MonitorResponse> => {
	return komariFetchMonitor(server_id, period, options?.signal ?? undefined);
};

export const fetchService = async (
	options?: ApiRequestOptions,
): Promise<ServiceResponse> => {
	return komariFetchService(options?.signal ?? undefined);
};

export const fetchSetting = async (
	options?: ApiRequestOptions,
): Promise<SettingResponse> => {
	return komariFetchSetting(options?.signal ?? undefined);
};

export const fetchServerMetrics = async (
	server_id: number | string,
	metric: MetricType,
	period?: MetricPeriod,
	options?: ApiRequestOptions,
): Promise<ServerMetricsResponse> => {
	return komariFetchServerMetrics(
		server_id,
		metric,
		period,
		options?.signal ?? undefined,
	);
};

export const fetchServerOnlineHistory = async (
	server_id: number | string,
	days?: number,
	options?: ApiRequestOptions,
): Promise<OnlineHistoryResponse> => {
	return komariFetchServerOnlineHistory(
		server_id,
		days,
		options?.signal ?? undefined,
	);
};
