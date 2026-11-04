import { useSyncExternalStore } from "react";
import {
	SORT_ORDERS,
	SORT_TYPES,
	type SortOrder,
	type SortType,
} from "@/context/sort-context";
import { safeSessionStorage } from "@/lib/storage";

export interface RuntimeConfig {
	forceTheme?: "dark" | "light";
	backgroundImage?: string;
	mobileBackgroundImage?: string;
	forceSortType?: SortType;
	forceSortOrder?: SortOrder;
	forceShowServices: boolean;
	forceShowMap: boolean;
	forceCardInline: boolean;
	forcePeakCutEnabled: boolean;
	customLogo?: string;
	customDesc?: string;
	customLinks?: string;
	customIllustration?: string;
	showNetTransfer: boolean;
	fixedTopServerName: boolean;
	forceUseSvgFlag: boolean;
	disableAnimatedMan: boolean;
	customFooterHtml?: string;
}

export const RUNTIME_CONFIG_CHANGE_EVENT = "runtimeConfigChange";
const text = (value: unknown) =>
	typeof value === "string" && value ? value : undefined;
const defaults: RuntimeConfig = {
	forceTheme: undefined,
	backgroundImage: undefined,
	mobileBackgroundImage: undefined,
	forceSortType: undefined,
	forceSortOrder: undefined,
	forceShowServices: false,
	forceShowMap: false,
	forceCardInline: true,
	forcePeakCutEnabled: false,
	customLogo: undefined,
	customDesc: undefined,
	customLinks: undefined,
	customIllustration: undefined,
	showNetTransfer: true,
	fixedTopServerName: false,
	forceUseSvgFlag: false,
	disableAnimatedMan: true,
	customFooterHtml: undefined,
};

let komariThemeSettings: Record<string, unknown> = {};
let snapshot = defaults;

export function applyKomariThemeSettings(
	settings: Record<string, unknown> | null | undefined,
) {
	if (!settings || typeof settings !== "object") return;
	komariThemeSettings = { ...settings };

	if (typeof window !== "undefined") {
		if (typeof settings.customLogo === "string" && settings.customLogo) {
			window.CustomLogo = settings.customLogo;
		}
		if (typeof settings.customDesc === "string" && settings.customDesc) {
			window.CustomDesc = settings.customDesc;
		}
		if (typeof settings.customLinks === "string" && settings.customLinks) {
			window.CustomLinks = settings.customLinks;
		}
		if (
			settings.forceTheme === "dark" ||
			settings.forceTheme === "light"
		) {
			window.ForceTheme = settings.forceTheme;
		}
		if (
			typeof settings.backgroundImage === "string" &&
			settings.backgroundImage
		) {
			window.CustomBackgroundImage = settings.backgroundImage;
		}
		if (
			typeof settings.mobileBackgroundImage === "string" &&
			settings.mobileBackgroundImage
		) {
			window.CustomMobileBackgroundImage = settings.mobileBackgroundImage;
		}
		if (typeof settings.disableAnimatedMan === "boolean") {
			window.DisableAnimatedMan = settings.disableAnimatedMan;
		}
		if (
			typeof settings.customIllustration === "string" &&
			settings.customIllustration
		) {
			window.CustomIllustration = settings.customIllustration;
		}
		if (typeof settings.showNetTransfer === "boolean") {
			window.ShowNetTransfer = settings.showNetTransfer;
		}
		if (typeof settings.fixedTopServerName === "boolean") {
			window.FixedTopServerName = settings.fixedTopServerName;
		}
		if (typeof settings.forceCardInline === "boolean") {
			window.ForceCardInline = settings.forceCardInline;
		}
		if (typeof settings.forceShowMap === "boolean") {
			window.ForceShowMap = settings.forceShowMap;
		}
		if (typeof settings.forceShowServices === "boolean") {
			window.ForceShowServices = settings.forceShowServices;
		}
		if (typeof settings.forceUseSvgFlag === "boolean") {
			window.ForceUseSvgFlag = settings.forceUseSvgFlag;
		}
		if (typeof settings.forcePeakCutEnabled === "boolean") {
			window.ForcePeakCutEnabled = settings.forcePeakCutEnabled;
		}
		if (
			typeof settings.customFooterHtml === "string" &&
			settings.customFooterHtml
		) {
			window.CustomFooterHtml = settings.customFooterHtml;
		}
	}

	refreshRuntimeConfig();
}

// Keep the public window.* custom_code API and Komari theme_settings at this boundary.
export function readRuntimeConfig(): RuntimeConfig {
	if (typeof window === "undefined") return defaults;
	const rawForceTheme = window.ForceTheme ?? komariThemeSettings.forceTheme;
	const next: RuntimeConfig = {
		forceTheme:
			rawForceTheme === "dark" || rawForceTheme === "light"
				? rawForceTheme
				: undefined,
		backgroundImage:
			text(window.CustomBackgroundImage) ??
			text(komariThemeSettings.backgroundImage),
		mobileBackgroundImage:
			text(window.CustomMobileBackgroundImage) ??
			text(komariThemeSettings.mobileBackgroundImage),
		forceShowServices: Boolean(
			window.ForceShowServices ?? komariThemeSettings.forceShowServices ?? false,
		),
		forceShowMap: Boolean(
			window.ForceShowMap ?? komariThemeSettings.forceShowMap ?? false,
		),
		forceCardInline: Boolean(
			window.ForceCardInline ?? komariThemeSettings.forceCardInline ?? false,
		),
		forcePeakCutEnabled: Boolean(
			window.ForcePeakCutEnabled ??
				komariThemeSettings.forcePeakCutEnabled ??
				false,
		),
		customLogo:
			text(window.CustomLogo) ?? text(komariThemeSettings.customLogo),
		customDesc:
			text(window.CustomDesc) ?? text(komariThemeSettings.customDesc),
		customLinks:
			text(window.CustomLinks) ?? text(komariThemeSettings.customLinks),
		customIllustration:
			text(window.CustomIllustration) ??
			text(komariThemeSettings.customIllustration),
		showNetTransfer: Boolean(
			window.ShowNetTransfer ?? komariThemeSettings.showNetTransfer ?? true,
		),
		fixedTopServerName: Boolean(
			window.FixedTopServerName ??
				komariThemeSettings.fixedTopServerName ??
				false,
		),
		forceUseSvgFlag: Boolean(
			window.ForceUseSvgFlag ?? komariThemeSettings.forceUseSvgFlag ?? false,
		),
		disableAnimatedMan: Boolean(
			window.DisableAnimatedMan ??
				komariThemeSettings.disableAnimatedMan ??
				true,
		),
		customFooterHtml:
			text(window.CustomFooterHtml) ??
			text(komariThemeSettings.customFooterHtml),
		forceSortType: SORT_TYPES.includes(window.ForceSortType as SortType)
			? (window.ForceSortType as SortType)
			: undefined,
		forceSortOrder: SORT_ORDERS.includes(window.ForceSortOrder as SortOrder)
			? (window.ForceSortOrder as SortOrder)
			: undefined,
	};
	if (
		Object.keys(next).some(
			(key) =>
				next[key as keyof RuntimeConfig] !==
				snapshot[key as keyof RuntimeConfig],
		)
	)
		snapshot = next;
	return snapshot;
}

export function refreshRuntimeConfig() {
	if (typeof window !== "undefined")
		window.dispatchEvent(new Event(RUNTIME_CONFIG_CHANGE_EVENT));
}

const observedKeys = [
	"ForceTheme",
	"CustomBackgroundImage",
	"CustomMobileBackgroundImage",
	"ForceSortType",
	"ForceSortOrder",
	"ForceShowServices",
	"ForceShowMap",
	"ForceCardInline",
	"ForcePeakCutEnabled",
	"CustomLogo",
	"CustomDesc",
	"CustomLinks",
	"CustomIllustration",
	"ShowNetTransfer",
	"FixedTopServerName",
	"ForceUseSvgFlag",
	"DisableAnimatedMan",
	"CustomFooterHtml",
] as const;
let subscribers = 0;
let stopObserving: (() => void) | undefined;

function observeAssignments() {
	const cleanups: Array<() => void> = [];
	let needsLegacyFallback = false;
	for (const key of observedKeys) {
		const descriptor = Object.getOwnPropertyDescriptor(window, key);
		// Do not replace custom accessors, readonly data, or nonconfigurable globals.
		if (
			descriptor &&
			(!descriptor.configurable ||
				!("value" in descriptor) ||
				!descriptor.writable)
		) {
			needsLegacyFallback = true;
			continue;
		}
		let value: unknown = window[key];
		let assigned = false;
		const get = () => value;
		const set = (next: unknown) => {
			assigned = true;
			if (Object.is(value, next)) return;
			value = next;
			refreshRuntimeConfig();
		};
		Object.defineProperty(window, key, {
			configurable: true,
			enumerable: descriptor?.enumerable ?? true,
			get,
			set,
		});
		cleanups.push(() => {
			const current = Object.getOwnPropertyDescriptor(window, key);
			// A custom script may replace our descriptor; never overwrite its changes.
			if (current?.get !== get || current?.set !== set) return;
			if (!descriptor && !assigned) Reflect.deleteProperty(window, key);
			else
				Object.defineProperty(window, key, {
					...descriptor,
					configurable: true,
					enumerable: descriptor?.enumerable ?? true,
					writable: true,
					value,
				});
		});
	}
	if (needsLegacyFallback) {
		let checks = 0;
		const interval = window.setInterval(() => {
			refreshRuntimeConfig();
			if (++checks >= 50) window.clearInterval(interval);
		}, 100);
		cleanups.push(() => window.clearInterval(interval));
	}
	return () => {
		for (const cleanup of cleanups) cleanup();
	};
}

function subscribe(listener: () => void) {
	if (typeof window === "undefined") return () => {};
	window.addEventListener(RUNTIME_CONFIG_CHANGE_EVENT, listener);
	window.addEventListener("backgroundChange", listener);
	if (subscribers++ === 0) stopObserving = observeAssignments();
	return () => {
		window.removeEventListener(RUNTIME_CONFIG_CHANGE_EVENT, listener);
		window.removeEventListener("backgroundChange", listener);
		if (--subscribers === 0) {
			stopObserving?.();
			stopObserving = undefined;
		}
	};
}

export function useRuntimeConfig() {
	return useSyncExternalStore(subscribe, readRuntimeConfig, () => defaults);
}

export function restoreBackground() {
	if (!window.CustomBackgroundImage) {
		window.CustomBackgroundImage =
			safeSessionStorage.getItem("savedBackgroundImage") || "";
	}
	refreshRuntimeConfig();
}

export function updateBackground(newBackground: string | undefined) {
	window.CustomBackgroundImage = newBackground || "";
	window.dispatchEvent(new Event("backgroundChange"));
}
