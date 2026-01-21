import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

/**
 * Chatbot E2E tests
 *
 * These tests use Playwright's base test (no custom fixtures) since they don't
 * require blockchain interaction. The chatbot API is mocked to avoid 401 errors.
 *
 * Run with: pnpm e2e chatbot.spec.ts
 */

const mockChatResponse = {
  response: 'Hello! I am SkyWing, your AI assistant. How can I help you today?',
  actions: []
};

const mockChatResponseWithIntent = {
  response: 'I can help you with savings! Here are some options:',
  actions: [
    {
      title: 'Access Savings',
      url: '/?widget=savings',
      priority: 1
    }
  ]
};

test.describe('Chatbot', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    // 1. Setup Request Interception (Mocks) BEFORE navigation

    // Mock the chatbot API endpoint for all tests
    await isolatedPage.route('**/chat', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        const lastMessage = body?.messages?.at(-1)?.content || '';

        const response = lastMessage.toLowerCase().includes('save')
          ? mockChatResponseWithIntent
          : mockChatResponse;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        });
      } else {
        await route.continue();
      }
    });

    // Mock VPN check
    await isolatedPage.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    // Mock chatbot terms check
    await isolatedPage.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true })
      });
    });

    // 2. Navigate directly to the page with chat enabled
    await isolatedPage.goto('/?chat=true', { waitUntil: 'networkidle' });

    // 3. Connect wallet after navigation (state will be preserved for the test)
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
  });

  test('can open chat and send a message', async ({ isolatedPage }) => {
    // Already on /?chat=true from beforeEach

    // Wait for the chat to be visible
    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Verify the initial bot message is present
    await expect(isolatedPage.getByText(/Hi, I'm your AI-powered chatbot assistant/)).toBeVisible();

    // Type a message in the chat input
    const chatInput = isolatedPage.locator('textarea');
    await chatInput.fill('Hello');

    // Send the message by pressing Enter
    await chatInput.press('Enter');

    // Wait for the response
    await isolatedPage.waitForSelector('text=Hello! I am SkyWing');

    // Verify the response is displayed
    await expect(isolatedPage.getByText('Hello! I am SkyWing, your AI assistant.')).toBeVisible();
  });

  test('displays action intents and navigates to widget on click', async ({ isolatedPage }) => {
    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Send a message that triggers intent response
    const chatInput = isolatedPage.locator('textarea');
    await chatInput.fill('How do I save?');
    await chatInput.press('Enter');

    // Wait for the response with intent
    await isolatedPage.waitForSelector('text=I can help you with savings');

    // Verify the action button is displayed
    const actionButton = isolatedPage.getByText('Access Savings');
    await expect(actionButton).toBeVisible();

    // Click the action button
    await actionButton.click();

    // Verify navigation to savings widget
    await expect(isolatedPage).toHaveURL(/widget=savings/);
  });

  test('shows terms modal when chat returns 401 unauthorized', async ({ isolatedPage }) => {
    // Override the chat mock to return 401 for this test
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Send a message that will trigger 401
    const chatInput = isolatedPage.locator('textarea');
    await chatInput.fill('Hello');
    await chatInput.press('Enter');

    // Verify the error message appears in chat
    await expect(
      isolatedPage.getByText('Please accept the chatbot terms of service to continue.')
    ).toBeVisible({
      timeout: 10000
    });

    // Verify the "Accept Terms" button is visible and click it
    const acceptTermsButton = isolatedPage.getByRole('button', { name: /accept terms/i });
    await expect(acceptTermsButton).toBeVisible();
    await acceptTermsButton.click();

    // Verify the terms modal opens with expected content
    const dialog = isolatedPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Chatbot Terms of Service')).toBeVisible();
    await expect(dialog.getByText(/Terms version:/)).toBeVisible();
    await expect(dialog.getByText(/\d{4}-\d{2}-\d{2}/)).toBeVisible(); // Date format like 2025-07-15
    await expect(dialog.getByRole('button', { name: /I decline/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Scroll down/i })).toBeVisible();
  });

  test('shows jurisdiction restriction card when chat returns 403 forbidden', async ({ isolatedPage }) => {
    // Override the chat mock to return 403 with region restriction error code
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Forbidden',
            error_code: 'CHATBOT_REGION_RESTRICTED'
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Verify initial chat state - bot welcome message visible
    await expect(isolatedPage.getByText(/Hi, I'm your AI-powered chatbot assistant/)).toBeVisible();

    // Send a message that will trigger 403
    const chatInput = isolatedPage.locator('textarea');
    await chatInput.fill('Hello');
    await chatInput.press('Enter');

    // Verify the jurisdiction restriction card appears
    await expect(isolatedPage.getByText('Chatbot not available in your region')).toBeVisible({
      timeout: 10000
    });
    await expect(
      isolatedPage.getByText('Access to the chatbot is restricted in certain jurisdictions.')
    ).toBeVisible();

    // Verify chat history is cleared (welcome message should be gone)
    await expect(isolatedPage.getByText(/Hi, I'm your AI-powered chatbot assistant/)).not.toBeVisible();

    // Verify chat input is not visible (replaced by restriction card)
    await expect(isolatedPage.locator('textarea')).not.toBeVisible();
  });

  test('shows jurisdiction restriction card when terms check returns 403', async ({ isolatedPage }) => {
    // Override terms check to return 403 with region restriction error code
    await isolatedPage.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden',
          error_code: 'CHATBOT_REGION_RESTRICTED'
        })
      });
    });

    // Navigate fresh - the terms check happens on load
    await isolatedPage.goto('/?chat=true', { waitUntil: 'networkidle' });
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    // Wait for the restriction card to appear (terms check triggers on chat open)
    await expect(isolatedPage.getByText('Chatbot not available in your region')).toBeVisible({
      timeout: 10000
    });
    await expect(
      isolatedPage.getByText('Access to the chatbot is restricted in certain jurisdictions.')
    ).toBeVisible();

    // Verify chat input is not visible
    await expect(isolatedPage.locator('textarea')).not.toBeVisible();
  });

  test('shows jurisdiction restriction card when feedback submission returns 403', async ({
    isolatedPage
  }) => {
    // Setup feedback mock to return 403 with region restriction error code
    await isolatedPage.route('**/chatbot/feedback', async route => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden',
          error_code: 'CHATBOT_REGION_RESTRICTED'
        })
      });
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // Send a message to get the feedback prompt to appear
    await chatInput.fill('Topic 1');
    await chatInput.press('Enter');
    // Wait for the default mock response (SkyWing greeting)
    await expect(
      isolatedPage.getByText('Hello! I am SkyWing, your AI assistant. How can I help you today?')
    ).toBeVisible({
      timeout: 15000
    });

    // Click the thumbs up button to trigger feedback submission
    const thumbsUpBtn = isolatedPage.getByRole('button', { name: 'Good conversation' });
    await expect(thumbsUpBtn).toBeVisible();
    await thumbsUpBtn.click();

    // Submit feedback in the modal
    const modal = isolatedPage.getByRole('dialog');
    await expect(modal).toBeVisible();
    const submitBtn = modal.getByRole('button', { name: 'Submit' });
    await submitBtn.click();

    // Verify the jurisdiction restriction card appears
    await expect(isolatedPage.getByText('Chatbot not available in your region')).toBeVisible({
      timeout: 10000
    });
    await expect(
      isolatedPage.getByText('Access to the chatbot is restricted in certain jurisdictions.')
    ).toBeVisible();

    // Verify chat input is not visible
    await expect(isolatedPage.locator('textarea')).not.toBeVisible();
  });

  test('complete yield query flow with optimistic updates and intent buttons', async ({ isolatedPage }) => {
    // Mock response with yield-related intents
    const yieldResponse = {
      response: 'You can earn yield through our Savings and Rewards modules!',
      actions: [
        {
          title: 'Access Savings',
          url: '/?widget=savings',
          priority: 1
        },
        {
          title: 'Get Rewards',
          url: '/?widget=rewards',
          priority: 2
        }
      ]
    };

    // Override the default mock for this specific test
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(yieldResponse)
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Step 1: Send the message
    const chatInput = isolatedPage.locator('textarea');
    const testMessage = 'How can I earn yield?';
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');

    // Step 2: Verify optimistic update - user message appears immediately
    await expect(isolatedPage.getByText(testMessage)).toBeVisible({ timeout: 1000 });

    // Step 3: Verify loading state shows (optional - may be too fast with mocked responses)
    // The typing indicator has no text, so we check for the "Stop generating" button instead
    const stopGeneratingButton = isolatedPage.getByRole('button', { name: 'Stop generating' });
    const loadingWasVisible = await stopGeneratingButton.isVisible().catch(() => false);

    if (loadingWasVisible) {
      // If we caught the loading state, wait for it to disappear
      await expect(stopGeneratingButton).not.toBeVisible({ timeout: 10000 });
    } else {
      // If loading was too fast, just wait a bit for the response to render
      await isolatedPage.waitForTimeout(500);
    }

    // Step 4: Verify bot response appears with proper formatting
    await expect(
      isolatedPage.getByText('You can earn yield through our Savings and Rewards modules!')
    ).toBeVisible();

    // Step 5: Verify intent buttons appear below response
    const savingsButton = isolatedPage.getByRole('button', { name: /Access Savings/i });
    const rewardsButton = isolatedPage.getByRole('button', { name: /Get Rewards/i });

    await expect(savingsButton).toBeVisible();
    await expect(rewardsButton).toBeVisible();

    // Step 6: Verify buttons are clickable (enabled)
    await expect(savingsButton).toBeEnabled();
    await expect(rewardsButton).toBeEnabled();

    // Step 7: Verify chat auto-scrolls to bottom
    // Check that the latest message (bot response with intents) is in viewport
    const lastMessage = isolatedPage.getByText('You can earn yield through our Savings and Rewards modules!');
    await expect(lastMessage).toBeInViewport();

    // Step 8: Verify clicking intent button navigates correctly
    await savingsButton.click();
    await expect(isolatedPage).toHaveURL(/widget=savings/);
  });

  test.skip('verifies pre-fill parameter filtering behavior', async ({ isolatedPage }) => {
    const isFilteringEnabled = false;
    console.log(`Expecting filtering to be: ${isFilteringEnabled ? 'ENABLED' : 'DISABLED'}`);

    // Mock response with both generic and pre-filled intents
    const responseWithPreFill = {
      response: 'I can help you deposit 1000 USDS into savings!',
      actions: [
        {
          title: 'Deposit 1000 USDS',
          url: '/?widget=savings&input_amount=1000&source_token=USDS',
          priority: 1
        },
        {
          title: 'Trade 500 DAI for USDS',
          url: '/?widget=trade&input_amount=500&source_token=DAI&target_token=USDS',
          priority: 2
        },
        {
          title: 'Access Savings',
          url: '/?widget=savings',
          priority: 3
        },
        {
          title: 'Open Trade',
          url: '/?widget=trade',
          priority: 4
        }
      ]
    };

    // Override the chat mock for this test
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseWithPreFill)
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');

    // Send message about depositing with specific amount
    const chatInput = isolatedPage.locator('textarea');
    await chatInput.fill('I want to deposit 1000 USDS');
    await chatInput.press('Enter');

    // Wait for response
    await expect(isolatedPage.getByText('I can help you deposit 1000 USDS into savings!')).toBeVisible({
      timeout: 10000
    });

    // Determine expected behavior based on environment flag
    if (isFilteringEnabled) {
      // --- Case 1: Filtering Enabled (Default) ---

      // Verify pre-filled intents are NOT shown (filtered out)
      await expect(isolatedPage.getByRole('button', { name: /Deposit 1000 USDS/i })).toBeVisible();
      await expect(isolatedPage.getByRole('button', { name: /Trade 500 DAI for USDS/i })).not.toBeVisible();

      // Verify generic intents WITHOUT pre-fill parameters ARE shown
      const savingsButton = isolatedPage.getByRole('button', { name: /Access Savings/i });
      const tradeButton = isolatedPage.getByRole('button', { name: /Open Trade/i });

      await expect(savingsButton).toBeVisible();
      await expect(tradeButton).toBeVisible();

      // Verify the generic buttons don't have pre-fill parameters in their URLs
      await savingsButton.click();
      await isolatedPage.waitForURL(/widget=savings/);

      const currentUrl = isolatedPage.url();
      expect(currentUrl).not.toContain('input_amount');
      expect(currentUrl).not.toContain('source_token');
      expect(currentUrl).not.toContain('target_token');
    } else {
      // --- Case 2: Filtering Disabled ---

      // Verify pre-filled intents ARE shown
      const depositButton = isolatedPage.getByRole('button', { name: /Deposit 1000 USDS/i });
      const tradeWithParamsButton = isolatedPage.getByRole('button', { name: /Trade 500 DAI for USDS/i });

      await expect(depositButton).toBeVisible();
      await expect(tradeWithParamsButton).toBeVisible();

      // Verify generic intents are ALSO shown (if they were returned by API)
      await expect(isolatedPage.getByRole('button', { name: /Access Savings/i })).toBeVisible();

      // Verify clicking a pre-filled button preserves parameters
      await depositButton.click();
      // click continu button
      await isolatedPage.getByRole('button', { name: /Continue/i }).click();

      // Wait for navigation and verify URL params
      await isolatedPage.waitForURL(/widget=savings/);
      const currentUrl = isolatedPage.url();

      console.log(currentUrl);

      expect(currentUrl).toContain('input_amount=1000');
    }
  });

  test('verifies history limit truncation in API calls while keeping UI history', async ({
    isolatedPage
  }) => {
    const HISTORY_LIMIT = 8;
    const TOTAL_MESSAGES_TO_SEND = 10;

    // Capture ALL request payloads to debug order matching
    const requests: any[] = [];

    // Override the chat mock to capture requests
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        requests.push(body);

        const lastMessage = body.messages[body.messages.length - 1];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Response to: ${lastMessage.content}`,
            actions: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // Send multiple messages to build up history
    for (let i = 1; i <= TOTAL_MESSAGES_TO_SEND; i++) {
      const msg = `Message ${i}`;
      await chatInput.fill(msg);
      await chatInput.press('Enter');

      // Wait for the specific response to ensure order and completion
      // We start checking for response immediately
      await expect(isolatedPage.getByText(`Response to: ${msg}`, { exact: true })).toBeVisible();
    }

    // 1. Verify UI shows ALL messages (oldest to newest)
    // Scroll to top to verify first message
    const firstMessage = isolatedPage.getByText('Message 1', { exact: true });
    await firstMessage.scrollIntoViewIfNeeded(); // Ensure it's in view if needed
    await expect(firstMessage).toBeVisible();

    const firstResponse = isolatedPage.getByText('Response to: Message 1', { exact: true });
    await expect(firstResponse).toBeVisible();

    // Scroll to bottom to verify last message
    const lastMessageUI = isolatedPage.getByText(`Message ${TOTAL_MESSAGES_TO_SEND}`, { exact: true });
    await lastMessageUI.scrollIntoViewIfNeeded();
    await expect(lastMessageUI).toBeVisible();

    // 2. Verify API payload was truncated for the LAST request
    const lastRequestPayload = requests[requests.length - 1];
    const lastRequestMessages = lastRequestPayload.messages || [];

    console.log(`Total requests captured: ${requests.length}`);
    console.log(`Last request messages count: ${lastRequestMessages.length}`);
    console.log('Last request content:', JSON.stringify(lastRequestMessages.map((m: any) => m.content)));

    // Verify we captured the correct request corresponding to the last message
    expect(lastRequestMessages[lastRequestMessages.length - 1].content).toBe(
      `Message ${TOTAL_MESSAGES_TO_SEND}`
    );

    // Verify truncation
    expect(lastRequestMessages.length).toBeLessThanOrEqual(HISTORY_LIMIT);

    // 3. Verify the CONTENT of the sent messages are the LATEST ones
    const contentArray = lastRequestMessages.map((m: any) => m.content);

    // It should NOT contain Message 1 (ancient history)
    if (TOTAL_MESSAGES_TO_SEND > HISTORY_LIMIT) {
      expect(contentArray).not.toContain('Message 1');
      // Verify no part of Message 1 remains (extra check)
      expect(contentArray.some((c: string) => c === 'Message 1' || c === 'Response to: Message 1')).toBe(
        false
      );
    }

    // It SHOULD contain the latest messages
    expect(contentArray).toContain(`Message ${TOTAL_MESSAGES_TO_SEND}`);
    expect(contentArray).toContain(`Response to: Message ${TOTAL_MESSAGES_TO_SEND - 1}`);
  });

  test('verifies conversation feedback flow', async ({ isolatedPage }) => {
    // Setup feedback mock
    await isolatedPage.route('**/chatbot/feedback', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Feedback submitted successfully' })
      });
    });

    // Setup chat mock to return dynamic responses
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const lastMessage = body.messages[body.messages.length - 1];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Response to: ${lastMessage.content}`,
            actions: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // 1. Initial State: Prompt should NOT be visible
    // Current history: 1 message (Welcome)
    const feedbackPrompt = isolatedPage.getByText('Rate this conversation:');
    await expect(feedbackPrompt).not.toBeVisible();

    // 2. Interaction 1: User sends message -> Bot responds
    // History: Welcome, UserMsg1, BotResp1 = 3 messages.
    // Condition >= 3 messages met.
    await chatInput.fill('Topic 1');
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText('Response to: Topic 1', { exact: true })).toBeVisible();

    // Verify prompt APPEARS
    await expect(feedbackPrompt).toBeVisible();

    const thumbsUpBtn = isolatedPage.getByRole('button', { name: 'Good conversation' });
    await expect(thumbsUpBtn).toBeVisible();

    // 3. Open Feedback Modal
    await thumbsUpBtn.click();

    const modal = isolatedPage.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Rate This Conversation')).toBeVisible();

    // Verify positive rating is selected (based on which button we clicked)
    // The selected button has a specific class or state, but we can verify text "Your selection: Overall positive"
    await expect(modal.getByText('Your selection: Overall positive')).toBeVisible();

    // 4. Submit Feedback
    const submitBtn = modal.getByRole('button', { name: 'Submit' });
    await submitBtn.click();

    // Verify confirmation/closing (Mock returns success)
    await expect(modal).not.toBeVisible();
  });

  test('handles network errors gracefully', async ({ isolatedPage }) => {
    // Override the chat mock to return 500 header
    await isolatedPage.route('**/chat', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // Send a message that will fail
    await chatInput.fill('Trigger Error');
    await chatInput.press('Enter');

    // Verify error message is displayed
    await expect(
      isolatedPage.getByText(/something went wrong|error occurred|please try again/i)
    ).toBeVisible();

    // Verify generic error UI (e.g. red text or specific icon) - specific implementation dependent
    // But mainly we want to ensure the app doesn't crash and user can retry.

    // Restore mock to success for retry
    // Let's explicitly override again with success
    await isolatedPage.route('**/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: 'Retry successful', actions: [] })
      });
    });

    // Retry sending message
    await chatInput.fill('Retry Message');
    await chatInput.press('Enter');

    // Verify success response
    await expect(isolatedPage.getByText('Retry successful')).toBeVisible();
  });

  test('filters out invalid intent URLs', async ({ isolatedPage }) => {
    // Mock response with invalid intent URL
    const responseWithInvalidIntent = {
      response: 'Here are some options, but one is broken.',
      actions: [
        {
          title: 'Valid Action',
          url: '/?widget=savings',
          priority: 1
        },
        {
          title: 'Broken Action',
          url: 'not-a-valid-url-structure', // Malformed/unparseable by intentUtils
          priority: 2
        }
      ]
    };

    // Override the chat mock
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseWithInvalidIntent)
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    await chatInput.fill('Show me options');
    await chatInput.press('Enter');

    // Verify response text
    await expect(isolatedPage.getByText('Here are some options, but one is broken.')).toBeVisible();

    // Verify VALID action is shown
    await expect(isolatedPage.getByRole('button', { name: 'Valid Action' })).toBeVisible();

    // Verify BROKEN action is filtered out (NOT shown)
    await expect(isolatedPage.getByRole('button', { name: 'Broken Action' })).not.toBeVisible();
  });

  test('verifies response modifiers behavior', async ({ isolatedPage }) => {
    // Capture request payloads
    const requests: any[] = [];

    // Mock chat API
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        requests.push(body);

        const lastMessage = body.messages[body.messages.length - 1];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Response to: ${lastMessage.content}`,
            actions: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // 1. Send initial message
    await chatInput.fill('Explain specific concept');
    await chatInput.press('Enter');

    // Wait for response
    await expect(isolatedPage.getByText('Response to: Explain specific concept')).toBeVisible();

    // 2. Verify modifiers appear on the LATEST bot message
    const longerBtn = isolatedPage.getByRole('button', { name: 'Longer' });
    const simplerBtn = isolatedPage.getByRole('button', { name: 'Simpler' });

    await expect(longerBtn).toBeVisible();
    await expect(simplerBtn).toBeVisible();

    // 3. Click "Longer"
    await longerBtn.click();

    // Verify response to modifier
    // The mock echoes the input, which is the modifier text
    await expect(isolatedPage.getByText('Response to: Please, extend your answer')).toBeVisible();

    // 4. Verify request payload for "Longer"
    const longerRequest = requests[requests.length - 1];
    const longerMsg = longerRequest.messages[longerRequest.messages.length - 1];
    expect(longerMsg.content).toBe('Please, extend your answer');

    await simplerBtn.click();

    // Verify response
    await expect(isolatedPage.getByText('Response to: Please, simplify your answer')).toBeVisible();

    // 7. Verify request payload for "Simpler"
    const simplerRequest = requests[requests.length - 1];
    const simplerMsg = simplerRequest.messages[simplerRequest.messages.length - 1];
    expect(simplerMsg.content).toBe('Please, simplify your answer');
  });

  test('verifies message cancellation flow', async ({ isolatedPage }) => {
    // 1. Setup delayed mock to simulate long generation
    await isolatedPage.route('**/chat', async route => {
      // Delay response by 5 seconds to give us time to click stop
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'This is a delayed response that should not be seen',
          actions: []
        })
      });
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // 2. Send message
    await chatInput.fill('Generate long response');
    await chatInput.press('Enter');

    // 3. Verify "Stop generating" button appears
    const stopButton = isolatedPage.getByRole('button', { name: 'Stop generating' });
    await expect(stopButton).toBeVisible();

    // 4. Click stop
    await stopButton.click();

    // 5. Verify UI state
    // "Stop generating" should disappear (or revert to send button) in this context (input area)
    // Actually StopGeneratingButton is in the bot bubble area.
    // Wait for the stop button to be gone
    await expect(stopButton).not.toBeVisible();

    // Verify User message is HIDDEN (ChatBubble returns null for canceled user messages)
    // We need to ensure "Generate long response" is NOT visible
    await expect(isolatedPage.getByText('Generate long response')).not.toBeVisible();

    // Verify Bot message shows "User cancelled message"
    await expect(isolatedPage.getByText('User cancelled message')).toBeVisible();

    // 6. Verify History Cleanup
    // We need to send a NEW message and check its payload

    // Capture the *next* request
    const requests: any[] = [];
    // Update mock to be instant for the next message
    await isolatedPage.unroute('**/chat');
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        requests.push(body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Next response', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await chatInput.fill('Next message');
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText('Response to: Next message')).not.toBeVisible(); // The mock returns "Next response"
    await expect(isolatedPage.getByText('Next response')).toBeVisible();

    // Analyze the request payload
    const lastRequest = requests[requests.length - 1];
    const messages = lastRequest.messages;

    // The history should NOT contain "Generate long response"
    // nor the "User cancelled message" text (which is client-side translation)
    // nor null/canceled items.

    const contentArray = messages.map((m: any) => m.content);
    expect(contentArray).not.toContain('Generate long response');
    expect(contentArray).not.toContain('User cancelled message');
    expect(contentArray).toContain('Next message');
  });

  test.skip('verifies chat state persistence', async ({ isolatedPage }) => {
    // 1. Setup standard mock
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const lastMessage = body.messages[body.messages.length - 1];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Response to: ${lastMessage.content}`,
            actions: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');

    // 2. Send initial message
    const msg1 = 'Message before close';
    await chatInput.fill(msg1);
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText(`Response to: ${msg1}`)).toBeVisible();

    // 3. Close the chat panel
    const closeButton = isolatedPage.locator('#pepe button');

    // Ensure we are in a state where close button is visible (desktop)
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      console.log('Close button not found, assuming mobile layout or already closed?');
    }

    // Verify chat is hidden/closed
    // We can check if the text area is visible.
    await expect(chatInput).not.toBeVisible();

    // 4. Reopen Chat
    // Using the ChatSwitcher toggle
    const chatToggle = isolatedPage.getByLabel('Toggle chat');
    await chatToggle.click();

    // 5. Verify conversation persisted
    await expect(chatInput).toBeVisible();
    await expect(isolatedPage.getByText(msg1, { exact: true })).toBeVisible();
    await expect(isolatedPage.getByText(`Response to: ${msg1}`)).toBeVisible();

    // 6. Navigation Persistence
    const msg2 = 'Message before navigation';
    await chatInput.fill(msg2);
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText(`Response to: ${msg2}`)).toBeVisible();

    // Navigate away (e.g. to a different widget that doesn't show chat by default)
    // We'll just change the URL parameters to simulate navigation to another widget in the app
    await isolatedPage.goto('/?widget=trade&chat=true');
    // wait for page to load
    await isolatedPage.waitForLoadState('networkidle');

    // UI should reload, chat might be closed by default if 'chat' param is missing in the new URL
    // Open chat again (either via URL or button)
    // Let's assume we want to simulate user opening it again
    // await chatToggle.click();

    // 7. Verify ALL messages persist
    await expect(isolatedPage.getByText(msg1, { exact: true })).toBeVisible();
    await expect(isolatedPage.getByText(`Response to: ${msg1}`)).toBeVisible();
    await expect(isolatedPage.getByText(msg2, { exact: true })).toBeVisible();
    await expect(isolatedPage.getByText(`Response to: ${msg2}`)).toBeVisible();
  });

  test('verifies chat state persistence on close/reopen', async ({ isolatedPage }) => {
    // 1. Setup standard mock
    await isolatedPage.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const lastMessage = body.messages[body.messages.length - 1];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Response to: ${lastMessage.content}`,
            actions: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await isolatedPage.waitForSelector('textarea[placeholder]');
    const chatInput = isolatedPage.locator('textarea');
    const chatToggle = isolatedPage.getByLabel('Toggle chat');

    // 2. Send initial message
    const msg1 = 'Message before close';
    await chatInput.fill(msg1);
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText(`Response to: ${msg1}`)).toBeVisible();

    // 3. Send a second message
    const msg2 = 'Second message';
    await chatInput.fill(msg2);
    await chatInput.press('Enter');
    await expect(isolatedPage.getByText(`Response to: ${msg2}`)).toBeVisible();

    // 4. Close the chat panel using the toggle
    await chatToggle.click();

    // Verify chat is hidden/closed
    await expect(chatInput).not.toBeVisible();

    // 5. Reopen Chat using the same toggle
    await chatToggle.click();

    // 6. Verify conversation persisted after close/reopen
    await expect(chatInput).toBeVisible();
    await expect(isolatedPage.getByText(msg1, { exact: true })).toBeVisible();
    await expect(isolatedPage.getByText(`Response to: ${msg1}`)).toBeVisible();
    await expect(isolatedPage.getByText(msg2, { exact: true })).toBeVisible();
    await expect(isolatedPage.getByText(`Response to: ${msg2}`)).toBeVisible();
  });
});
