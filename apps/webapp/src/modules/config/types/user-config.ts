import { Intent } from '../../../lib/enums';
import { SealToken } from '../../seal/constants';
import { ActivationToken } from '../../activation/constants';
export type UserConfig = {
  locale?: string;
  intent: Intent;
  sealToken?: SealToken;
  activationToken?: ActivationToken;
};
