/*
 * Wallet
 *
 * Access to the identity bitcoin keys
 */
function Wallet(store) {
    this.is_cold = store.get('is_cold');
    this.pubKeys = store.get('pubKeys');
    this.store = store;
}

Wallet.prototype.getAddress = function(n, is_change) {
    var addrId = (is_change, n);
    if (this.pubKeys[addrId]) {
        return this.pubKeys[addrId];
    }
    else {
        // derive from mpk
        var mpk = this.store.mpk;
        var mpKey = new Bitcoin.BIP32key(mpk);

        // BIP32 js support is still missing some part and we can't get addresses
        // from pubkey yet, unless we do it custom like here...:
        // (mpKey.key.getBitcoinAddress doesn't work since 'key' is not a key
        // object but binary representation).
        var childKey = mpKey.ckd(is_change).ckd(n);
        var mpKeyHash = Bitcoin.Util.sha256ripe160(childKey.key);
        var address = new Bitcoin.Address(mpKeyHash);

        this.pubKeys[addrId] = address.toString();
        this.store.save();
    }
}

