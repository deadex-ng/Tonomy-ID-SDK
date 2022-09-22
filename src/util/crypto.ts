import { Bytes, Checksum256 } from '@greymass/eosio';
import rb from "@consento/sync-randombytes";

function randomBytes(bytes: number): Uint8Array {

    return rb(new Uint8Array(bytes));
}
function randomString(bytes: number): string {
    return randomBytes(bytes).toString();
}

function sha256(digest: string): string {
    return Checksum256.hash(Bytes.from(digest, "utf8")).toString();
}

export { randomString, randomBytes, sha256 };