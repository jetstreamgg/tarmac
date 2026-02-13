# Feature Walkthrough: USDC to Savings

> This document walks through the experience of a user who holds USDC and wants to deposit into the Sky Savings Rate. It follows the app's **linked action** flow, which chains a Trade (USDC → USDS) into a Savings deposit across two guided steps.

---

## Starting State

The user holds USDC in their wallet. They have not yet connected to the app.

---

## Step 1: Landing Page (Not Connected)

The user arrives at the app and sees three main areas:

- **Left sidebar** (desktop) or **hamburger menu** (mobile/tablet): Module navigation listing Balances, Rewards, Savings, Upgrade, Trade, Stake & Borrow, and Expert. Each module shows a name and short description on hover — for example, Savings reads *"Use USDS to access the Sky Savings Rate"*.

- **Center widget area**: A **ConnectCard** — a gradient card with a description of the currently visible module. If the user lands on Savings, the card is titled *"About the Sky Savings Rate"* and describes how supplying USDS earns yield. A **"Connect wallet"** button sits at the bottom of the card.

- **Header**: A **"Connect Wallet"** button in the top-right corner.

The user clicks either connect button to proceed.

---

## Step 2: Wallet Connection

A **RainbowKit modal** appears presenting wallet options:

- MetaMask
- Coinbase Wallet
- WalletConnect
- Safe
- Binance Wallet
- Base Account

The user selects their wallet. The wallet's own UI prompts them to approve the connection. Once approved, the modal closes.

---

## Step 3: Terms Acceptance (First Visit Only)

If this is the user's first time connecting, a **Legal Terms** modal appears immediately after wallet connection.

The modal contains:

1. A scrollable terms document. The user must scroll to the bottom before they can proceed — the checkbox below is disabled until they do. A note reads: *"Please scroll to the bottom and read the entire terms and conditions; the checkbox will become enabled afterward."*

2. A **checkbox** that becomes enabled once the user has scrolled to the bottom. Checking it triggers a **wallet signature request** — the user signs a message in their wallet to confirm acceptance. This is not a transaction and costs no gas.

3. Two buttons:
   - **"Reject"** — declines the terms and disconnects the wallet.
   - The primary button progresses through states: *"Scroll down ↓"* → *"Check to continue"* → *"Signing..."* → *"Agree and Sign"*.

After signing, the modal closes and the user is fully authenticated. On subsequent visits with the same wallet, this step is skipped entirely.

---

## Step 4: Suggested Actions

Once connected, the app detects the user's token balances and displays **suggested action cards** in the widget area. These are contextual recommendations based on what the user holds.

Because the user holds USDC, one of the cards displayed is the **Trade → Savings** linked action card. It reads:

> **Trade your [amount] USDC to USDS to get the Sky Savings Rate**

The card shows:

- The user's actual USDC balance
- The current Sky Savings Rate (APY percentage)
- A CTA button to begin the flow

The app shows up to two suggested action cards at a time, ranked by relevance. The Trade → Savings card competes with other suggestions like Trade → Rewards depending on what modules and reward contracts are available.

The user clicks the CTA button on the Trade → Savings card.

---

## Step 5: Trade Widget — USDC to USDS (Linked Action Step 1 of 2)

Clicking the CTA opens the **Trade widget** with a **linked action step indicator** displayed above it. The indicator shows two arrow-shaped steps:

```
[ Trade Tokens ]  →  [ Access Savings ]
    (active)            (upcoming)
```

The first step is highlighted; the second is dimmed.

The Trade widget itself shows:

- **Source token**: USDC (locked — the user cannot change this during the linked action)
- **Target token**: USDS (locked)
- **Amount input**: Pre-filled from the suggested action card, or editable
- **Exchange rate**: Displayed below the input (near 1:1 for this stablecoin pair)

The user enters or confirms their amount and taps **"Review"**. This opens a transaction overview screen.

> **Note**: If the user manually changes the source or target token, the linked action exits and they return to a standard trade flow.

---

## Step 6: Trade — Approval and Execution

### If approval is needed (first time using USDC with this contract):

A **transaction status indicator** appears showing two sub-steps:

```
Step 1: Approve  →  Step 2: Trade
```

The user is prompted to confirm an approval transaction in their wallet. The footer reads: *"Confirm this transaction in your wallet."* Once the approval confirms on-chain, the flow automatically advances to the trade itself.

### Trade execution:

The user confirms the trade transaction in their wallet. On **Mainnet**, the trade routes through CowSwap for MEV protection, which may involve a short wait for batch settlement. On **L2 networks**, execution is near-instant via direct swap.

Once the trade confirms, the transaction status shows a **success state** with:

- A checkmark icon
- The trade details (amount in, amount out)
- Execution price
- A *"View on [Explorer]"* link to the block explorer

A prominent button appears: **"Go to Savings"**

The step indicator above the widget updates — the first step now shows a checkmark:

```
[ ✓ Trade Tokens ]  →  [ Access Savings ]
                           (active)
```

The user clicks **"Go to Savings"**.

---

## Step 7: Savings Widget — Supply USDS (Linked Action Step 2 of 2)

The app navigates to the **Savings widget** with the **Supply** tab active. The step indicator remains visible, now showing the second step as active.

The widget displays:

- A tab bar with **"Supply"** and **"Withdraw"** — Supply is selected
- A prompt: *"How much USDS would you like to supply?"*
- An amount input with the placeholder *"Enter amount"* — **pre-filled** with the USDS amount received from the trade
- The user's current USDS wallet balance

The user confirms the amount and taps **"Review"**. A **transaction overview** screen appears showing:

| | |
|---|---|
| **You will supply** | [amount] USDS |
| **You will receive** | [amount] sUSDS |
| **Rate** | 1 USDS = [rate] sUSDS |
| **Your wallet USDS balance** | [balance] → [new balance] |
| **Your Savings USDS balance** | [balance] → [new balance] |

---

## Step 8: Savings — Approval and Execution

The same two-step transaction pattern as the trade:

1. **Approve** (if needed): The user approves USDS spending for the savings contract.
2. **Confirm supply**: The user confirms the deposit transaction.

The button label reads **"Confirm supply"** (or **"Confirm 2 transactions"** if approval is also required).

The user confirms in their wallet. Once the transaction settles, the success screen appears with:

- A checkmark icon
- Deposit confirmation details
- A *"View on [Explorer]"* link
- A **"Back to Savings"** button

---

## Step 9: Savings Position

The user clicks **"Back to Savings"** and lands on the Savings module in its standard (non-linked-action) view. The step indicator is no longer displayed — the linked action flow is complete.

The **Savings details pane** (shown alongside the widget on desktop, or accessible via a details toggle on mobile) displays:

- Current USDS balance held in savings
- Accrued interest, updating over time
- The current Sky Savings Rate
- Transaction history

The user is now earning the Sky Savings Rate on their deposited USDS.

---

## Flow Summary

| Step | Module | User Action | Transactions |
|---|---|---|---|
| 1 | Landing | Views app | — |
| 2 | Auth | Connects wallet | — |
| 3 | Auth | Accepts terms (first visit) | 1 signature (no gas) |
| 4 | Suggested Actions | Clicks Trade → Savings CTA | — |
| 5–6 | Trade | Swaps USDC for USDS | 1–2 (approve + swap) |
| 7–8 | Savings | Deposits USDS | 1–2 (approve + supply) |
| 9 | Savings | Views position | — |

**Total on-chain transactions**: 2–4 (depending on whether token approvals are needed)

---

## Network Variations

| Network | Trade Mechanism | Notable Difference |
|---|---|---|
| **Ethereum Mainnet** | CowSwap (batched, MEV-protected) | Slightly delayed settlement; higher gas costs |
| **Base, Arbitrum** | Direct swap | Near-instant; lower gas costs |
| **Optimism, Unichain** | Direct swap | Near-instant; limited token pairs |

On **L2 networks**, the Savings module accepts USDC directly — meaning the Trade step can be skipped entirely. The Savings module description on L2 reflects this: *"Use USDS or USDC to access the Sky Savings Rate"*.

---

## Key URLs

The linked action flow is encoded in URL parameters. The full URL for this journey looks like:

```
/?widget=trade&source_token=USDC&target_token=USDS&linked_action=savings
```

After the trade completes and the user transitions to Savings:

```
/?widget=savings&flow=supply&input_amount=[amount]&source_token=USDS
```
