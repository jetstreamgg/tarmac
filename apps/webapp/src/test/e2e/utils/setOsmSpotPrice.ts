import { encodeFunctionData, stringToHex } from 'viem';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

export async function setOsmSpotPrice(
  ilkName: string,
  newPrice: bigint | string,
  network = NetworkName.mainnet
): Promise<void> {
  const rpcUrl = await getRpcUrlFromFile(network);
  const mcdSpotAddress = '0x65c79fcb50ca1594b025960e539ed7a9a6d434a3';

  // Admin address that has permissions (MCD Pause Proxy)
  const adminAddress = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB';

  // Convert ilk name to bytes32
  const ilkBytes32 = stringToHex(ilkName, { size: 32 });

  // Parse price (in RAY - 27 decimals)
  const priceValue = typeof newPrice === 'string' ? BigInt(newPrice) : newPrice;

  console.log(`Setting ${ilkName} OSM price to ${priceValue}`);

  // First, get the OSM (pip) address for this ilk
  const getIlkCalldata = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'ilks',
        inputs: [{ name: 'ilk', type: 'bytes32' }],
        outputs: [
          { name: 'pip', type: 'address' },
          { name: 'mat', type: 'uint256' }
        ],
        stateMutability: 'view'
      }
    ],
    functionName: 'ilks',
    args: [ilkBytes32]
  });

  const ilkResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_call',
      params: [
        {
          to: mcdSpotAddress,
          data: getIlkCalldata
        },
        'latest'
      ],
      id: 41,
      jsonrpc: '2.0'
    })
  });

  if (!ilkResponse.ok) {
    throw new Error(`Error getting ilk data: ${ilkResponse.statusText}`);
  }

  const ilkData = await ilkResponse.json();
  if (ilkData.error) {
    throw new Error(`RPC error getting ilk: ${JSON.stringify(ilkData.error)}`);
  }

  // Extract the OSM address (first 20 bytes after 12 bytes of padding)
  const osmAddress = '0x' + ilkData.result.slice(26, 66);
  console.log(`OSM address for ${ilkName}: ${osmAddress}`);

  const what = stringToHex('spot', { size: 32 });

  const mcdVatAddress = '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b';

  // Encode vat.file(ilk, "spot", value)
  const calldata = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'file',
        inputs: [
          { name: 'ilk', type: 'bytes32' },
          { name: 'what', type: 'bytes32' },
          { name: 'data', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }
    ],
    functionName: 'file',
    args: [ilkBytes32, what, priceValue]
  });

  // Send transaction from impersonated admin address
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_sendTransaction',
      params: [
        {
          from: adminAddress,
          to: mcdVatAddress,
          data: calldata,
          gas: '0x7A1200', // 8M gas
          gasPrice: '0x0',
          value: '0x0'
        }
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error setting spot price: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC error setting spot price: ${JSON.stringify(data.error)}`);
  }

  console.log(`Transaction hash: ${data.result}`);

  // Mine a block to confirm the transaction
  const mineResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'evm_mine',
      params: [],
      id: 43,
      jsonrpc: '2.0'
    })
  });

  if (!mineResponse.ok) {
    throw new Error(`Error mining block: ${mineResponse.statusText}`);
  }

  console.log(`✅ Successfully set ${ilkName} spot price to ${priceValue}`);
}

export async function getOsmSpotPrice(
  ilkName: string,
  network = NetworkName.mainnet
): Promise<{ spot: bigint; mat: bigint }> {
  const rpcUrl = await getRpcUrlFromFile(network);
  const mcdSpotAddress = '0x65c79fcb50ca1594b025960e539ed7a9a6d434a3';
  const mcdVatAddress = '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b';

  // Convert ilk name to bytes32
  const ilkBytes32 = stringToHex(ilkName, { size: 32 });

  // Get mat from MCD Spot contract
  const spotCalldata = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'ilks',
        inputs: [{ name: 'ilk', type: 'bytes32' }],
        outputs: [
          { name: 'pip', type: 'address' },
          { name: 'mat', type: 'uint256' }
        ],
        stateMutability: 'view'
      }
    ],
    functionName: 'ilks',
    args: [ilkBytes32]
  });

  const spotResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_call',
      params: [
        {
          to: mcdSpotAddress,
          data: spotCalldata
        },
        'latest'
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!spotResponse.ok) {
    throw new Error(`Error getting ilk data: ${spotResponse.statusText}`);
  }

  const spotData = await spotResponse.json();

  if (spotData.error) {
    throw new Error(`RPC error getting ilk data: ${JSON.stringify(spotData.error)}`);
  }

  // Decode mat from response
  const mat = BigInt('0x' + spotData.result.slice(66));

  // Get spot from MCD Vat contract (this is the actual spot value used in calculations)
  const vatCalldata = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'ilks',
        inputs: [{ name: 'ilk', type: 'bytes32' }],
        outputs: [
          { name: 'Art', type: 'uint256' },
          { name: 'rate', type: 'uint256' },
          { name: 'spot', type: 'uint256' },
          { name: 'line', type: 'uint256' },
          { name: 'dust', type: 'uint256' }
        ],
        stateMutability: 'view'
      }
    ],
    functionName: 'ilks',
    args: [ilkBytes32]
  });

  const vatResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_call',
      params: [
        {
          to: mcdVatAddress,
          data: vatCalldata
        },
        'latest'
      ],
      id: 43,
      jsonrpc: '2.0'
    })
  });

  if (!vatResponse.ok) {
    throw new Error(`Error getting vat ilk data: ${vatResponse.statusText}`);
  }

  const vatData = await vatResponse.json();

  if (vatData.error) {
    throw new Error(`RPC error getting vat ilk data: ${JSON.stringify(vatData.error)}`);
  }

  // The spot is the 3rd return value (index 2)
  // Response format: 0x + (Art 64 chars) + (rate 64 chars) + (spot 64 chars) + ...
  const spot = BigInt('0x' + vatData.result.slice(2 + 64 + 64, 2 + 64 + 64 + 64));

  return { spot, mat };
}

export async function triggerCappedOsmError(ilkName: string, network = NetworkName.mainnet): Promise<void> {
  // Get current spot price
  const { spot: currentSpot, mat } = await getOsmSpotPrice(ilkName, network);

  console.log(`Current spot price for ${ilkName}: ${currentSpot}`);
  console.log(`Liquidation ratio (mat): ${mat}`);

  // Set spot to a very low value (e.g., 10% of current)
  // This will cause delayedPrice to be very low, making it easy to hit the cap
  const newSpot = currentSpot / 10n;

  await setOsmSpotPrice(ilkName, newSpot, network);

  console.log('✅ Spot price reduced to trigger capped OSM error');
}

export async function restoreOsmSpotPrice(
  ilkName: string,
  spotPrice: bigint | string = 15000000000000000000000000000n, // ~$15 in RAY (27 decimals)
  network = NetworkName.mainnet
): Promise<void> {
  await setOsmSpotPrice(ilkName, spotPrice, network);
  console.log(`✅ Spot price restored for ${ilkName}`);
}
