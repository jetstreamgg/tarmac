import { Intent } from '../../../lib/enums';
import { SealToken } from '../../seal/constants';

export type UserConfig = {
  locale?: string;
  intent: Intent;
  sealToken?: SealToken;
  chatSuggested: boolean;
};
