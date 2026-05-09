import type { ChallengeState } from "@/lib/types";
import { STATE_LABEL, STATE_CLASS } from "@/lib/utils";

export function StateIndicator({ state }: { state: ChallengeState }) {
  return <span className={STATE_CLASS[state]}>{STATE_LABEL[state]}</span>;
}
