import * as jose from 'jose';
import { PublicKey as PublicKeyCon } from 'eosjs/dist/eosjs-key-conversions';
import { PublicKey } from '@greymass/eosio';

const createJWK = (publicKey: PublicKey) => {
    const pubKey = PublicKeyCon.fromString(publicKey.toString());
    const ecPubKey = pubKey.toElliptic();

    if (!pubKey.isValid()) throw new Error('Key is not valid');
    const publicKeyJwk = {
        crv: 'secp256k1',
        kty: 'EC',
        x: bnToBase64Url(ecPubKey.getPublic().getX()),
        y: bnToBase64Url(ecPubKey.getPublic().getY()),
        kid: pubKey.toString(),
    };
    return publicKeyJwk;
};
// reference https://github.com/OR13/did-jwk/blob/main/src/index.js#L120
const toDid = (jwk: jose.JWK) => {
    // eslint-disable-next-line no-unused-vars
    const { d, p, q, dp, dq, qi, ...publicKeyJwk } = jwk;
    // TODO replace with base64url encoder for web
    const id = jose.base64url.encode(JSON.stringify(publicKeyJwk));
    const did = `did:jwk:${id}`;
    return did;
};

// reference https://github.com/OR13/did-jwk/blob/main/src/index.js#L128
const toDidDocument = (jwk: jose.JWK) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getPublicOperationsFromPrivate = (keyOps: any) => {
        if (keyOps.includes('sign')) {
            return ['verify'];
        }
        if (keyOps.includes('verify')) {
            return ['encrypt'];
        }
        return keyOps;
    };
    const {
        // eslint-disable-next-line no-unused-vars
        d,
        p,
        q,
        dp,
        dq,
        qi,

        key_ops,

        ...publicKeyJwk
    } = jwk;

    if (d && key_ops) {
        publicKeyJwk.key_ops = getPublicOperationsFromPrivate(key_ops);
    }

    const did = toDid(publicKeyJwk);
    const vm = {
        id: '#0',
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk,
    };
    const didDocument = {
        '@context': ['https://www.w3.org/ns/did/v1', { '@vocab': 'https://www.iana.org/assignments/jose#' }],
        id: did,
        verificationMethod: [vm],
    };

    return didDocument;
};

// reference https://github.com/OR13/did-jwk/blob/main/src/index.js#L177
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolve = (did: any, options = {}) => {
    if (options) options = {};
    const decoded = jose.base64url.decode(did.split(':').pop().split('#')[0]);
    const jwk = JSON.parse(decoded.toString());
    return toDidDocument(jwk);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bnToBase64Url(bn: any): string {
    const buffer = bn.toArrayLike(Buffer, 'be');
    // TODO replace with base64url encoder for web
    return Buffer.from(buffer).toString('base64');
}

export { createJWK, toDid, toDidDocument, resolve };
