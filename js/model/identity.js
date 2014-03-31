/**
 * @fileOverview Identity properties and data.
 */


define(['./wallet', './txdb', './history', './tasks', './contacts', './connections', 'bitcoinjs-lib', 'sjcl'],
function(Wallet, TransactionDatabase, History, Tasks, Contacts, Connections, Bitcoin) {
/**
 * Identity class.
 * @param {Store} store Object store.
 * @param {String} seed Seed in string form.
 * @param {String} password Password for the identity crypt.
 * @constructor
 */
function Identity(store, seed, password) {
    this.name = store.get('name');
    this.settings = store.init('settings', {currency: 'BTC', fiatCurrency: 'EUR'});
    this.store = store;
    if (seed && password) {
        this.generate(seed, password);
    }
    this.wallet = new Wallet(store, this);
    this.txdb = new TransactionDatabase(store);
    this.history = new History(store, this);
    this.contacts = new Contacts(store);
    this.connections = new Connections(store, this);
    this.tasks = new Tasks(store, this);
}

Identity.prototype.changePassword = function(oldPassword, newPassword) {
    try {
        var data = this.store.getPrivateData(oldPassword);
        this.store.setPrivateData(data, newPassword)
        return true;
    } catch (e) {
        if (e.message !== "ccm: tag doesn't match") {
            throw e;
        }
        return false;
    }
}

/**
 * Generate master keys for this identity.
 * TODO: Consider naming private methods with trailing underscore_.
 * @param {String} seed Seed in hex form.
 * @param {String} password Password for the identity crypt.
 * @private
 */
Identity.prototype.generate = function(seed, password) {
    // Don't use constructor directly since it doesn't manage hex seed properly.
    var key = Bitcoin.HDWallet.fromSeedHex(seed);
    var identityKey = key.derive(0x80000000);

    var pubKey = identityKey.toBase58(false);
    var privKey = identityKey.toBase58(true);

    // TODO we probably don't want to save the seed later here, but let's do it
    // for now to make development easier.
    this.store.setPrivateData({privKey: privKey, seed: seed}, password);

    this.store.set('mpk', pubKey);
    this.store.set('version', 1);
    this.store.set('pubkeys', {});
    this.store.set('contacts', {});
    this.store.set('transactions', {});
    this.store.save();
}

return Identity;
});
