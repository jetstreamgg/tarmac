import { Page, Route, Request } from '@playwright/test';

const BASE_URL = 'https://api.cow.fi/**/api/v1';

export const interceptAndMockCowApiCalls = async (page: Page) => {
  await page.route(BASE_URL + '/quote', mockCowQuoteApiResponses);
  await page.route(BASE_URL + '/orders', mockCowOrderCreationApiResponses);
  await page.route(BASE_URL + '/orders/**', mockCowOrderFetchingApiResponses);
};

const mockCowQuoteApiResponses = async (route: Route) => {
  const response = await route.fetch();
  const responseBody = await response.json();

  const modifiedBody = {
    ...responseBody,
    quote: {
      ...responseBody.quote,
      // Set the fee amount to 0 to avoid issues on the frontend for edge case quotes
      feeAmount: '0'
    }
  };

  // Send the modified response to frontend
  await route.fulfill({
    status: response.status(),
    headers: response.headers(),
    body: JSON.stringify(modifiedBody)
  });
};

const mockCowOrderCreationApiResponses = (route: Route, request: Request) => {
  if (request.method() === 'POST') {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      // Mocked created order ID
      body: JSON.stringify('0xabCabCabC')
    });
  } else {
    route.continue();
  }
};

const mockCowOrderFetchingApiResponses = (route: Route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ status: 'fulfilled', executedSellAmount: '0', executedBuyAmount: '0' })
  });
};
