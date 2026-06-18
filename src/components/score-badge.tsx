import { recommendationLabel } from "@/lib/services/deal-score-service";
import { recommendationTone } from "@/lib/format";
import type { GameValueResult } from "@/lib/types";

export function ScoreBadge({ score }: { score: GameValueResult }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-radar-cyan/35 bg-radar-cyan/10 px-2.5 py-1 text-sm font-semibold text-radar-cyan">
        {score.score}/100
      </span>
      <span className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${recommendationTone(score.recommendation)}`}>
        {recommendationLabel(score.recommendation)}
      </span>
    </div>
  );
}

