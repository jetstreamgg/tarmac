import { type Page } from '@playwright/test';
import { NetworkName } from './constants';

export const switchToL2 = async (page: Page, networkName: NetworkName) => {
  //open network switcher from widget button
  await page.getByTestId('chain-modal-trigger-widget').click();
  //close widget button
  await page.getByTestId('chain-modal-close').click();
  //open network switcher from header button
  await page.getByTestId('chain-modal-trigger-header').click();
  //select base
  await page.getByRole('button', { name: `Tenderly ${networkName}` }).click();
};
