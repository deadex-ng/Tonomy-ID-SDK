/* eslint-disable camelcase */
import { Name, PublicKey } from '@greymass/eosio';
import { ES256KSigner, createJWT } from 'did-jwt';
import { IDContract } from './services/contracts/IDContract';
import { KeyManager, KeyManagerLevel } from './services/keymanager';
import { PersistentStorage } from './services/storage';
import { generateRandomKeyPair, randomString } from './util/crypto';
import { UserStorage } from './user';
import { createKeyManagerSigner } from './services/eosio/transaction';
import { createJWK, toDid } from './util/did-jwk';

const idContract = IDContract.Instance;

enum AppStatus {
    PENDING = 'PENDING',
    CREATING = 'CREATING',
    READY = 'READY',
    DEACTIVATED = 'DEACTIVATED',
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace AppStatus {
    /*
     * Returns the index of the enum value
     *
     * @param value The level to get the index of
     */
    export function indexFor(value: AppStatus): number {
        return Object.keys(AppStatus).indexOf(value);
    }

    /*
     * Creates an AppStatus from a string or index of the level
     *
     * @param value The string or index
     */
    export function from(value: number | string): AppStatus {
        let index: number;
        if (typeof value !== 'number') {
            index = AppStatus.indexFor(value as AppStatus);
        } else {
            index = value;
        }
        return Object.values(AppStatus)[index] as AppStatus;
    }
}

export { AppStatus };

type AppRecord = {
    account: string;
    added: Date;
    status: AppStatus;
};

type UserAppStorage = {
    apps: AppRecord[];
};

export default class App {
    keyManager: KeyManager;
    storage: PersistentStorage & UserStorage & UserAppStorage;

    constructor(_keyManager: KeyManager, _storage: PersistentStorage) {
        this.keyManager = _keyManager;
        this.storage = _storage as PersistentStorage & UserStorage & UserAppStorage;
    }

    async loginWithApp(account: Name, key: PublicKey, password: string): Promise<void> {
        const myAccount = await this.storage.accountName;

        const appRecord: AppRecord = {
            account: account.toString(),
            added: new Date(),
            status: AppStatus.PENDING,
        };

        let apps = await this.storage.apps;
        if (!apps) {
            apps = [];
        }
        apps.push(appRecord);
        this.storage.apps = apps;
        await this.storage.apps;

        const signer = createKeyManagerSigner(this.keyManager, KeyManagerLevel.PASSWORD, password);
        await idContract.loginwithapp(myAccount.toString(), account.toString(), key, signer);

        appRecord.status = AppStatus.READY;
        this.storage.apps = apps;
        await this.storage.apps;
    }

    static async onPressLogin(window: Window, redirect = false): Promise<string | void> {
        const { privateKey, publicKey } = generateRandomKeyPair();
        const payload = {
            number: randomString(32),
            origin: window.location.hostname,
            pubkey: publicKey.toString(),
        };

        const signer = ES256KSigner(privateKey.data.array, true);

        const jwk = await createJWK(publicKey);

        const issuer = toDid(jwk);

        const token = await createJWT(payload, { issuer, signer, alg: 'ES256K-R' });
        if (redirect) {
            // const settings = await getSettings();
            // TODO update settings to redirect to the tonomy id website
            window.location.href = `https://id.tonomy.com/login?jwt=${token}`;
            return;
        }
        return token;
    }
}

export { App };