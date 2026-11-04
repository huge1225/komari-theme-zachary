import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { fetchSetting } from "@/lib/nezha-api";
import { useRuntimeConfig } from "@/lib/runtime-config";

const Footer: React.FC = () => {
	const { t } = useTranslation();
	const isMac = /macintosh|mac os x/i.test(navigator.userAgent);
	const { customFooterHtml } = useRuntimeConfig();

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});

	return (
		<footer className="mx-auto w-full max-w-5xl px-4 lg:px-0 pb-4 server-footer">
			<section className="flex flex-col gap-1">
				{customFooterHtml && (
					<div
						className="text-center text-xs text-neutral-600/60 dark:text-neutral-300/60"
						dangerouslySetInnerHTML={{ __html: customFooterHtml }}
					/>
				)}
				<section className="mt-1 flex items-center sm:flex-row flex-col justify-between gap-2 text-[13px] font-light tracking-tight text-neutral-600/50 dark:text-neutral-300/50 server-footer-name">
					<div className="flex flex-wrap items-center gap-1">
						<span>
							Powered by{" "}
							<a
								href="https://github.com/komari-monitor/komari"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:underline"
							>
								Komari Monitor
							</a>
							.
						</span>
						{settingData?.data?.version && (
							<span>({settingData.data.version})</span>
						)}
					</div>
					<div className="server-footer-theme flex flex-col items-center sm:items-end">
						<p className="mt-1 text-[13px] font-light tracking-tight text-neutral-600/50 dark:text-neutral-300/50">
							<kbd className="pointer-events-none mx-1 inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
								{isMac ? <span className="text-xs">⌘</span> : "Ctrl "}K
							</kbd>
						</p>
						<section className="flex flex-wrap items-center gap-1">
							<span>
								{t("footer.themeBy")}
								<span className="font-medium text-neutral-700/80 dark:text-neutral-200/80">
									Zachary
								</span>
							</span>
							<span>·</span>
							<span>
								UI based on{" "}
								<a
									href={"https://github.com/hamster1963/nezha-dash-v1"}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:underline"
								>
									nezha-dash
								</a>
							</span>
						</section>
					</div>
				</section>
			</section>
		</footer>
	);
};

export default Footer;
