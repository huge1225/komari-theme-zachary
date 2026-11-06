import dayjs from "dayjs";
import { formatBytes } from "@/lib/format";
import { applyKomariThemeSettings } from "@/features/runtime-config/runtime-config";
import type {
	CycleTransferStats,
	LoginUserResponse,
	MetricPeriod,
	MetricType,
	MonitorPeriod,
	MonitorResponse,
	NezhaMonitor,
	NezhaServer,
	NezhaWebsocketResponse,
	OnlineHistoryData,
	OnlineHistoryResponse,
	OnlinePeriod,
	ServerGroup,
	ServerGroupResponse,
	ServerMetricsResponse,
	ServiceData,
	ServiceResponse,
	SettingResponse,
} from "@/types/nezha-api";

export interface KomariNode {
	uuid: string;
	name: string;
	cpu_name?: string;
	virtualization?: string;
	arch?: string;
	cpu_cores?: number;
	os?: string;
	kernel_version?: string;
	gpu_name?: string;
	region?: string;
	mem_total?: number;
	swap_total?: number;
	disk_total?: number;
	version?: string;
	weight?: number;
	price?: number;
	billing_cycle?: number;
	auto_renewal?: boolean;
	currency?: string;
	expired_at?: string;
	group?: string;
	tags?: string;
	hidden?: boolean;
	traffic_limit?: number;
	traffic_limit_type?: "sum" | "max" | "min" | "up" | "down" | string;
	ipv4?: string;
	ipv6?: string;
	created_at?: string;
	updated_at?: string;
	public_remark?: string;
}

export interface KomariNodeStatus {
	client?: string;
	online?: boolean;
	cpu?: number | { usage?: number };
	gpu?:
		| number
		| {
				count?: number;
				average_usage?: number;
				detailed_info?: Array<{
					name?: string;
					utilization?: number;
					memory_used?: number;
					memory_total?: number;
					temperature?: number;
				}>;
		  };
	ram?: number | { used?: number; total?: number };
	ram_total?: number;
	swap?: number | { used?: number; total?: number };
	swap_total?: number;
	load?: number | { load1?: number; load5?: number; load15?: number };
	load5?: number;
	load15?: number;
	temp?: number;
	disk?: number | { used?: number; total?: number };
	disk_total?: number;
	net_in?: number;
	net_out?: number;
	net_total_up?: number;
	net_total_out?: number;
	net_total_down?: number;
	net_total_in?: number;
	network?: {
		up?: number;
		down?: number;
		totalUp?: number;
		totalDown?: number;
	};
	connections?: number | { tcp?: number; udp?: number };
	connections_udp?: number;
	uptime?: number;
	process?: number;
	time?: string;
	updated_at?: string;
}

interface KomariPublicInfo {
	allow_cors?: boolean;
	custom_body?: string;
	custom_head?: string;
	description?: string;
	disable_password_login?: boolean;
	oauth_enable?: boolean;
	oauth_provider?: string;
	ping_record_preserve_time?: number;
	metric_retention_days?: number;
	private_site?: boolean;
	record_enabled?: boolean;
	record_preserve_time?: number;
	sitename?: string;
	theme?: string;
	theme_settings?: Record<string, unknown> | null;
}

interface KomariPingTask {
	id: number;
	weight?: number;
	name: string;
	type?: string;
	interval?: number;
	clients?: string[];
	loss?: number;
}

interface KomariMetricSeries {
	metric_key: string;
	entity_id: string;
	tags?: Record<string, string>;
	points?: Array<{
		time: string;
		value: number | null;
		tags?: Record<string, string>;
	}>;
}

// ============================================================================
// Bidirectional UUID <-> Numeric ID Registry
// ============================================================================
const uuidToIdMap = new Map<string, number>();
const idToUuidMap = new Map<number, string>();
const nodeCacheByUuid = new Map<string, KomariNode>();
const statusCacheByUuid = new Map<string, KomariNodeStatus>();
let nextSequentialId = 1;

export function getServerNumericId(uuid: string): number {
	const normalized = String(uuid || "").trim();
	if (!normalized) return 0;
	const existing = uuidToIdMap.get(normalized);
	if (existing !== undefined) return existing;

	// If uuid is already a positive integer string, use it if free
	const parsedInt = Number(normalized);
	if (
		Number.isInteger(parsedInt) &&
		parsedInt > 0 &&
		!idToUuidMap.has(parsedInt)
	) {
		uuidToIdMap.set(normalized, parsedInt);
		idToUuidMap.set(parsedInt, normalized);
		if (parsedInt >= nextSequentialId) {
			nextSequentialId = parsedInt + 1;
		}
		return parsedInt;
	}

	while (idToUuidMap.has(nextSequentialId)) {
		nextSequentialId++;
	}
	const assignedId = nextSequentialId++;
	uuidToIdMap.set(normalized, assignedId);
	idToUuidMap.set(assignedId, normalized);
	return assignedId;
}

export function getServerUuidById(idOrUuid: number | string): string | undefined {
	if (typeof idOrUuid === "number") {
		return idToUuidMap.get(idOrUuid);
	}
	const trimmed = String(idOrUuid).trim();
	if (uuidToIdMap.has(trimmed)) {
		return trimmed;
	}
	const asNum = Number(trimmed);
	if (Number.isFinite(asNum) && idToUuidMap.has(asNum)) {
		return idToUuidMap.get(asNum);
	}
	return trimmed || undefined;
}

export function resolveServerNumericId(idOrUuid: number | string): number {
	if (typeof idOrUuid === "number" && Number.isFinite(idOrUuid)) {
		return idOrUuid;
	}
	const trimmed = String(idOrUuid).trim();
	if (uuidToIdMap.has(trimmed)) {
		return uuidToIdMap.get(trimmed)!;
	}
	const asNum = Number(trimmed);
	if (Number.isFinite(asNum)) {
		return asNum;
	}
	return getServerNumericId(trimmed);
}

export function findServerByIdentifier(
	servers: NezhaServer[],
	identifier: string | number | undefined,
): NezhaServer | undefined {
	if (identifier === undefined || identifier === null) return undefined;
	const targetId = resolveServerNumericId(identifier);
	const foundById = servers.find((s) => s.id === targetId);
	if (foundById) return foundById;

	const raw = String(identifier).trim();
	const mappedId = uuidToIdMap.get(raw);
	if (mappedId !== undefined) {
		return servers.find((s) => s.id === mappedId);
	}
	return undefined;
}

// ============================================================================
// Region / Flag Emoji / Country Name -> ISO-3166-1 alpha-2 Normalizer
// ============================================================================
const REGION_ALIAS_MAP: Record<string, string> = {
	hk: "hk",
	hongkong: "hk",
	"hong kong": "hk",
	香港: "hk",
	cn: "cn",
	china: "cn",
	中国: "cn",
	prc: "cn",
	tw: "tw",
	taiwan: "tw",
	台湾: "tw",
	台灣: "tw",
	mo: "mo",
	macau: "mo",
	macao: "mo",
	澳门: "mo",
	澳門: "mo",
	jp: "jp",
	japan: "jp",
	日本: "jp",
	kr: "kr",
	korea: "kr",
	"south korea": "kr",
	韩国: "kr",
	韓國: "kr",
	sg: "sg",
	singapore: "sg",
	新加坡: "sg",
	us: "us",
	usa: "us",
	"united states": "us",
	america: "us",
	美国: "us",
	美國: "us",
	ca: "ca",
	canada: "ca",
	加拿大: "ca",
	gb: "gb",
	uk: "gb",
	"united kingdom": "gb",
	britain: "gb",
	england: "gb",
	英国: "gb",
	英國: "gb",
	de: "de",
	germany: "de",
	deutschland: "de",
	德国: "de",
	德國: "de",
	fr: "fr",
	france: "fr",
	法国: "fr",
	法國: "fr",
	nl: "nl",
	netherlands: "nl",
	holland: "nl",
	荷兰: "nl",
	荷蘭: "nl",
	ru: "ru",
	russia: "ru",
	俄罗斯: "ru",
	俄羅斯: "ru",
	au: "au",
	australia: "au",
	澳大利亚: "au",
	澳洲: "au",
	in: "in",
	india: "in",
	印度: "in",
	br: "br",
	brazil: "br",
	巴西: "br",
	it: "it",
	italy: "it",
	意大利: "it",
	es: "es",
	spain: "es",
	西班牙: "es",
	se: "se",
	sweden: "se",
	瑞典: "se",
	ch: "ch",
	switzerland: "ch",
	瑞士: "ch",
	fi: "fi",
	finland: "fi",
	芬兰: "fi",
	no: "no",
	norway: "no",
	挪威: "no",
	pl: "pl",
	poland: "pl",
	波兰: "pl",
	tr: "tr",
	turkey: "tr",
	土耳其: "tr",
	my: "my",
	malaysia: "my",
	马来西亚: "my",
	th: "th",
	thailand: "th",
	泰国: "th",
	vn: "vn",
	vietnam: "vn",
	越南: "vn",
	id: "id",
	indonesia: "id",
	印尼: "id",
	印度尼西亚: "id",
	ph: "ph",
	philippines: "ph",
	菲律宾: "ph",
	ae: "ae",
	uae: "ae",
	阿联酋: "ae",
	za: "za",
	"south africa": "za",
	南非: "za",
};

export function normalizeCountryCode(region?: string): string {
	if (!region) return "";
	const trimmed = region.trim();
	if (!trimmed) return "";

	// 1. Check Unicode Regional Indicator Symbol flag emojis (e.g. 🇭🇰, 🇯🇵, 🇺🇸)
	const codePoints = Array.from(trimmed).map((ch) => ch.codePointAt(0) ?? 0);
	const regionalIndicators = codePoints.filter(
		(cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff,
	);
	if (regionalIndicators.length >= 2) {
		const first = String.fromCharCode(regionalIndicators[0] - 0x1f1e6 + 65);
		const second = String.fromCharCode(regionalIndicators[1] - 0x1f1e6 + 65);
		return `${first}${second}`.toLowerCase();
	}

	// 2. Direct 2-letter ISO code
	if (/^[a-zA-Z]{2}$/.test(trimmed)) {
		const lower = trimmed.toLowerCase();
		return lower === "uk" ? "gb" : lower;
	}

	// 3. Alias table lookup
	const lower = trimmed.toLowerCase();
	if (REGION_ALIAS_MAP[lower]) {
		return REGION_ALIAS_MAP[lower];
	}

	// 4. Substring search in aliases
	for (const [alias, code] of Object.entries(REGION_ALIAS_MAP)) {
		if (alias.length >= 2 && lower.includes(alias)) {
			return code;
		}
	}

	return trimmed.slice(0, 2).toLowerCase();
}

// ============================================================================
// OS Platform & Version Normalizer
// ============================================================================
export function normalizeOsInfo(
	os?: string,
	kernelVersion?: string,
): { platform: string; platform_version: string } {
	const raw = (os || "").trim();
	const lower = raw.toLowerCase();

	if (!raw) {
		return {
			platform: "linux",
			platform_version: kernelVersion || "",
		};
	}

	if (lower.includes("windows") || lower.startsWith("microsoft")) {
		const versionMatch = raw.replace(/microsoft\s*/i, "").trim();
		return {
			platform: "Windows",
			platform_version: versionMatch || kernelVersion || "",
		};
	}

	const distroRules: Array<{ keywords: string[]; platform: string }> = [
		{ keywords: ["ubuntu"], platform: "ubuntu" },
		{ keywords: ["debian"], platform: "debian" },
		{ keywords: ["almalinux", "alma"], platform: "almalinux" },
		{ keywords: ["rocky"], platform: "rocky-linux" },
		{ keywords: ["centos"], platform: "centos" },
		{ keywords: ["alpine"], platform: "alpine" },
		{ keywords: ["arch"], platform: "archlinux" },
		{ keywords: ["kali"], platform: "kali-linux" },
		{ keywords: ["fedora"], platform: "fedora" },
		{ keywords: ["opensuse", "suse"], platform: "opensuse" },
		{ keywords: ["redhat", "rhel", "red hat", "amazon"], platform: "redhat" },
		{ keywords: ["freebsd"], platform: "freebsd" },
		{ keywords: ["openbsd"], platform: "openbsd" },
		{ keywords: ["nixos", "nix"], platform: "nixos" },
		{ keywords: ["gentoo"], platform: "gentoo" },
		{ keywords: ["manjaro"], platform: "manjaro" },
		{ keywords: ["mint"], platform: "linuxmint" },
		{ keywords: ["deepin"], platform: "deepin" },
		{ keywords: ["elementary"], platform: "elementary" },
		{ keywords: ["pop!_os", "pop-os", "popos"], platform: "pop-os" },
		{ keywords: ["zorin"], platform: "zorin" },
		{ keywords: ["void"], platform: "void" },
		{ keywords: ["aosc"], platform: "aosc" },
		{ keywords: ["coreos"], platform: "coreos" },
		{ keywords: ["openwrt", "immortalwrt", "istoreos"], platform: "openwrt" },
		{ keywords: ["darwin", "macos", "mac os", "apple"], platform: "darwin" },
		{ keywords: ["docker"], platform: "docker" },
		{ keywords: ["raspbian", "raspberry"], platform: "raspberry-pi" },
	];

	for (const rule of distroRules) {
		if (rule.keywords.some((kw) => lower.includes(kw))) {
			const verMatch = raw.match(/(\d+(?:\.\d+)*)/);
			const ver = verMatch ? verMatch[1] : kernelVersion || "";
			return {
				platform: rule.platform,
				platform_version: ver,
			};
		}
	}

	return {
		platform: "linux",
		platform_version: raw || kernelVersion || "",
	};
}

// ============================================================================
// Billing & Plan Data (public_note) Synthesizer
// ============================================================================
function mapBillingCycleToLabel(days?: number): string {
	if (!days || days <= 0) return "";
	if (days >= 28 && days <= 31) return "月";
	if (days >= 89 && days <= 93) return "季";
	if (days >= 180 && days <= 186) return "半年";
	if (days >= 360 && days <= 366) return "年";
	if (days >= 720 && days <= 732) return "2年";
	if (days >= 1080 && days <= 1100) return "3年";
	return `${days}天`;
}

function isValidExpiryDate(dateStr?: string): boolean {
	if (!dateStr) return false;
	if (dateStr.startsWith("0001-01-01") || dateStr.startsWith("1970-01-01")) {
		return false;
	}
	const parsed = dayjs(dateStr);
	return parsed.isValid() && parsed.year() > 1971;
}

function isPermanentExpiryDate(dateStr?: string): boolean {
	if (!dateStr) return false;
	if (dateStr.startsWith("0000-00-00")) return true;
	const parsed = dayjs(dateStr);
	if (!parsed.isValid()) return false;
	return parsed.year() >= 2090 || parsed.diff(dayjs(), "day") >= 3650;
}

export function synthesizePublicNote(node: KomariNode): string {
	// 1. Check if public_remark already contains Nezha JSON
	let existingObj: Record<string, any> | null = null;
	if (node.public_remark && node.public_remark.trim().startsWith("{")) {
		try {
			const parsed = JSON.parse(node.public_remark.trim());
			if (parsed && typeof parsed === "object") {
				existingObj = parsed;
			}
		} catch {
			// Ignore invalid JSON and treat as plain remark
		}
	}

	const result: Record<string, any> = existingObj ? { ...existingObj } : {};

	// 2. Synthesize billingDataMod from Komari native billing fields if not already specified
	const hasValidExpiry = isValidExpiryDate(node.expired_at);
	const isPermanent =
		isPermanentExpiryDate(node.expired_at) ||
		node.price === -1 ||
		(typeof node.billing_cycle === "number" && node.billing_cycle >= 3650);
	const hasPrice =
		typeof node.price === "number" && (node.price > 0 || node.price === -1);

	if (!result.billingDataMod && (hasValidExpiry || hasPrice)) {
		const cycleLabel = isPermanent
			? "永久"
			: mapBillingCycleToLabel(node.billing_cycle);
		const currency = node.currency || "￥";
		let amount = "";
		if (node.price === -1) {
			amount = "-1";
		} else if (typeof node.price === "number" && node.price > 0) {
			amount = `${currency}${node.price}`;
		} else if (hasValidExpiry) {
			amount = "0";
		}

		const endDate = isPermanent
			? "0000-00-00T23:59:59Z"
			: hasValidExpiry
				? node.expired_at!
				: dayjs().add(30, "day").toISOString();
		const startDate =
			node.created_at && isValidExpiryDate(node.created_at)
				? node.created_at
				: dayjs()
						.subtract(node.billing_cycle || 30, "day")
						.toISOString();

		result.billingDataMod = {
			startDate,
			endDate,
			autoRenewal: node.auto_renewal ? "1" : "0",
			cycle: cycleLabel || "月",
			amount,
		};
	}

	// 3. Synthesize planDataMod from Komari traffic_limit, tags, public_remark
	const hasTrafficLimit =
		typeof node.traffic_limit === "number" && node.traffic_limit > 0;
	const rawTags = (node.tags || "")
		.split(";")
		.map((t) => t.trim())
		.filter(Boolean);
	const plainRemark =
		!existingObj && node.public_remark ? node.public_remark.trim() : "";

	if (
		!result.planDataMod &&
		(hasTrafficLimit || rawTags.length > 0 || plainRemark)
	) {
		const trafficVol = hasTrafficLimit ? formatBytes(node.traffic_limit!) : "";
		const limitType = (node.traffic_limit_type || "max").toLowerCase();
		const trafficType =
			limitType === "up" || limitType === "down" || limitType === "min"
				? "1"
				: "2";

		const routeTags = rawTags.slice(0, 2).join(",");
		const extraTags = [
			...rawTags.slice(2),
			...(plainRemark ? [plainRemark] : []),
		].join(",");

		result.planDataMod = {
			bandwidth: "",
			trafficVol,
			trafficType,
			trafficLimitBytes: hasTrafficLimit ? node.traffic_limit! : 0,
			trafficLimitType: limitType,
			IPv4: node.ipv4 ? "1" : "",
			IPv6: node.ipv6 ? "1" : "",
			networkRoute: routeTags,
			extra: extraTags,
		};
	} else if (result.planDataMod && hasTrafficLimit) {
		if (!result.planDataMod.trafficLimitBytes) {
			result.planDataMod.trafficLimitBytes = node.traffic_limit!;
		}
		if (!result.planDataMod.trafficLimitType) {
			result.planDataMod.trafficLimitType = (
				node.traffic_limit_type || "max"
			).toLowerCase();
		}
	}

	result.komariMeta = {
		uuid: node.uuid,
		price: node.price,
		currency: node.currency,
		billingCycle: node.billing_cycle,
		autoRenewal: node.auto_renewal,
		expiredAt: hasValidExpiry ? node.expired_at : undefined,
		createdAt:
			node.created_at && isValidExpiryDate(node.created_at)
				? node.created_at
				: undefined,
		virtualization: node.virtualization || undefined,
		cpuCores: node.cpu_cores || undefined,
		group: node.group || undefined,
		tags: rawTags.length > 0 ? rawTags : undefined,
		ipv4: node.ipv4 || undefined,
		ipv6: node.ipv6 || undefined,
		weight: node.weight,
		plainRemark: plainRemark || undefined,
		trafficLimitBytes: hasTrafficLimit ? node.traffic_limit : undefined,
		trafficLimitType: node.traffic_limit_type || undefined,
	};

	return JSON.stringify(result);
}

// ============================================================================
// Convert Komari Node + Status into NezhaServer
// ============================================================================
export function convertKomariToNezhaServer(
	node: KomariNode,
	status?: KomariNodeStatus,
): NezhaServer {
	const id = getServerNumericId(node.uuid);
	const { platform, platform_version } = normalizeOsInfo(
		node.os,
		node.kernel_version,
	);
	const country_code = normalizeCountryCode(node.region);

	const cpuUsage =
		typeof status?.cpu === "number"
			? status.cpu
			: typeof status?.cpu?.usage === "number"
				? status.cpu.usage
				: 0;

	const memUsed =
		typeof status?.ram === "number"
			? status.ram
			: typeof status?.ram?.used === "number"
				? status.ram.used
				: 0;

	const swapUsed =
		typeof status?.swap === "number"
			? status.swap
			: typeof status?.swap?.used === "number"
				? status.swap.used
				: 0;

	const diskUsed =
		typeof status?.disk === "number"
			? status.disk
			: typeof status?.disk?.used === "number"
				? status.disk.used
				: 0;

	const netInSpeed =
		typeof status?.net_in === "number"
			? status.net_in
			: (status?.network?.down ?? 0);

	const netOutSpeed =
		typeof status?.net_out === "number"
			? status.net_out
			: (status?.network?.up ?? 0);

	const netInTransfer =
		status?.net_total_down ??
		status?.net_total_in ??
		status?.network?.totalDown ??
		0;

	const netOutTransfer =
		status?.net_total_up ??
		status?.net_total_out ??
		status?.network?.totalUp ??
		0;

	const load1 =
		typeof status?.load === "number"
			? status.load
			: (status?.load?.load1 ?? 0);
	const load5 =
		typeof status?.load5 === "number"
			? status.load5
			: typeof status?.load === "object" && status?.load
				? (status.load.load5 ?? 0)
				: 0;
	const load15 =
		typeof status?.load15 === "number"
			? status.load15
			: typeof status?.load === "object" && status?.load
				? (status.load.load15 ?? 0)
				: 0;

	const tcpConn =
		typeof status?.connections === "number"
			? status.connections
			: (status?.connections?.tcp ?? 0);
	const udpConn =
		typeof status?.connections_udp === "number"
			? status.connections_udp
			: typeof status?.connections === "object" && status?.connections
				? (status.connections.udp ?? 0)
				: 0;

	const uptime = status?.uptime ?? 0;
	const processCount = status?.process ?? 0;
	const tempVal = status?.temp ?? 0;

	const cpuLabel = node.cpu_name
		? `${node.cpu_name}${node.cpu_cores ? ` (${node.cpu_cores} Cores)` : ""}${node.virtualization ? ` [${node.virtualization}]` : ""}`
		: node.cpu_cores
			? `${node.cpu_cores} Cores`
			: "";

	const gpuNames = node.gpu_name
		? node.gpu_name
				.split(/[;,]/)
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	let gpuUtilizations: number[] = [];
	let gpusDetailed:
		| {
				utilization: number;
				memory_used?: number;
				memory_total?: number;
		  }[]
		| undefined;

	if (typeof status?.gpu === "number" && (gpuNames.length > 0 || status.gpu > 0)) {
		gpuUtilizations = [status.gpu];
	} else if (typeof status?.gpu === "object" && status?.gpu) {
		const gpuObj = status.gpu;
		if (
			Array.isArray(gpuObj.detailed_info) &&
			gpuObj.detailed_info.length > 0
		) {
			gpuUtilizations = gpuObj.detailed_info.map(
				(g) => g.utilization ?? gpuObj.average_usage ?? 0,
			);
			gpusDetailed = gpuObj.detailed_info.map((g) => ({
				utilization: g.utilization ?? 0,
				memory_used: g.memory_used,
				memory_total: g.memory_total,
			}));
		} else if (typeof gpuObj.average_usage === "number") {
			gpuUtilizations = [gpuObj.average_usage];
		}
	}

	// Determine online status and last_active timestamp
	const isOnline = Boolean(status?.online);
	const nowMs = Date.now();
	const rawTime = status?.time || status?.updated_at || node.updated_at;
	let lastActiveIso: string;

	if (isOnline) {
		lastActiveIso = new Date(nowMs).toISOString();
	} else if (
		rawTime &&
		!rawTime.startsWith("0001-01-01") &&
		Number.isFinite(new Date(rawTime).getTime())
	) {
		const parsedMs = new Date(rawTime).getTime();
		// Ensure offline server is older than 180s threshold used by selectServerMetrics
		lastActiveIso =
			nowMs - parsedMs < 185_000
				? new Date(nowMs - 300_000).toISOString()
				: new Date(parsedMs).toISOString();
	} else {
		lastActiveIso = new Date(0).toISOString();
	}

	const bootTimeSec =
		uptime > 0 ? Math.floor((nowMs - uptime * 1000) / 1000) : 0;

	return {
		id,
		name: node.name || node.uuid,
		public_note: synthesizePublicNote(node),
		last_active: lastActiveIso,
		country_code,
		host: {
			platform,
			platform_version,
			cpu: cpuLabel ? [cpuLabel] : [],
			gpu: gpuNames,
			mem_total: node.mem_total || status?.ram_total || 0,
			disk_total: node.disk_total || status?.disk_total || 0,
			swap_total: node.swap_total || status?.swap_total || 0,
			arch: node.arch || "",
			boot_time: bootTimeSec,
			version: node.version || "",
		},
		state: {
			cpu: cpuUsage,
			mem_used: memUsed,
			swap_used: swapUsed,
			disk_used: diskUsed,
			net_in_transfer: netInTransfer,
			net_out_transfer: netOutTransfer,
			net_in_speed: netInSpeed,
			net_out_speed: netOutSpeed,
			uptime,
			load_1: load1,
			load_5: load5,
			load_15: load15,
			tcp_conn_count: tcpConn,
			udp_conn_count: udpConn,
			process_count: processCount,
			temperatures:
				tempVal > 0 ? [{ Name: "CPU", Temperature: tempVal }] : [],
			gpu: gpuUtilizations,
			gpus: gpusDetailed,
		},
	};
}

// ============================================================================
// Low-level RPC2 & REST Helpers
// ============================================================================
let rpcIdCounter = 1;

export async function rpc2Call<TParams = unknown, TResult = any>(
	method: string,
	params?: TParams,
	signal?: AbortSignal,
): Promise<TResult> {
	const response = await fetch("/api/rpc2", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		credentials: "include",
		signal,
		body: JSON.stringify({
			jsonrpc: "2.0",
			method,
			params: params ?? {},
			id: rpcIdCounter++,
		}),
	});

	if (!response.ok) {
		throw new Error(`RPC2 HTTP error ${response.status} for ${method}`);
	}

	const json = await response.json();
	if (json?.error) {
		throw new Error(json.error.message || `RPC2 error in ${method}`);
	}
	return json?.result as TResult;
}

async function getKomariJson<T = any>(
	url: string,
	signal?: AbortSignal,
): Promise<T> {
	const response = await fetch(url, {
		method: "GET",
		headers: { Accept: "application/json" },
		credentials: "include",
		signal,
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} fetching ${url}`);
	}
	const contentType = response.headers.get("content-type") || "";
	if (!contentType.includes("application/json")) {
		throw new Error(`Non-JSON response from ${url}`);
	}
	return (await response.json()) as T;
}

// ============================================================================
// Mock / Demo Mode Fallback (for standalone preview when Komari API is absent)
// ============================================================================
let isDemoMode = false;

function shouldUseDemoMode(): boolean {
	if (typeof window !== "undefined") {
		const params = new URLSearchParams(window.location.search);
		if (params.get("mock") === "1" || params.get("demo") === "1") {
			return true;
		}
	}
	return isDemoMode;
}

const DEMO_NODES: KomariNode[] = [
	{
		uuid: "hk-bgp-01",
		name: "HongKong-BGP-Pro",
		cpu_name: "AMD EPYC 9654",
		virtualization: "KVM",
		arch: "amd64",
		cpu_cores: 4,
		os: "Debian GNU/Linux 12 (bookworm)",
		kernel_version: "6.6.16-amd64",
		region: "🇭🇰",
		mem_total: 8 * 1024 * 1024 * 1024,
		swap_total: 2 * 1024 * 1024 * 1024,
		disk_total: 80 * 1024 * 1024 * 1024,
		version: "1.1.4",
		weight: 1,
		price: 49.9,
		billing_cycle: 30,
		auto_renewal: true,
		currency: "$",
		expired_at: dayjs().add(22, "day").toISOString(),
		group: "Asia-Premium",
		tags: "CN2 GIA;CMI;10Gbps",
		traffic_limit: 2 * 1024 * 1024 * 1024 * 1024,
		traffic_limit_type: "max",
		ipv4: "103.21.44.1",
		ipv6: "2400:cb00::1",
	},
	{
		uuid: "jp-tyo-02",
		name: "Tokyo-IIJ-01",
		cpu_name: "Intel Xeon Platinum 8480+",
		virtualization: "KVM",
		arch: "amd64",
		cpu_cores: 2,
		os: "Ubuntu 24.04.1 LTS",
		kernel_version: "6.8.0-45-generic",
		region: "🇯🇵",
		mem_total: 4 * 1024 * 1024 * 1024,
		swap_total: 1 * 1024 * 1024 * 1024,
		disk_total: 40 * 1024 * 1024 * 1024,
		version: "1.1.4",
		weight: 2,
		price: 299,
		billing_cycle: 365,
		auto_renewal: true,
		currency: "¥",
		expired_at: dayjs().add(195, "day").toISOString(),
		group: "Asia-Premium",
		tags: "IIJ;SoftBank;2.5Gbps",
		traffic_limit: 1024 * 1024 * 1024 * 1024,
		traffic_limit_type: "sum",
		ipv4: "45.32.18.9",
	},
	{
		uuid: "sg-equinix-03",
		name: "Singapore-Equinix-SG1",
		cpu_name: "AMD Ryzen 9 7950X",
		virtualization: "KVM",
		arch: "amd64",
		cpu_cores: 8,
		os: "Alpine Linux v3.20",
		kernel_version: "6.6.32-0-virt",
		region: "🇸🇬",
		mem_total: 16 * 1024 * 1024 * 1024,
		swap_total: 4 * 1024 * 1024 * 1024,
		disk_total: 160 * 1024 * 1024 * 1024,
		version: "1.1.4",
		weight: 3,
		price: 120,
		billing_cycle: 90,
		auto_renewal: true,
		currency: "$",
		expired_at: dayjs().add(64, "day").toISOString(),
		group: "Asia-Premium",
		tags: "PCCW;Lumen;10Gbps",
		traffic_limit: 4 * 1024 * 1024 * 1024 * 1024,
		traffic_limit_type: "max",
		ipv4: "139.180.132.10",
		ipv6: "2401:c080::10",
	},
	{
		uuid: "us-lax-04",
		name: "LosAngeles-CN2GIA-GPU",
		cpu_name: "AMD EPYC 7763",
		gpu_name: "NVIDIA RTX 4090",
		virtualization: "Dedicated",
		arch: "amd64",
		cpu_cores: 16,
		os: "Rocky Linux 9.4",
		kernel_version: "5.14.0-427.el9",
		region: "🇺🇸",
		mem_total: 64 * 1024 * 1024 * 1024,
		swap_total: 8 * 1024 * 1024 * 1024,
		disk_total: 1000 * 1024 * 1024 * 1024,
		version: "1.1.4",
		weight: 4,
		price: 199,
		billing_cycle: 30,
		auto_renewal: true,
		currency: "$",
		expired_at: dayjs().add(15, "day").toISOString(),
		group: "US-West",
		tags: "AS4809;AS9929;GPU",
		traffic_limit: 10 * 1024 * 1024 * 1024 * 1024,
		traffic_limit_type: "max",
		ipv4: "172.104.22.8",
		ipv6: "2600:3c01::8",
	},
	{
		uuid: "de-fra-05",
		name: "Frankfurt-9929-Core",
		cpu_name: "AMD EPYC 9554P",
		virtualization: "KVM",
		arch: "amd64",
		cpu_cores: 4,
		os: "Arch Linux",
		kernel_version: "6.10.6-arch1-1",
		region: "🇩🇪",
		mem_total: 8 * 1024 * 1024 * 1024,
		swap_total: 2 * 1024 * 1024 * 1024,
		disk_total: 120 * 1024 * 1024 * 1024,
		version: "1.1.4",
		weight: 5,
		price: -1,
		billing_cycle: 365,
		auto_renewal: true,
		currency: "€",
		expired_at: dayjs().add(310, "day").toISOString(),
		group: "Europe",
		tags: "CUII;RETN;2.5Gbps",
		ipv4: "185.209.160.5",
		ipv6: "2a0b:4141::5",
	},
	{
		uuid: "gb-lon-06",
		name: "London-WinServer-Backup",
		cpu_name: "Intel Core i9-14900K",
		virtualization: "KVM",
		arch: "amd64",
		cpu_cores: 4,
		os: "Windows Server 2022",
		kernel_version: "10.0.20348",
		region: "🇬🇧",
		mem_total: 16 * 1024 * 1024 * 1024,
		swap_total: 4 * 1024 * 1024 * 1024,
		disk_total: 500 * 1024 * 1024 * 1024,
		version: "1.1.3",
		weight: 6,
		price: 35,
		billing_cycle: 30,
		auto_renewal: false,
		currency: "£",
		expired_at: dayjs().add(5, "day").toISOString(),
		group: "Europe",
		tags: "BGP;Storage",
		ipv4: "89.187.162.12",
	},
];

function buildDemoSnapshot(): NezhaWebsocketResponse {
	const now = Date.now();
	const wave = Math.sin(now / 5000);
	const servers: NezhaServer[] = DEMO_NODES.map((node, idx) => {
		nodeCacheByUuid.set(node.uuid, node);
		const isOnline = idx !== 5;
		const cpu = isOnline
			? Math.max(2, Math.min(96, 18 + idx * 11 + wave * 7))
			: 0;
		const memRatio = isOnline ? 0.34 + idx * 0.08 + wave * 0.01 : 0;
		const diskRatio = 0.25 + idx * 0.09;
		const netIn = isOnline
			? Math.round((1.8 + idx * 2.4 + Math.abs(wave) * 3.2) * 1024 * 1024)
			: 0;
		const netOut = isOnline
			? Math.round((1.2 + idx * 1.9 + Math.abs(wave) * 2.5) * 1024 * 1024)
			: 0;

		const status: KomariNodeStatus = {
			client: node.uuid,
			online: isOnline,
			cpu,
			gpu: node.gpu_name ? Math.round(42 + wave * 12) : undefined,
			ram: Math.round((node.mem_total || 0) * memRatio),
			swap: Math.round((node.swap_total || 0) * 0.12),
			disk: Math.round((node.disk_total || 0) * diskRatio),
			load: Number((cpu / 25).toFixed(2)),
			load5: Number((cpu / 28).toFixed(2)),
			load15: Number((cpu / 32).toFixed(2)),
			temp: isOnline ? 44 + idx * 3 : 0,
			net_in: netIn,
			net_out: netOut,
			net_total_down: (160 + idx * 190) * 1024 * 1024 * 1024,
			net_total_up: (120 + idx * 145) * 1024 * 1024 * 1024,
			connections: isOnline ? 110 + idx * 45 : 0,
			connections_udp: isOnline ? 28 + idx * 12 : 0,
			uptime: isOnline ? (14 + idx * 9) * 86400 + 7200 : 0,
			process: isOnline ? 95 + idx * 18 : 0,
			time: isOnline
				? new Date(now).toISOString()
				: new Date(now - 3600_000 * 3).toISOString(),
		};
		statusCacheByUuid.set(node.uuid, status);
		return convertKomariToNezhaServer(node, status);
	});

	return {
		now,
		online: servers.filter((s) => now - new Date(s.last_active).getTime() < 180_000)
			.length,
		servers,
	};
}

// ============================================================================
// Live Polling & Snapshot Builder
// ============================================================================
let lastNodesFetchAt = 0;

export async function ensureKomariNodes(
	force = false,
	signal?: AbortSignal,
): Promise<KomariNode[]> {
	if (shouldUseDemoMode()) {
		for (const node of DEMO_NODES) {
			nodeCacheByUuid.set(node.uuid, node);
			getServerNumericId(node.uuid);
		}
		return DEMO_NODES;
	}

	const now = Date.now();
	if (
		!force &&
		nodeCacheByUuid.size > 0 &&
		now - lastNodesFetchAt < 10_000
	) {
		return Array.from(nodeCacheByUuid.values());
	}

	try {
		const rpcNodes = await rpc2Call<
			{ uuid?: string },
			Record<string, KomariNode>
		>("common:getNodes", {}, signal);
		if (rpcNodes && typeof rpcNodes === "object") {
			const list = Object.values(rpcNodes)
				.filter((n): n is KomariNode => Boolean(n && n.uuid))
				.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
			nodeCacheByUuid.clear();
			for (const node of list) {
				nodeCacheByUuid.set(node.uuid, node);
				getServerNumericId(node.uuid);
			}
			lastNodesFetchAt = now;
			return list;
		}
	} catch {
		// Fallback to REST /api/nodes
		try {
			const restRes = await getKomariJson<{ status?: string; data?: KomariNode[] }>(
				"/api/nodes",
				signal,
			);
			if (Array.isArray(restRes?.data)) {
				const list = [...restRes.data].sort(
					(a, b) => (a.weight ?? 0) - (b.weight ?? 0),
				);
				nodeCacheByUuid.clear();
				for (const node of list) {
					nodeCacheByUuid.set(node.uuid, node);
					getServerNumericId(node.uuid);
				}
				lastNodesFetchAt = now;
				return list;
			}
		} catch {
			// If both fail and we have no nodes yet, activate demo mode so UI previews cleanly
			if (nodeCacheByUuid.size === 0) {
				isDemoMode = true;
				for (const node of DEMO_NODES) {
					nodeCacheByUuid.set(node.uuid, node);
					getServerNumericId(node.uuid);
				}
				return DEMO_NODES;
			}
		}
	}

	return Array.from(nodeCacheByUuid.values());
}

export async function fetchKomariRealtimeSnapshot(
	signal?: AbortSignal,
): Promise<NezhaWebsocketResponse> {
	const nodes = await ensureKomariNodes(false, signal);
	if (shouldUseDemoMode()) {
		return buildDemoSnapshot();
	}

	try {
		const statusMap = await rpc2Call<
			unknown,
			Record<string, KomariNodeStatus>
		>("common:getNodesLatestStatus", {}, signal);

		if (statusMap && typeof statusMap === "object") {
			for (const [uuid, st] of Object.entries(statusMap)) {
				statusCacheByUuid.set(uuid, st);
			}
		}
	} catch {
		// Keep previous status cache if transient error occurs
	}

	const now = Date.now();
	const servers = nodes.map((node) =>
		convertKomariToNezhaServer(node, statusCacheByUuid.get(node.uuid)),
	);
	const onlineCount = servers.filter(
		(s) => now - new Date(s.last_active).getTime() < 180_000,
	).length;

	return {
		now,
		online: onlineCount,
		servers,
	};
}

// ============================================================================
// Recent History Loader for Detail Page (/api/recent/:uuid)
// ============================================================================
export async function fetchKomariRecentFrames(
	serverIdOrUuid: number | string,
	signal?: AbortSignal,
): Promise<NezhaWebsocketResponse[]> {
	await ensureKomariNodes(false, signal);
	const uuid = getServerUuidById(serverIdOrUuid);
	if (!uuid) return [];
	const node = nodeCacheByUuid.get(uuid);
	if (!node) return [];

	if (shouldUseDemoMode()) {
		const now = Date.now();
		const frames: NezhaWebsocketResponse[] = [];
		for (let i = 0; i < 30; i++) {
			const ts = now - i * 2000;
			const wave = Math.sin(ts / 6000);
			const server = convertKomariToNezhaServer(node, {
				online: true,
				cpu: Math.max(3, Math.min(95, 24 + wave * 12)),
				ram: Math.round((node.mem_total || 0) * (0.42 + wave * 0.02)),
				swap: Math.round((node.swap_total || 0) * 0.1),
				disk: Math.round((node.disk_total || 0) * 0.38),
				net_in: Math.round((2.4 + Math.abs(wave) * 4) * 1024 * 1024),
				net_out: Math.round((1.6 + Math.abs(wave) * 3) * 1024 * 1024),
				connections: Math.round(140 + wave * 15),
				connections_udp: Math.round(35 + wave * 5),
				process: Math.round(115 + wave * 4),
				time: new Date(ts).toISOString(),
			});
			frames.push({
				now: ts,
				online: 1,
				servers: [server],
			});
		}
		return frames;
	}

	try {
		const res = await getKomariJson<{ data?: KomariNodeStatus[] }>(
			`/api/recent/${encodeURIComponent(uuid)}`,
			signal,
		);
		const records = Array.isArray(res?.data) ? res.data.slice(-30) : [];
		if (records.length === 0) return [];

		// Return newest-first to match messageHistory convention in websocket-provider
		return records
			.map((rec) => {
				const tsStr = rec.time || rec.updated_at;
				const ts = tsStr ? new Date(tsStr).getTime() : Date.now();
				const server = convertKomariToNezhaServer(node, {
					...rec,
					online: true,
				});
				return {
					now: Number.isFinite(ts) ? ts : Date.now(),
					online: 1,
					servers: [server],
				};
			})
			.reverse();
	} catch {
		return [];
	}
}

// ============================================================================
// REST API Adapters (called from src/lib/nezha-api.ts)
// ============================================================================

export async function komariFetchSetting(
	signal?: AbortSignal,
): Promise<SettingResponse> {
	let publicInfo: KomariPublicInfo | undefined;
	let version = "v1.1.4";

	if (!shouldUseDemoMode()) {
		try {
			const pubRes = await getKomariJson<{ data?: KomariPublicInfo }>(
				"/api/public",
				signal,
			);
			publicInfo = pubRes?.data;
		} catch {
			isDemoMode = true;
		}

		if (!isDemoMode) {
			try {
				const verRes = await getKomariJson<{
					data?: { version?: string; hash?: string };
				}>("/api/version", signal);
				if (verRes?.data?.version) {
					version = verRes.data.version;
				}
			} catch {
				// Optional version endpoint
			}
		}
	}

	if (publicInfo?.theme_settings) {
		applyKomariThemeSettings(publicInfo.theme_settings);
	}

	const customCode = [publicInfo?.custom_head, publicInfo?.custom_body]
		.filter(Boolean)
		.join("\n");

	if (
		publicInfo?.description &&
		typeof window !== "undefined" &&
		!window.CustomDesc
	) {
		window.CustomDesc = publicInfo.description;
	}

	return {
		success: true,
		data: {
			config: {
				debug: false,
				language: "zh-CN",
				site_name: publicInfo?.sitename || "Komari Monitor",
				user_template: publicInfo?.theme || "NezhaDash",
				admin_template: "default",
				custom_code: customCode,
			},
			version,
			tsdb_enabled: true,
		},
	};
}

export async function komariFetchLoginUser(
	signal?: AbortSignal,
): Promise<LoginUserResponse> {
	if (shouldUseDemoMode()) {
		return {
			success: true,
			data: {
				id: 1,
				username: "admin",
				password: "",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		};
	}

	try {
		const me = await getKomariJson<{
			logged_in?: boolean;
			username?: string;
			uuid?: string;
		}>("/api/me", signal);

		if (me?.logged_in) {
			return {
				success: true,
				data: {
					id: 1,
					username: me.username || "admin",
					password: "",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			};
		}
	} catch {
		// Guest user
	}

	// Return guest profile (note: Komari allows guests to view historical charts as well)
	return {
		success: true,
		data: {
			id: 0,
			username: "",
			password: "",
			created_at: "",
			updated_at: "",
		},
	};
}

export async function komariFetchServerGroup(
	signal?: AbortSignal,
): Promise<ServerGroupResponse> {
	const nodes = await ensureKomariNodes(false, signal);
	const groupMap = new Map<string, number[]>();

	for (const node of nodes) {
		const groupName = (node.group || "").trim();
		if (!groupName) continue;
		const id = getServerNumericId(node.uuid);
		const list = groupMap.get(groupName) ?? [];
		list.push(id);
		groupMap.set(groupName, list);
	}

	const nowIso = new Date().toISOString();
	const data: ServerGroup[] = Array.from(groupMap.entries()).map(
		([name, servers], index) => ({
			group: {
				id: index + 1,
				created_at: nowIso,
				updated_at: nowIso,
				name,
			},
			servers,
		}),
	);

	return {
		success: true,
		data,
	};
}

export async function komariFetchService(
	signal?: AbortSignal,
): Promise<ServiceResponse> {
	const nodes = await ensureKomariNodes(false, signal);
	const cycle_transfer_stats: CycleTransferStats = {};
	const services: Record<string, ServiceData> = {};

	// 1. Build CycleTransferStats from nodes with traffic_limit > 0
	for (const node of nodes) {
		if (!node.traffic_limit || node.traffic_limit <= 0) continue;
		const serverId = String(getServerNumericId(node.uuid));
		const status = statusCacheByUuid.get(node.uuid);
		const up =
			status?.net_total_up ??
			status?.net_total_out ??
			status?.network?.totalUp ??
			0;
		const down =
			status?.net_total_down ??
			status?.net_total_in ??
			status?.network?.totalDown ??
			0;
		const limitType = (node.traffic_limit_type || "max").toLowerCase();
		let used = up + down;
		if (limitType === "max") used = Math.max(up, down);
		else if (limitType === "min") used = Math.min(up, down);
		else if (limitType === "up") used = up;
		else if (limitType === "down") used = down;

		const cycleDays = node.billing_cycle && node.billing_cycle > 0 ? node.billing_cycle : 30;
		const toDate = isValidExpiryDate(node.expired_at)
			? dayjs(node.expired_at)
			: dayjs().endOf("month");
		const fromDate = toDate.subtract(cycleDays, "day");

		cycle_transfer_stats[node.uuid] = {
			name: `${node.name} (${limitType.toUpperCase()})`,
			from: fromDate.toISOString(),
			to: toDate.toISOString(),
			max: node.traffic_limit,
			min: 0,
			server_name: { [serverId]: node.name },
			transfer: { [serverId]: used },
			next_update: { [serverId]: new Date().toISOString() },
		};
	}

	// 2. Build 30-day Service Availability Tracker from Komari Ping Tasks
	if (shouldUseDemoMode()) {
		const demoServices = [
			{ name: "China Telecom CN2", baseDelay: 36, baseUp: 99.6 },
			{ name: "China Unicom AS9929", baseDelay: 42, baseUp: 99.4 },
			{ name: "China Mobile CMI", baseDelay: 48, baseUp: 99.1 },
			{ name: "Cloudflare Anycast", baseDelay: 8, baseUp: 99.9 },
		];
		for (const svc of demoServices) {
			const up: number[] = [];
			const down: number[] = [];
			const delay: number[] = [];
			for (let d = 0; d < 30; d++) {
				const checks = 1440;
				const downChecks = d % 11 === 0 ? 4 : 0;
				up.push(checks - downChecks);
				down.push(downChecks);
				delay.push(
					Number((svc.baseDelay + Math.sin(d) * 3.5).toFixed(2)),
				);
			}
			services[svc.name] = {
				service_name: svc.name,
				current_up: up[29],
				current_down: down[29],
				total_up: up.reduce((a, b) => a + b, 0),
				total_down: down.reduce((a, b) => a + b, 0),
				delay,
				up,
				down,
			};
		}
		return {
			success: true,
			data: {
				services,
				cycle_transfer_stats,
			},
		};
	}

	try {
		let tasks: KomariPingTask[] = [];
		try {
			const rpcTasks = await rpc2Call<unknown, KomariPingTask[]>(
				"public:getPublicPingTasks",
				{},
				signal,
			);
			if (Array.isArray(rpcTasks)) tasks = rpcTasks;
		} catch {
			const restTasks = await getKomariJson<{ data?: KomariPingTask[] }>(
				"/api/task/ping",
				signal,
			).catch(() => null);
			if (Array.isArray(restTasks?.data)) tasks = restTasks!.data!;
		}

		for (const task of tasks) {
			const up = new Array<number>(30).fill(100);
			const down = new Array<number>(30).fill(0);
			const delay = new Array<number>(30).fill(0);
			const lossPct = typeof task.loss === "number" ? task.loss : 0;
			if (lossPct > 0) {
				down[29] = Math.round(lossPct);
				up[29] = Math.max(0, 100 - down[29]);
			}
			services[String(task.id)] = {
				service_name: task.name || `Ping #${task.id}`,
				current_up: up[29],
				current_down: down[29],
				total_up: up.reduce((a, b) => a + b, 0),
				total_down: down.reduce((a, b) => a + b, 0),
				delay,
				up,
				down,
			};
		}
	} catch {
		// Service tracker is optional
	}

	return {
		success: true,
		data: {
			services,
			cycle_transfer_stats,
		},
	};
}

// ============================================================================
// Network Ping Latency Monitor (/api/v1/server/:id/service)
// ============================================================================
function periodToHours(period?: MonitorPeriod | MetricPeriod | string): number {
	if (!period) return 24;
	const match = String(period).match(/^(\d+)d$/i);
	if (match) {
		const days = Math.max(1, Math.min(7, Number.parseInt(match[1], 10)));
		return days * 24;
	}
	return 24;
}

export async function komariFetchMonitor(
	serverIdOrUuid: number | string,
	period?: MonitorPeriod,
	signal?: AbortSignal,
): Promise<MonitorResponse> {
	await ensureKomariNodes(false, signal);
	const uuid = getServerUuidById(serverIdOrUuid);
	const numericId = resolveServerNumericId(serverIdOrUuid);
	const node = uuid ? nodeCacheByUuid.get(uuid) : undefined;
	const serverName = node?.name || String(serverIdOrUuid);
	const hours = periodToHours(period);

	if (!uuid || shouldUseDemoMode()) {
		const now = Date.now();
		const stepMs = (hours * 3600 * 1000) / 120;
		const targets = [
			{ id: 1, name: "电信 CN2 (Shanghai)", base: 34 },
			{ id: 2, name: "联通 9929 (Beijing)", base: 41 },
			{ id: 3, name: "移动 CMI (Guangzhou)", base: 29 },
		];
		const monitors: NezhaMonitor[] = targets.map((target) => {
			const created_at: number[] = [];
			const avg_delay: number[] = [];
			const packet_loss: number[] = [];
			for (let i = 120; i >= 0; i--) {
				const ts = Math.round(now - i * stepMs);
				created_at.push(ts);
				const jitter = Math.sin(i / 6 + target.id) * 4 + (i % 19 === 0 ? 12 : 0);
				avg_delay.push(Number(Math.max(1, target.base + jitter).toFixed(2)));
				packet_loss.push(i % 29 === 0 ? 1.5 : 0);
			}
			return {
				monitor_id: target.id,
				monitor_name: target.name,
				server_id: numericId,
				server_name: serverName,
				created_at,
				avg_delay,
				packet_loss,
			};
		});
		return { success: true, data: monitors };
	}

	// 1. Try Komari RPC2 public:queryMetrics for ping.latency_ms + public:getPublicPingTasks
	try {
		const [tasksResult, metricsResult] = await Promise.all([
			rpc2Call<unknown, KomariPingTask[]>(
				"public:getPublicPingTasks",
				{},
				signal,
			).catch(() => [] as KomariPingTask[]),
			rpc2Call<
				any,
				{ series?: KomariMetricSeries[] }
			>(
				"public:queryMetrics",
				{
					metric_keys: ["ping.latency_ms"],
					entity_id: uuid,
					hours,
					max_points: 500,
					aggregation: "avg",
					fill_empty: false,
				},
				signal,
			),
		]);

		const taskMap = new Map<string, KomariPingTask>();
		if (Array.isArray(tasksResult)) {
			for (const t of tasksResult) {
				taskMap.set(String(t.id), t);
			}
		}

		const seriesList = Array.isArray(metricsResult?.series)
			? metricsResult.series
			: [];
		if (seriesList.length > 0) {
			const monitors: NezhaMonitor[] = [];
			for (const s of seriesList) {
				const taskIdStr = s.tags?.task_id || "1";
				const task = taskMap.get(taskIdStr);
				const created_at: number[] = [];
				const avg_delay: (number | null)[] = [];
				const packet_loss: (number | null)[] = [];

				for (const pt of s.points ?? []) {
					const ts = new Date(pt.time).getTime();
					if (!Number.isFinite(ts)) continue;
					created_at.push(ts);
					const val =
						typeof pt.value === "number" && Number.isFinite(pt.value) && pt.value >= 0
							? Number(pt.value.toFixed(2))
							: null;
					avg_delay.push(val);
					packet_loss.push(val === null ? 100 : 0);
				}

				if (created_at.length > 0) {
					monitors.push({
						monitor_id: Number(taskIdStr) || monitors.length + 1,
						monitor_name: task?.name || `Ping #${taskIdStr}`,
						display_index: task?.weight ?? 0,
						server_id: numericId,
						server_name: serverName,
						created_at,
						avg_delay,
						packet_loss,
					});
				}
			}

			if (monitors.length > 0) {
				return { success: true, data: monitors };
			}
		}
	} catch {
		// Fall through to REST /api/records/ping
	}

	// 2. Fallback to Komari REST GET /api/records/ping?uuid=<uuid>&hours=<hours>
	try {
		const pingRes = await getKomariJson<{
			data?: {
				tasks?: Array<{ id: number; name: string; loss?: number; weight?: number }>;
				records?: Array<{
					task_id: number;
					time: string;
					value: number;
					client?: string;
				}>;
			};
		}>(
			`/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
			signal,
		);

		const tasks = pingRes?.data?.tasks ?? [];
		const records = pingRes?.data?.records ?? [];
		const taskNameMap = new Map<number, string>();
		for (const t of tasks) {
			taskNameMap.set(t.id, t.name);
		}

		const grouped = new Map<
			number,
			{ created_at: number[]; avg_delay: (number | null)[]; packet_loss: (number | null)[] }
		>();

		const sortedRecords = [...records].sort(
			(a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
		);

		for (const rec of sortedRecords) {
			const ts = new Date(rec.time).getTime();
			if (!Number.isFinite(ts)) continue;
			const bucket = grouped.get(rec.task_id) ?? {
				created_at: [],
				avg_delay: [],
				packet_loss: [],
			};
			bucket.created_at.push(ts);
			if (rec.value >= 0) {
				bucket.avg_delay.push(Number(rec.value.toFixed(2)));
				bucket.packet_loss.push(0);
			} else {
				bucket.avg_delay.push(null);
				bucket.packet_loss.push(100);
			}
			grouped.set(rec.task_id, bucket);
		}

		const monitors: NezhaMonitor[] = Array.from(grouped.entries()).map(
			([taskId, series]) => ({
				monitor_id: taskId,
				monitor_name: taskNameMap.get(taskId) || `Ping #${taskId}`,
				server_id: numericId,
				server_name: serverName,
				created_at: series.created_at,
				avg_delay: series.avg_delay,
				packet_loss: series.packet_loss,
			}),
		);

		return { success: true, data: monitors };
	} catch {
		return { success: true, data: [] };
	}
}

// ============================================================================
// Historical Server Metrics (/api/v1/server/:id/metrics)
// ============================================================================
const NEZHA_TO_KOMARI_METRIC_KEY: Record<MetricType, string> = {
	cpu: "cpu.usage",
	memory: "memory.used",
	swap: "swap.used",
	disk: "disk.used",
	net_in_speed: "net.in.rate",
	net_out_speed: "net.out.rate",
	net_in_transfer: "net.total.down",
	net_out_transfer: "net.total.up",
	load1: "load.average",
	load5: "load.average",
	load15: "load.average",
	tcp_conn: "connections.tcp",
	udp_conn: "connections.udp",
	process_count: "process.count",
	temperature: "temperature",
	uptime: "uptime",
	gpu: "gpu.usage",
};

function extractMetricFromLoadRecord(
	rec: any,
	metric: MetricType,
	node?: KomariNode,
): number | null {
	switch (metric) {
		case "cpu":
			return typeof rec.cpu === "number" ? rec.cpu : (rec.cpu?.usage ?? null);
		case "memory":
			return typeof rec.ram === "number" ? rec.ram : (rec.ram?.used ?? null);
		case "swap":
			return typeof rec.swap === "number" ? rec.swap : (rec.swap?.used ?? null);
		case "disk":
			return typeof rec.disk === "number" ? rec.disk : (rec.disk?.used ?? null);
		case "net_in_speed":
			return typeof rec.net_in === "number"
				? rec.net_in
				: (rec.network?.down ?? null);
		case "net_out_speed":
			return typeof rec.net_out === "number"
				? rec.net_out
				: (rec.network?.up ?? null);
		case "net_in_transfer":
			return rec.net_total_down ?? rec.net_total_in ?? rec.network?.totalDown ?? null;
		case "net_out_transfer":
			return rec.net_total_up ?? rec.net_total_out ?? rec.network?.totalUp ?? null;
		case "load1":
			return typeof rec.load === "number" ? rec.load : (rec.load?.load1 ?? null);
		case "load5":
			return typeof rec.load5 === "number" ? rec.load5 : (rec.load?.load5 ?? null);
		case "load15":
			return typeof rec.load15 === "number"
				? rec.load15
				: (rec.load?.load15 ?? null);
		case "tcp_conn":
			return typeof rec.connections === "number"
				? rec.connections
				: (rec.connections?.tcp ?? null);
		case "udp_conn":
			return typeof rec.connections_udp === "number"
				? rec.connections_udp
				: (rec.connections?.udp ?? null);
		case "process_count":
			return typeof rec.process === "number" ? rec.process : null;
		case "temperature":
			return typeof rec.temp === "number" ? rec.temp : null;
		case "uptime":
			return typeof rec.uptime === "number" ? rec.uptime : null;
		case "gpu":
			return typeof rec.gpu === "number"
				? rec.gpu
				: (rec.gpu?.average_usage ?? null);
		default:
			return node ? 0 : null;
	}
}

export async function komariFetchServerMetrics(
	serverIdOrUuid: number | string,
	metric: MetricType,
	period?: MetricPeriod,
	signal?: AbortSignal,
): Promise<ServerMetricsResponse> {
	await ensureKomariNodes(false, signal);
	const uuid = getServerUuidById(serverIdOrUuid);
	const numericId = resolveServerNumericId(serverIdOrUuid);
	const node = uuid ? nodeCacheByUuid.get(uuid) : undefined;
	const serverName = node?.name || String(serverIdOrUuid);
	const hours = periodToHours(period);

	if (!uuid || shouldUseDemoMode()) {
		const now = Date.now();
		const count = 96;
		const stepMs = (hours * 3600 * 1000) / count;
		const data_points = Array.from({ length: count }, (_, idx) => {
			const ts = Math.round(now - (count - 1 - idx) * stepMs);
			const wave = Math.sin(idx / 6);
			let value = 0;
			switch (metric) {
				case "cpu":
					value = 22 + wave * 14;
					break;
				case "memory":
					value = (node?.mem_total || 8 * 1024 ** 3) * (0.45 + wave * 0.05);
					break;
				case "swap":
					value = (node?.swap_total || 2 * 1024 ** 3) * 0.12;
					break;
				case "disk":
					value = (node?.disk_total || 80 * 1024 ** 3) * 0.36;
					break;
				case "net_in_speed":
					value = (3.2 + Math.abs(wave) * 5.5) * 1024 * 1024;
					break;
				case "net_out_speed":
					value = (2.1 + Math.abs(wave) * 4.2) * 1024 * 1024;
					break;
				case "tcp_conn":
					value = Math.round(130 + wave * 25);
					break;
				case "udp_conn":
					value = Math.round(32 + wave * 8);
					break;
				case "process_count":
					value = Math.round(112 + wave * 6);
					break;
				case "gpu":
					value = 38 + wave * 15;
					break;
				default:
					value = 10 + wave * 2;
					break;
			}
			return { ts, value: Math.max(0, value) };
		});

		return {
			success: true,
			data: {
				server_id: numericId,
				server_name: serverName,
				metric,
				data_points,
			},
		};
	}

	// 1. Try Komari RPC2 public:queryMetrics
	const komariMetricKey = NEZHA_TO_KOMARI_METRIC_KEY[metric];
	if (komariMetricKey) {
		try {
			const res = await rpc2Call<
				any,
				{ series?: KomariMetricSeries[] }
			>(
				"public:queryMetrics",
				{
					metric_keys: [komariMetricKey],
					entity_id: uuid,
					hours,
					max_points: 500,
					aggregation: "avg",
					fill_empty: false,
				},
				signal,
			);
			const firstSeries = res?.series?.[0];
			if (firstSeries?.points && firstSeries.points.length > 0) {
				const data_points = firstSeries.points
					.map((pt) => ({
						ts: new Date(pt.time).getTime(),
						value: typeof pt.value === "number" && Number.isFinite(pt.value) ? pt.value : NaN,
					}))
					.filter((pt) => Number.isFinite(pt.ts) && Number.isFinite(pt.value));

				if (data_points.length > 0) {
					return {
						success: true,
						data: {
							server_id: numericId,
							server_name: serverName,
							metric,
							data_points,
						},
					};
				}
			}
		} catch {
			// Fall back to REST /api/records/load
		}
	}

	// 2. Fallback to Komari REST /api/records/load?uuid=<uuid>&hours=<hours>
	try {
		const loadRes = await getKomariJson<{
			data?: { records?: any[]; [key: string]: any } | any[];
		}>(
			`/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
			signal,
		);

		let rawRecords: any[] = [];
		if (Array.isArray(loadRes?.data)) {
			rawRecords = loadRes.data;
		} else if (Array.isArray(loadRes?.data?.records)) {
			rawRecords = loadRes.data.records;
		} else if (loadRes?.data && Array.isArray(loadRes.data[uuid])) {
			rawRecords = loadRes.data[uuid];
		}

		const data_points = rawRecords
			.map((rec) => {
				const ts = new Date(rec.time || rec.updated_at).getTime();
				const val = extractMetricFromLoadRecord(rec, metric, node);
				return {
					ts,
					value: typeof val === "number" && Number.isFinite(val) ? val : NaN,
				};
			})
			.filter((pt) => Number.isFinite(pt.ts) && Number.isFinite(pt.value))
			.sort((a, b) => a.ts - b.ts);

		return {
			success: true,
			data: {
				server_id: numericId,
				server_name: serverName,
				metric,
				data_points,
			},
		};
	} catch {
		return {
			success: true,
			data: {
				server_id: numericId,
				server_name: serverName,
				metric,
				data_points: [],
			},
		};
	}
}

// ============================================================================
// Server Online History (/api/v1/server/:id/online-history)
// ============================================================================
export async function komariFetchServerOnlineHistory(
	serverIdOrUuid: number | string,
	days = 1,
	signal?: AbortSignal,
): Promise<OnlineHistoryResponse> {
	await ensureKomariNodes(false, signal);
	const uuid = getServerUuidById(serverIdOrUuid);
	const numericId = resolveServerNumericId(serverIdOrUuid);
	const node = uuid ? nodeCacheByUuid.get(uuid) : undefined;
	const status = uuid ? statusCacheByUuid.get(uuid) : undefined;
	const currentlyOnline = Boolean(status?.online ?? true);

	const now = dayjs();
	const safeDays = Math.max(1, Math.min(7, days || 1));
	const windowStart = now.subtract(safeDays, "day").startOf("day");
	const windowEnd = now;

	// Build daily stats and continuous online periods
	const periods: OnlinePeriod[] = [];
	const daily: Array<{ date: string; online_seconds: number }> = [];

	// Check if we can infer periods from CPU metric timestamps
	let sampleTimestamps: number[] = [];
	if (uuid && !shouldUseDemoMode()) {
		try {
			const cpuMetrics = await komariFetchServerMetrics(
				uuid,
				"cpu",
				`${safeDays}d` as MetricPeriod,
				signal,
			);
			sampleTimestamps = cpuMetrics.data.data_points.map((p) => p.ts);
		} catch {
			sampleTimestamps = [];
		}
	}

	if (sampleTimestamps.length >= 2) {
		sampleTimestamps.sort((a, b) => a - b);
		const gapThresholdMs = Math.max(
			15 * 60 * 1000,
			((safeDays * 86400 * 1000) / sampleTimestamps.length) * 3.5,
		);
		let segStart = sampleTimestamps[0];
		let segEnd = sampleTimestamps[0];

		for (let i = 1; i < sampleTimestamps.length; i++) {
			const ts = sampleTimestamps[i];
			if (ts - segEnd <= gapThresholdMs) {
				segEnd = ts;
			} else {
				periods.push({
					start: new Date(segStart).toISOString(),
					end: new Date(segEnd).toISOString(),
					ongoing: false,
				});
				segStart = ts;
				segEnd = ts;
			}
		}
		periods.push({
			start: new Date(segStart).toISOString(),
			end: currentlyOnline
				? windowEnd.toISOString()
				: new Date(segEnd).toISOString(),
			ongoing: currentlyOnline,
		});
	} else {
		// Fallback to uptime-based online period
		const uptimeSec = status?.uptime || 86400 * safeDays;
		const sessionStart = dayjs(
			Math.max(
				windowStart.valueOf(),
				windowEnd.valueOf() - uptimeSec * 1000,
			),
		);
		periods.push({
			start: sessionStart.toISOString(),
			end: currentlyOnline
				? windowEnd.toISOString()
				: windowEnd.subtract(15, "minute").toISOString(),
			ongoing: currentlyOnline,
		});
	}

	let totalOnlineSeconds = 0;
	for (let d = 0; d <= safeDays; d++) {
		const dayDate = windowStart.add(d, "day");
		if (dayDate.isAfter(windowEnd, "day")) break;
		const dayStart = Math.max(
			dayDate.startOf("day").valueOf(),
			windowStart.valueOf(),
		);
		const dayEnd = Math.min(
			dayDate.endOf("day").valueOf(),
			windowEnd.valueOf(),
		);
		let dayOnlineSec = 0;
		for (const p of periods) {
			const ps = Math.max(dayStart, new Date(p.start).getTime());
			const pe = Math.min(dayEnd, new Date(p.end).getTime());
			if (pe > ps) {
				dayOnlineSec += Math.round((pe - ps) / 1000);
			}
		}
		totalOnlineSeconds += dayOnlineSec;
		daily.push({
			date: dayDate.format("YYYY-MM-DD"),
			online_seconds: dayOnlineSec,
		});
	}

	const totalWindowSeconds = Math.max(
		1,
		Math.round((windowEnd.valueOf() - windowStart.valueOf()) / 1000),
	);
	const onlineRate = Math.min(
		100,
		Number(((totalOnlineSeconds / totalWindowSeconds) * 100).toFixed(2)),
	);

	const historyData: OnlineHistoryData = {
		server_id: numericId,
		server_name: node?.name || String(serverIdOrUuid),
		days: safeDays,
		max_days: 7,
		window_start: windowStart.toISOString(),
		window_end: windowEnd.toISOString(),
		total_online_seconds: totalOnlineSeconds,
		online_rate: onlineRate,
		currently_online: currentlyOnline,
		last_active: status?.time || windowEnd.toISOString(),
		periods,
		daily,
	};

	return {
		success: true,
		data: historyData,
	};
}
