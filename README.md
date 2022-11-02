# Tonomy ID SDK

This Software Development Kit is used in Tonomy ID to interact and call with the EOSIO blockchain and services. It is also used as the public API for integration by applications to do single sign-on, share credentials and sign transactions.

The SDK is written in typescript with jest to run tests.

SDK library exists in `/src`

## Dependancies

- Linux debian distribution (Ubuntu 20.0.4 LTS used)
- [Nodejs](https://nodejs.org) v16.4.1+ suggested installed with [nvm](https://github.com/nvm-sh/nvm)

## Run

```bash
npm start
```

This builds to `/dist` and runs the project in watch mode so any edits you save inside `src` causes a rebuild to `/dist`.

To do a one-off build, use `npm run build`.

## Tests

To run tests, use `npm test`.

## Linting

Linting is done with `eslint`. Install the recommended VS Code plugin to see markers in your code.

```bash
npm run lint
```

## Error handling

See [errors.ts](./src/services/errors.ts). All errors have a registered unique code. All errors are either expected or unexpected, depending on weather the user will create the error, or somethig has gone wrong nothing to do with the user. This helps us distinguish errors that we should fix as developers. Please maintain the list of files and their error code numeration in [errors.ts](./src/services/errors.ts).
