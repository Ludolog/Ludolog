const GG_DEALS_HOME_URL = "https://gg.deals/";

export function GGDealsAttribution({
  className = "",
  href = GG_DEALS_HOME_URL
}: {
  className?: string;
  href?: string | null;
}): React.ReactElement {
  return (
    <p className={`text-xs leading-5 text-slate-500 ${className}`}>
      Price data:{" "}
      <a
        href={href ?? GG_DEALS_HOME_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-radar-cyan underline underline-offset-2 hover:text-white"
      >
        GG.deals
      </a>
    </p>
  );
}
