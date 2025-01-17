import { Name, PrivateKey, API, Checksum256 } from '@greymass/eosio';
import { KeyManager, KeyManagerLevel } from './keymanager';
import { IDContract, GetAccountTonomyIDInfoResponse } from './services/contracts/IDContract';
import { sha256 } from './util/crypto';
import { createKeyManagerSigner, createSigner } from './services/eosio/transaction';
import { getApi } from './services/eosio/eosio';
import { PersistantStorage } from './storage';

enum UserStatus {
    CREATING = 'CREATING',
    READY = 'READY',
    DEACTIVATED = 'DEACTIVATED'
};
type UserSorage = {
    status: UserStatus;
    accountName: Name;
    username: string;
    salt: Checksum256;
}

namespace UserStatus {
    /* 
     * Returns the index of the enum value
     * 
     * @param value The level to get the index of
     */
    export function indexFor(value: UserStatus): number {
        return Object.keys(UserStatus).indexOf(value);
    }

    /* 
     * Creates an AuthenticatorLevel from a string or index of the level
     * 
     * @param value The string or index
     */
    export function from(value: number | string): UserStatus {
        let index: number
        if (typeof value !== 'number') {
            index = UserStatus.indexFor(value as UserStatus)
        } else {
            index = value
        }
        return Object.values(UserStatus)[index] as UserStatus;
    }
}


const idContract = IDContract.Instance;
export class User {
    keyManager: KeyManager;
    storage: PersistantStorage & UserSorage;

    constructor(_keyManager: KeyManager, _storage: PersistantStorage) {
        this.keyManager = _keyManager;
        this.storage = _storage as PersistantStorage & UserSorage;
    }

    async savePassword(masterPassword: string, options?: { salt?: Checksum256 }) {
        let privateKey: PrivateKey
        let salt: Checksum256;
        if (options && options.salt) {
            salt = options.salt;
            const res = await this.keyManager.generatePrivateKeyFromPassword(masterPassword, salt);
            privateKey = res.privateKey;
        } else {
            const res = await this.keyManager.generatePrivateKeyFromPassword(masterPassword);
            privateKey = res.privateKey;
            salt = res.salt;
        }

        this.storage.salt = salt;

        await this.keyManager.storeKey({ level: KeyManagerLevel.PASSWORD, privateKey, challenge: masterPassword });
    }

    async savePIN(pin: string) {
        const privateKey = this.keyManager.generateRandomPrivateKey();
        await this.keyManager.storeKey({ level: KeyManagerLevel.PIN, privateKey, challenge: pin });
    }

    async saveFingerprint() {
        const privateKey = this.keyManager.generateRandomPrivateKey();
        await this.keyManager.storeKey({ level: KeyManagerLevel.FINGERPRINT, privateKey });
    }

    async saveLocal() {
        const privateKey = this.keyManager.generateRandomPrivateKey();
        await this.keyManager.storeKey({ level: KeyManagerLevel.LOCAL, privateKey });
    };

    async createPerson(username: string, password: string) {
        const { keyManager } = this;

        const usernameHash = sha256(username);

        // TODO check password is correct?
        const passwordKey = await keyManager.getKey({ level: KeyManagerLevel.PASSWORD });
        const pinKey = await keyManager.getKey({ level: KeyManagerLevel.PIN });
        const fingerprintKey = await keyManager.getKey({ level: KeyManagerLevel.FINGERPRINT });
        const localKey = await keyManager.getKey({ level: KeyManagerLevel.LOCAL });

        // TODO this needs to change to the actual key used, from settings
        const idTonomyActiveKey = PrivateKey.from("PVT_K1_2bfGi9rYsXQSXXTvJbDAPhHLQUojjaNLomdm3cEJ1XTzMqUt3V");

        // TODO need to remove sha256 from this.salt
        const salt = await this.storage.salt;
        const res = await idContract.newperson(usernameHash.toString(), passwordKey.toString(), salt.toString(), createSigner(idTonomyActiveKey));

        const newAccountAction = res.processed.action_traces[0].inline_traces[0].act;
        this.storage.accountName = Name.from(newAccountAction.data.name);
        this.storage.username = username;
        this.storage.status = UserStatus.CREATING;

        // TODO:
        // use status to lock the account till finished craeating

        const keys: any = {};
        if (pinKey) keys.PIN = pinKey.toString();
        if (fingerprintKey) keys.FINGERPRINT = fingerprintKey.toString();
        if (localKey) keys.LOCAL = localKey.toString();

        const signer = createKeyManagerSigner(keyManager, KeyManagerLevel.PASSWORD, password);
        const accountName = await this.storage.accountName;
        await idContract.updatekeys(accountName.toString(), keys, signer);
        this.storage.status = UserStatus.READY;
    }

    async login(username: string, password: string): Promise<GetAccountTonomyIDInfoResponse> {
        const { keyManager } = this;

        const idData = await idContract.getAccountTonomyIDInfo(username);
        const salt = idData.password_salt;

        await this.savePassword(password, { salt });
        const passwordKey = await keyManager.getKey({ level: KeyManagerLevel.PASSWORD });

        const accountData = await User.getAccountInfo(idData.account_name);
        const onchainKey = accountData.getPermission('owner').required_auth.keys[0].key; // TODO change to active/other permissions when we make the change

        if (!passwordKey.equals(onchainKey)) throw new Error("Password is incorrect");

        this.storage.accountName = Name.from(idData.account_name);
        this.storage.username = username;
        this.storage.status = UserStatus.READY;

        return idData;
    }

    async logout(): Promise<void> {
        // remove all keys
        await this.keyManager.removeKey({ level: KeyManagerLevel.PASSWORD });
        await this.keyManager.removeKey({ level: KeyManagerLevel.PIN });
        await this.keyManager.removeKey({ level: KeyManagerLevel.FINGERPRINT });
        await this.keyManager.removeKey({ level: KeyManagerLevel.LOCAL });
        // clear storage data
        this.storage.clear();
    }

    async isLoggedIn(): Promise<boolean> {
        console.log(await this.storage.status)
        return !! await this.storage.status
    }

    static async getAccountInfo(account: string | Name): Promise<API.v1.AccountObject> {
        const api = await getApi();
        if (typeof account === 'string') {
            // this is a username
            const idData = await idContract.getAccountTonomyIDInfo(account);
            return await api.v1.chain.get_account(idData.account_name);
        }
        // use the account name directly

        return await api.v1.chain.get_account(account);

    }
}