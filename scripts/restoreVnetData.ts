//@ts-expect-error writeFile is already declared
const { writeFile } = require('fs/promises');

// Rebuilds tenderlyTestnetData.json from vnet IDs alone, looking each vnet's
// Admin RPC up with TENDERLY_API_KEY. Lets CI jobs hand each other IDs (job
// outputs) instead of an artifact holding the credential-bearing RPC URLs
// (APP-479).
//
// Usage: VNET_IDS='[{"NETWORK":"mainnet","TENDERLY_TESTNET_ID":"…"}]' node ./scripts/restoreVnetData.ts
const restoreVnetData = async () => {
  const entries = JSON.parse(process.env.VNET_IDS || '[]');
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('VNET_IDS must be a non-empty JSON array of { NETWORK, TENDERLY_TESTNET_ID }');
  }

  const data = await Promise.all(
    //@ts-expect-error TypeScript syntax is not supported when running this script
    entries.map(async ({ NETWORK, TENDERLY_TESTNET_ID }) => {
      const res = await fetch(
        `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/${TENDERLY_TESTNET_ID}`,
        { headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]] }
      );
      const vnet = res.ok ? await res.json() : null;
      const adminEndpoint = vnet?.rpcs?.find(x => x.name === 'Admin RPC');
      if (!adminEndpoint?.url) {
        throw new Error(
          `No Admin RPC for the ${NETWORK} virtual testnet ${TENDERLY_TESTNET_ID} (${res.status})`
        );
      }
      return { NETWORK, TENDERLY_TESTNET_ID, TENDERLY_RPC_URL: adminEndpoint.url };
    })
  );

  await writeFile('./tenderlyTestnetData.json', JSON.stringify(data));
  // Never log the URLs themselves.
  console.log(`Restored ${data.length} virtual testnet(s): ${data.map(d => d.NETWORK).join(', ')}`);
};

restoreVnetData().catch(error => {
  console.error('Restoring virtual testnet data failed:', error.message ?? error);
  process.exit(1);
});
