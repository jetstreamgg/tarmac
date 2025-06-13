# Sky Ecosystem - Utils

## Installation

```
npm install @jetstreamgg/sky-utils
```

## Documentation

```ts
import { getEtherscanLink } from '@jetstreamgg/sky-utils';

const link = getEtherscanLink(chainId, contractAddress, 'address');
```

### I18n

Some functions in the package support internationalization, like the number formatting functions. To make use of this feature, you can pass the locale string to the functions like so:

```ts
let amountToFormat: BigInt;
const locale = 'fr-FR';

const formattedAmount = formatBigInt(amountToFormat, { locale });
```

Or you can use the `setLocaleInLocaleStorage(locale)` function in this package to store a locale string in the LocalStorage, the other functions would then look for the locale in the LocalStorage, defaulting to `en-US` if none is found.
