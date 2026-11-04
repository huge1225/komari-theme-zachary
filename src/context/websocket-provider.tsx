import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKomariRealtimeSnapshot } from "@/lib/komari-adapter";
import { restoreServerPublicNotes } from "@/lib/public-note-cache";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";
import {
	WebSocketContext,
	type WebSocketContextType,
} from "./websocket-context";

interface WebSocketProviderProps {
	url: string;
	children: React.ReactNode;
}

const POLL_INTERVAL_MS = 2000;

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
	children,
}) => {
	const [lastData, setLastData] = useState<NezhaWebsocketResponse | null>(null);
	const [messageHistory, setMessageHistory] = useState<
		NezhaWebsocketResponse[]
	>([]);
	const [connected, setConnected] = useState(false);
	const [needReconnect, setNeedReconnect] = useState(false);

	const active = useRef(false);
	const isFetching = useRef(false);
	const timerRef = useRef<number | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const clearPollTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const cleanup = useCallback(() => {
		clearPollTimer();
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isFetching.current = false;
	}, [clearPollTimer]);

	const pollOnce = useCallback(async () => {
		if (!active.current || isFetching.current || document.hidden) return;
		isFetching.current = true;

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const snapshot = await fetchKomariRealtimeSnapshot(controller.signal);
			if (!active.current || controller.signal.aborted) return;

			const normalized: NezhaWebsocketResponse = {
				...snapshot,
				servers: restoreServerPublicNotes(snapshot.servers),
			};

			setConnected(true);
			setLastData(normalized);
			setMessageHistory((prev) => [normalized, ...prev].slice(0, 30));
		} catch (error) {
			if (!controller.signal.aborted) {
				console.error("Komari live snapshot poll error:", error);
				setConnected(false);
			}
		} finally {
			isFetching.current = false;
			if (active.current && !document.hidden) {
				clearPollTimer();
				timerRef.current = window.setTimeout(() => {
					void pollOnce();
				}, POLL_INTERVAL_MS);
			}
		}
	}, [clearPollTimer]);

	const reconnect = useCallback(() => {
		if (!active.current) return;
		cleanup();
		void pollOnce();
	}, [cleanup, pollOnce]);

	useEffect(() => {
		active.current = true;
		void pollOnce();

		const handleVisibilityChange = () => {
			if (document.hidden) {
				clearPollTimer();
			} else {
				void pollOnce();
			}
		};

		const handleOnlineOrFocus = () => {
			if (!document.hidden && !isFetching.current) {
				void pollOnce();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("online", handleOnlineOrFocus);
		window.addEventListener("focus", handleOnlineOrFocus);

		return () => {
			active.current = false;
			cleanup();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("online", handleOnlineOrFocus);
			window.removeEventListener("focus", handleOnlineOrFocus);
		};
	}, [cleanup, clearPollTimer, pollOnce]);

	const contextValue: WebSocketContextType = {
		lastData,
		connected,
		messageHistory,
		reconnect,
		needReconnect,
		setNeedReconnect,
	};

	return (
		<WebSocketContext.Provider value={contextValue}>
			{children}
		</WebSocketContext.Provider>
	);
};
