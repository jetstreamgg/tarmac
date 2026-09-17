import { type Token } from '@/hooks';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useEarnModal, type UseEarnModalOptions } from '@/modules/ui/hooks/useEarnModal';
import { RewardsModalForm, type RewardsModalPreset } from '../components/RewardsModalForm';

/** Per-contract inputs the launcher needs to open the modal for a specific farm. */
export type RewardsModalArgs = {
  contractAddress: `0x${string}`;
  /** The token staked into the reward contract (USDS for every current farm). */
  supplyToken: Token;
  /** Display title shown in modal titles + the review "Product" row (e.g. "SPK Rewards"). */
  displayName: string;
  /** Registry `contract.name`, reported as the analytics `product` (legacy parity). */
  productName: string;
  /** Reward-token symbol for the "Rewards in" row; omit for point farms (CLE). */
  rewardTokenSymbol?: string;
  /** Reward rate (decimal fraction) for the modal's Rate + 1Y projected-earnings rows. */
  rate?: number;
};

const productName = (args: RewardsModalArgs) => args.displayName;
const form: UseEarnModalOptions<RewardsModalArgs, RewardsModalPreset>['form'] = ({
  sessionId,
  flow,
  args,
  preset
}) => (
  <RewardsModalForm
    sessionId={sessionId}
    flow={flow}
    contractAddress={args.contractAddress}
    supplyToken={args.supplyToken}
    displayName={args.displayName}
    productName={args.productName}
    rewardTokenSymbol={args.rewardTokenSymbol}
    rate={args.rate}
    preset={preset}
  />
);

type UseRewardsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable rewards supply/withdraw modal. Reward farms
 * are many, so the per-contract inputs are passed to `openSupply`/`openWithdraw`
 * at call time — the same launcher can open the modal for any farm. Farms are
 * mainnet-only — the modal is guarded off any L2 (APP-528). Analytics
 * live-merge from the form body (`useModalEntryBody`).
 */
export function useRewardsModal({ onSuccess }: UseRewardsModalOptions = {}) {
  return useEarnModal<RewardsModalArgs, RewardsModalPreset>({
    productName,
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    form,
    onSuccess
  });
}
