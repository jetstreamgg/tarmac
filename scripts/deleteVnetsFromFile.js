require('dotenv').config();
const { readFile } = require('fs/promises');

async function deleteVnetsFromFile(filePath) {
  if (!filePath) {
    throw new Error('A tenderlyTestnetData.json file path is required');
  }

  if (!process.env.TENDERLY_API_KEY) {
    throw new Error('TENDERLY_API_KEY is required');
  }

  const fileContents = await readFile(filePath, 'utf-8');
  const vnetData = JSON.parse(fileContents);

  if (!Array.isArray(vnetData)) {
    throw new Error('Expected the VNet data file to contain an array');
  }

  const vnetIds = [...new Set(vnetData.map(vnet => vnet.TENDERLY_TESTNET_ID).filter(Boolean))];

  if (!vnetIds.length) {
    console.log('No VNet IDs found in file, nothing to delete');
    return;
  }

  let deletedCount = 0;

  for (const vnetId of vnetIds) {
    console.log(`Deleting VNet ${vnetId}...`);

    const response = await fetch(
      `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/testnet/container/${vnetId}`,
      {
        headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]],
        method: 'DELETE'
      }
    );

    if (response.status === 204) {
      deletedCount++;
      console.log(`Deleted VNet ${vnetId}`);
      continue;
    }

    const errorText = await response.text();
    console.warn(`Failed to delete VNet ${vnetId}: ${response.status} ${response.statusText} ${errorText}`);
  }

  console.log(`Deletion process completed. Total networks deleted: ${deletedCount}/${vnetIds.length}`);
}

const filePath = process.argv[2];
deleteVnetsFromFile(filePath)
  .then(() => {
    console.log('Operation completed successfully');
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
