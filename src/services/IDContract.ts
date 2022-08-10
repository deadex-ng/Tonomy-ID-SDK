
// wrapper class that has js interface to call the smart contract
class IDContract {
    // calls the ID smart contract create() function to create the account
    create(accountName: string, passwordPublicKey: string, salt: string) {
        // creates the new account with the public key and account name,
        // and stores the salt on chain for later user to re-derive the private key with the password
    }
}

export { IDContract }