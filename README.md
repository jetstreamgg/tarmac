# DISCLAIMER

THIS Tarmac SOFTWARE CODE REPOSITORY (“REPOSITORY”) IS MADE AVAILABLE TO YOU BY JETSTREAMGG (“DEVELOPER”). WHILE DEVELOPER GENERATED THE OPEN-SOURCE CODE WITHIN THIS REPOSITORY, DEVELOPER DOES NOT MAINTAIN OR OPERATE ANY SOFTWARE PROTOCOL, PLATFORM, PRODUCT OR SERVICE THAT INCORPORATES SUCH SOURCE CODE.

DEVELOPER MAY, FROM TIME TO TIME, GENERATE, MODIFY AND/OR UPDATE SOURCE CODE WITHIN THIS REPOSITORY BUT IS UNDER NO OBLIGATION TO DO SO. HOWEVER, DEVELOPER WILL NOT PERFORM REPOSITORY MANAGEMENT FUNCTIONS, SUCH AS REVIEWING THIRD-PARTY CONTRIBUTIONS, MANAGING COMMUNITY INTERACTIONS OR HANDLING NON-CODING ADMINISTRATIVE TASKS.

THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY IS OFFERED ON AN “AS-IS,” “AS-AVAILABLE” BASIS WITHOUT ANY REPRESENTATIONS, WARRANTIES OR GUARANTEES OF ANY KIND, EITHER EXPRESS OR IMPLIED. DEVELOPER DISCLAIMS ANY AND ALL LIABILITY FOR ANY ISSUES THAT ARISE FROM THE USE, MODIFICATION OR DISTRIBUTION OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY. PLEASE REVIEW, TEST AND AUDIT ANY SOURCE CODE PRIOR TO MAKING USE OF SUCH SOURCE CODE. BY ACCESSING OR USING ANY SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY, YOU UNDERSTAND, ACKNOWLEDGE AND AGREE TO THE RISKS OF USING THE SOURCE CODE AND THE LIMITED SCOPE OF DEVELOPER’S ROLE AS DESCRIBED HEREIN. YOU AGREE THAT YOU WILL NOT HOLD DEVELOPER LIABLE OR RESPONSIBLE FOR ANY LOSSES OR DAMAGES ARISING FROM YOUR USE OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY.

# Reservation of trademark rights

The materials in this repository may include references to our trademarks as well as trademarks owned by other persons. No rights are granted to you to use any trade names, trademarks, service marks, or product names, whether owned by us or by others, except solely as necessary for reasonable and customary use in describing the origin of the source materials. All trademark rights are expressly reserved by the respective owners.

# Tarmac

This project is a monorepo that utilizes https://pnpm.io/ to manage it’s dependencies. It allows to create “packages” that can be installed from another directory (locally) and allows to better code segmentation.

The project structure is divided in:

- apps: Utilizes packages, has custom made logic or it shouldn’t be published to a package manager
- packages: Small units of code that can be reused by several applications, it could be published to a package manager like NPM.

## Apps

This project contains the following apps, located under the ["apps" folder](./apps):

- [webapp](./apps/webapp): Web3 dApp that interacts with widgets from the [widgets](./packages/widgets/README.md) package

## Packages

This project contains the following packages, located under the ["packages" folder](./packages):

- [hooks](./packages/hooks/README.md): React hooks to interact with the Maker protocol. Also contains relevant contract addresses.

- [widgets](./packages/widgets/README.md): A package containing importable widgets allowing interaction with the protocol (Trade, Rewards, Savings, Upgrade, etc).

- [utils](./packages/utils/README.md): Common helpers for getting links, chain info, math operations for vault management, etc.

## Usage

#### Commands

Please refer to [Installing Node.js and pnpm](#installing-nodejs-and-pnpm) to install the required dependencies first.

```
pnpm install -> Installs all packages
pnpm build -> Builds all packages
pnpm dev -> Runs dev mode and launches the webapp in the port 3000
pnpm test -> Runs the unit tests suite across the different packages
pnpm test:hooks -> Manages the lifecycle of forking a new Tenderly testnet, running the 'hooks' tests, and then deleting the forked testnet.
```

#### Environment Variables for Testing

To run tests, especially those involving Tenderly, you need to set up the following environment variable:

- `TENDERLY_API_KEY`: Your Tenderly API key. This is required for forking and managing Tenderly testnets during test execution.

Make sure to add this to your `.env` file in the root directory of the project. You can refer to the `.env.example` file for the correct format.

Note: Never commit your actual API key to version control. Always keep it secure and use environment variables or secure secret management systems in production environments.

#### Global dependencies

This repository uses [pnpm workspaces](https://pnpm.io/workspaces) to manage multiple projects. You need to install **Node.js v18 or higher** and **pnpm v8 or higher**.

#### Node.js and pnpm

You can run the following commands in your terminal to check your local Node.js and npm versions:

```bash
node -v
pnpm -v
```

If the versions are not correct or you don't have Node.js or pnpm installed, download and follow their setup instructions:

- Install Node.js using [fnm](https://github.com/Schniz/fnm) or from the [official website](https://nodejs.org)
- Install [pnpm](https://pnpm.io/installation)

### Contributions and releases

This monorepo uses `changesets` to manage the versioning and changelog of the Jetstream packages. Changesets follows Semantic Versioning, you can read more about it [here](https://semver.org/)

#### For contributors:

- Use `pnpm changeset` and follow the prompts when making changes to the packages in order to document them.

#### For maintainers:

- Use `pnpm changeset version` to update the versions of all packages listed in the changesets since the last release was made, along with the dependencies that are out of range. This will also append the summary to a `CHANGELOG` file in each package.
- Use `pnpm changeset publish` to publish the packages to NPM and create the corresponding git tags.
  - It is recommended to make sure that changes made from the `changeset version` command are merged into the main branch before running the `changeset publish` command
  - No changes should be committed between calling `version` and `publish` since this command assumes that last commit is the release commit.

## Internationalization and Translation Process

In this project, we're utilizing `lingui` library for handling the internationalization (i18n) of the widgets package and the webapp. The following steps provide an overview of the i18n process:

The three commands we use for managing messages are listed in the `scripts` section of your `package.json` file:

`"messages:extract": "lingui extract --clean"`
`"messages:compile": "lingui compile"`
`"messages": "pnpm messages:extract && pnpm messages:compile"`

Here's what each script does:

- `messages:extract`: This command extracts all messages from your source code into a `messages.po` file located in the [utils package](./packages/utils/src/locales/). The `--clean` option is used to remove obsolete messages from the file.

- `messages:compile`: After translation, this command compiles the messages into an optimized JavaScript format which can be imported in the projects.

- `messages`: This is a convenience script that first extracts and then compiles the messages. It's typically run before building your application.

#### Usage

You can run these scripts using the `pnpm` package manager. Here are the commands you would use:

##### To extract messages from your source code

`pnpm messages:extract`

This command will go through your code looking for `<Trans>`, `t`and `msg` ligui macros and extract them into a `.po` file.

##### To compile your translated messages

`pnpm messages:compile`

Once you have the .po files you will need to compile them which will create a `.ts`and `.d.ts` file for each language.

##### To extract and then compile your messages in a single command:

`pnpm messages`

Please ensure that all your translations are done in the corresponding `.po` files before compiling them. For more information about translating messages with `lingui`, see the official [documentation](https://lingui.dev/tutorials/react).
