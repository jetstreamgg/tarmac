# @jetstreamgg/integration-ui

## Overview

`@jetstreamgg/integration-ui` is a testing application designed to showcase and evaluate the functionality of Jetstream widgets. It provides a simple UI environment for developers to interact with and test various widgets in isolation. This app is not intended for production use, but rather serves as a development and quality assurance tool for the Jetstream platform.

## Features

- **React Components**: Built with React for declarative UI development.
- **TypeScript**: Strongly typed for better developer experience and fewer runtime errors.
- **TailwindCSS**: Utility-first CSS framework for rapid UI development.
- **Lingui**: Internationalization support for multiple languages.
- **Vite**: Fast build tool and development server.

## Env vars

## Environment Variables

The following environment variables are used in this project:

- `VITE_PUBLIC_RPC_PROVIDER_MAINNET`: The RPC provider URL for the Ethereum mainnet. This should be set to your preferred Ethereum node provider.

- `VITE_PUBLIC_RPC_PROVIDER_TENDERLY`: The RPC provider URL for Tenderly's virtual Ethereum network. This is used for testing and development purposes.

- `VITE_PUBLIC_RPC_PROVIDER_SEPOLIA`: The RPC provider URL for the Sepolia testnet. This should be set to your preferred Sepolia node provider.

- `VITE_PUBLIC_RPC_PROVIDER_BASE`: The RPC provider URL for the Base network. This should be set to your preferred Base node provider.

- `VITE_PUBLIC_RPC_PROVIDER_ARBITRUM`: The RPC provider URL for the Arbitrum network. This should be set to your preferred Arbitrum node provider.

- `VITE_PUBLIC_RPC_PROVIDER_TENDERLY_BASE`: The RPC provider URL for Tenderly's virtual Base network. This is used for testing and development purposes.

- `VITE_PUBLIC_RPC_PROVIDER_TENDERLY_ARBITRUM`: The RPC provider URL for Tenderly's virtual Arbitrum network. This is used for testing and development purposes.

- `VITE_PUBLIC_RESTRICTED_BUILD`: Optional. When set, this variable enables restricted build features. It can be left empty if not needed.

- `VITE_WALLETCONNECT_PROJECT_ID`: Optional. The project ID for WalletConnect integration. If not provided, a default value will be used.

These environment variables should be set in a `.env` file in the root of the `apps/integration-ui` directory

## Development

To start the development server, run:

```sh
pnpm dev
```

To build the project, run:

```sh
pnpm build
```

To preview the production build, run:

```sh
pnpm preview
```

## Internationalization and Translation

This application supports i18n and translations via the Lingui package. To add content that can be translated, you need to follow three simple steps:

- Wrap the text in `<Trans>` tags, the `t` function or the `msg` function depending on the context.
- Run `pnpm extract` from the root of this repo to extract the messages into `.po` files, which can then be translated.
- Run `pnpm compile` to compile the translations into optimized JavaScript format.

For more information on the i18n process, refer to the [Internationalization and Translation Process](../../README.md#internationalization-and-translation-process) section in the root README and for more information on how Lingui works, refer to the [Lingui documentation](https://lingui.dev/).
