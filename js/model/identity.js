/*
 * @fileOverview Identity properties and data.
 */

/**
 * Identity class.
 * @param {Object} store Object store
 * @param {String} seed Seed in string form
 * @param {String} password Password for the identity crypt
 * @constructor
 */
function Identity(store, seed, password) {
    this.name = store.get('name');
    this.store = store;
    if (seed && password) {
        this.generate(seed, password);
    }
    this.wallet = new Wallet(store);
    this.contacts = new Contacts(store);
}

/**
 * Encrypt identity private information
 * @param {Object} data Contact information.
 * @param {String} password Password for the identity crypt
 */
Identity.prototype.encrypt = function(data, password) {
    var Crypto = Bitcoin.Crypto;
    var passwordDigest = Crypto.SHA256(Crypto.SHA256(Crypto.SHA256( password )));
    return sjcl.encrypt(passwordDigest, JSON.stringify(data));
}

/**
 * @private
 * Generate master keys for this identity.
 * @param {String} seed Seed in string form
 * @param {String} password Password for the identity crypt
 */
Identity.prototype.generate = function(seed, password) {
    // dont use constructor directly since it doesn't manage hex seed properly
    var rawSeed = Bitcoin.convert.hexToBytes(seed);
    var key = Bitcoin.BIP32key.prototype.fromMasterKey(rawSeed);

    var pubKey = key.getPub().serialize();
    var privKey = key.serialize();

    var privData = this.encrypt({privKey: privKey}, password);

    this.store.set('mpk', pubKey);
    this.store.set('version', 1);
    this.store.set('pubkeys', {});
    this.store.set('private', privData);
    this.store.set('contacts', {});
    this.store.set('transactions', {});
    this.store.save()
}
