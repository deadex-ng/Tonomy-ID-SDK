/* eslint-disable camelcase */
import { PublicKey } from '@greymass/eosio';
import { ES256KSigner, createJWT, verifyJWT, JWTVerified } from 'did-jwt';
import { IDContract } from './services/contracts/IDContract';
import { KeyManager, KeyManagerLevel } from './services/keymanager';
import { createStorage, PersistentStorageClean, StorageFactory } from './services/storage';
import { generateRandomKeyPair, randomString } from './util/crypto';
import { User } from './user';
import { createKeyManagerSigner } from './services/eosio/transaction';
import { SdkErrors, throwError } from './services/errors';
import { createJWK, resolve, toDid } from './util/did-jwk';
import { getSettings } from './settings';
import { App, AppStatus } from './app';

const idContract = IDContract.Instance;

export type UserAppRecord = {
    app: App;
    added: Date;
    status: AppStatus;
};

export type UserAppStorage = {
    appRecords: UserAppRecord[];
};

// TODO change to use VC
export type JWTLoginPayload = {
    randomString: string;
    origin: string;
    publicKey: string;
    callbackPath?: string;
};

export type OnPressLoginOptions = {
    callbackPath: string;
    redirect?: boolean;
};

export class UserApps {
    user: User;
    keyManager: KeyManager;
    storage: UserAppStorage & PersistentStorageClean;

    constructor(_user: User, _keyManager: KeyManager, storageFactory: StorageFactory) {
        this.user = _user;
        this.keyManager = _keyManager;
        this.storage = createStorage<UserAppStorage>('tonomy.user.apps.', storageFactory);
    }

    async loginWithApp(app: App, key: PublicKey): Promise<void> {
        const myAccount = await this.user.storage.accountName;

        const appRecord: UserAppRecord = {
            app,
            added: new Date(),
            status: AppStatus.PENDING,
        };

        let apps = await this.storage.appRecords;
        if (!apps) {
            apps = [];
        }
        apps.push(appRecord);
        this.storage.appRecords = apps;
        await this.storage.appRecords;

        const signer = createKeyManagerSigner(this.keyManager, KeyManagerLevel.LOCAL);
        await idContract.loginwithapp(myAccount.toString(), app.accountName.toString(), 'local', key, signer);

        appRecord.status = AppStatus.READY;
        this.storage.appRecords = apps;
        await this.storage.appRecords;
    }

    static async onPressLogin({ redirect = true, callbackPath }: OnPressLoginOptions): Promise<string | void> {
        const { privateKey, publicKey } = generateRandomKeyPair();
        const payload: JWTLoginPayload = {
            randomString: randomString(32),
            origin: window.location.origin,
            publicKey: publicKey.toString(),
            callbackPath,
        };

        // TODO store the signer key in localStorage
        const signer = ES256KSigner(privateKey.data.array, true);

        const jwk = await createJWK(publicKey);

        const issuer = toDid(jwk);

        // TODO use expiresIn to make JWT expire after 5 minutes
        const token = await createJWT(payload, { issuer, signer, alg: 'ES256K-R' });

        const requests = [token];
        const requestsString = JSON.stringify(requests);

        if (redirect) {
            window.location.href = `${getSettings().ssoWebsiteOrigin}/login?requests=${requestsString}`;
            return;
        }
        return token;
    }

    static async verifyRequests(requests: string | null): Promise<JWTVerified[]> {
        if (!requests) throwError('No requests found in URL', SdkErrors.MissingParams);

        const jwtRequests = JSON.parse(requests);
        if (!jwtRequests || !Array.isArray(jwtRequests) || jwtRequests.length === 0) {
            throwError('No JWTs found in URL', SdkErrors.MissingParams);
        }

        const verified: JWTVerified[] = [];
        for (const jwt of jwtRequests) {
            console.log('verifying jwt', jwt);
            verified.push(await this.verifyLoginJWT(jwt));
        }
        return verified;
    }

    static async onRedirectLogin(): Promise<JWTVerified> {
        const urlParams = new URLSearchParams(window.location.search);
        const requests = urlParams.get('requests');

        const verifiedRequests = await this.verifyRequests(requests);

        const referrer = new URL(document.referrer);
        for (const request of verifiedRequests) {
            if (request.payload.origin === referrer.origin) {
                return request;
            }
        }
        throwError(
            `No origins from: ${verifiedRequests.map((r) => r.payload.origin)} match referrer: ${referrer.origin}`,
            SdkErrors.WrongOrigin
        );
    }

    static async verifyLoginJWT(jwt: string): Promise<JWTVerified> {
        const resolver: any = {
            resolve,
            // TODO add Antelope resolver as well
        };
        const res = await verifyJWT(jwt, { resolver });

        if (!res.verified) throwError('JWT failed verification', SdkErrors.JwtNotValid);
        return res;
    }
}