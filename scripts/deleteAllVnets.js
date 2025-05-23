// Load environment variables
require('dotenv').config();

const deleteAllVnets = async displayName => {
  if (!displayName || !displayName.length) {
    throw new Error('A display name is required for the virtual testnet');
  }

  const PAGE_SIZE = 100; // This is the maximum allowed by the API atm, greater values will be ignered and 10 will be used
  const MAX_PAGES = 10;
  let totalDeleted = 0;

  // Process page by page
  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`Fetching page ${page} of virtual networks...`);

    const res = await fetch(
      `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets?page=${page}&per_page=${PAGE_SIZE}&display_name=${displayName}`,
      {
        headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]],
        method: 'GET'
      }
    );

    const data = await res.json();
    console.log(`Found ${data.length} networks on page ${page}`);

    // If no more data, break the loop
    if (!data.length) {
      console.log(`No more virtual networks found. Stopping at page ${page}.`);
      break;
    }

    // Process each network in the current page
    const deletePromises = data.map(async vnet => {
      // Prevent deletion of other testnets and teams.
      // double check before deleting but the query should be specific enough as is
      const createdAt = new Date(vnet.created_at);
      const AGE = 45;
      const pastTime = new Date(Date.now() - AGE * 60000);
      const isOldEnough = createdAt.getTime() <= pastTime.getTime();

      if (vnet.display_name === displayName && isOldEnough) {
        console.log(`Deleting Virtual Testnet with ID ${vnet.id}`);

        const response = await fetch(
          `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/testnet/container/${vnet.id}`,
          {
            headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]],
            method: 'DELETE'
          }
        );

        if (response.status === 204) {
          console.log(
            `Virtual Testnet with ID ${vnet.id} and name ${vnet.display_name} successfully deleted`
          );
          totalDeleted++;
          return true;
        } else {
          console.log(`There was an error while deleting the virtual testnet with ID ${vnet.id}`);
          return false;
        }
      }
      return false;
    });

    // Wait for all delete operations to complete before moving to the next page
    await Promise.all(deletePromises);
  }

  console.log(`Deletion process completed. Total networks deleted: ${totalDeleted}`);
};

// Get the display name from command line arguments
const displayName = process.argv[2];
deleteAllVnets(displayName)
  .then(() => {
    console.log('Operation completed successfully');
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
