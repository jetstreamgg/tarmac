const { readFile } = require('fs/promises');

// Deletes the vnets listed in a data file: tenderlyTestnetData.json by
// default, or the file given as the first argument (CI passes
// tenderlyCreatedVnets.json, the vnets its own fork step created).
const deleteVnets = async (dataFile = './tenderlyTestnetData.json') => {
  let file;
  try {
    file = await readFile(dataFile, 'utf-8');
  } catch {
    // Nothing was forked (or the fork step cleaned up after itself).
    console.log(`No ${dataFile}, nothing to delete`);
    return;
  }
  const testnetsData = JSON.parse(file);

  const responses = await Promise.all(
    //@ts-expect-error TypeScript syntax is not supported when running this script
    testnetsData.map(({ TENDERLY_TESTNET_ID }) =>
      fetch(
        `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/testnet/container/${TENDERLY_TESTNET_ID}`,
        {
          headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]],
          method: 'DELETE'
        }
      )
    )
  );

  if (responses.every(res => res.status === 204)) {
    console.log('Virtual Testnet successfully deleted');
  } else {
    console.log('There was an error while deleting the virtual testnet');
  }
};

deleteVnets(process.argv[2]);
