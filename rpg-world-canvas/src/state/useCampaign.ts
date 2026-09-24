import { useEffect, useState } from "react";
import type { CampaignState, CampaignStore } from "./campaignStore";

export function useCampaign(store: CampaignStore): CampaignState {
  const [state, setState] = useState<CampaignState>(() => store.getSnapshot());
  useEffect(() => store.subscribe(() => setState(store.getSnapshot())), [store]);
  return state;
}
