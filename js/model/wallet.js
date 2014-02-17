/*
 * @fileOverview Access to the identity bitcoin keys
 */

/**
 * Wallet class.
 * @param {Object} store Store for the object.
 * @constructor
 */
function Wallet(store) {
    this.is_cold = store.get('is_cold');
    this.pubKeys = store.init('pubkeys', {});
    this.pockets = store.init('pockets', ['default', 'change']);
    this.mpk = store.get('mpk');
    if (!this.mpk) {
         console.log("Wallet without mpk!", this.mpk);
    }
    // internal bitcoinjs-lib wallet to keep track of utxo (for now)
    this.wallet = new Bitcoin.Wallet(this.mpk);
    this.store = store;
    this.loadPubKeys();
}

/**
 * Get balance for a specific pocket or all pockets
 * @param {String or undefined} pocket Pocket number or all pockets if undefined
 */
Wallet.prototype.getBalance = function(pocket) {
    var balance = 0;
    var allAddresses = [];
    var keys = Object.keys(this.pubKeys);
    if (pocket === undefined) {
        for(var idx=0; idx<keys.length; idx++) {
            allAddresses.push(this.pubKeys[keys[idx]]);
        }
    } else {
       var pocketIndex = this.pockets.indexOf(pocket);
        for(var idx=0; idx<keys.length; idx++) {
            var walletAddress = this.pubKeys[keys[idx]];
            if (walletAddress.index[0] == pocketIndex) {
                allAddresses.push(walletAddress);
           }
        }
    }
    allAddresses.forEach(function(walletAddress) {
        balance += walletAddress.balance;
    });
    return balance;
}

/**
 * Create pocket with the given name
 * @param {String} name Name for the new pocket
 */
Wallet.prototype.createPocket = function(name) {
    if (this.pockets.indexOf(name) == -1) {
        this.pockets.push(name);
        this.store.save();
    }
}

/**
 * Load wallet addresses into internal Bitcoin.Wallet
 * @private
 */
Wallet.prototype.loadPubKeys = function() {
    var self = this;
    Object.keys(this.pubKeys).forEach(function(index) {
        self.wallet.addresses.push(self.pubKeys[index].address);
    });
}

/**
 * Get the private key for the given address index
 * @param {Array} seq Array for the bip32 sequence to retrieve address for
 * @param {Function} callback A callback where the private key will be provided.
 */
Wallet.prototype.getPrivateKey = function(seq, password, callback) {
    // clone seq since we're mangling it
    var workSeq = seq.slice(0);
    var SHA256 = Bitcoin.Crypto.SHA256;
    var passwordDigest = SHA256(SHA256(SHA256( password )));
    var data = JSON.parse(sjcl.decrypt(passwordDigest, this.store.get('private')));
    var key = new Bitcoin.BIP32key(data.privKey);
    while(workSeq.length) {
        key = key.ckd(workSeq.shift());
    }
    callback(key);
}

/**
 * Get an address from this wallet.
 * @param {Array} seq Array for the bip32 sequence to retrieve address for
 */
Wallet.prototype.getAddress = function(seq) {
    if (this.pubKeys[seq]) {
        return this.pubKeys[seq];
    }
    else {
        // derive from mpk
        var mpKey = new Bitcoin.BIP32key(this.mpk);

        var workSeq = seq.slice(0);
        var childKey = mpKey;
        while(workSeq.length) {
            childKey = childKey.ckd(workSeq.shift());
        }
        // BIP32 js support is still missing some part and we can't get addresses
        // from pubkey yet, unless we do it custom like here...:
        // (mpKey.key.getBitcoinAddress doesn't work since 'key' is not a key
        // object but binary representation).
        var mpPubKey;
        if (childKey.key.length) {
            mpPubKey = childKey.key;
        } else {
            mpPubKey = childKey.key.getPub();
        }
        var mpKeyHash = Bitcoin.Util.sha256ripe160(mpPubKey);
        var address = new Bitcoin.Address(mpKeyHash);

        var stealth = Stealth.getStealthAddress(mpPubKey);

        this.pubKeys[seq] = {
           'index': seq,
           'label': 'unused',
           'balance': 0,
           'nOutputs': 0,
           'pubKey': mpPubKey,
           'stealth': Bitcoin.base58.checkEncode(stealth).slice(1),
           'address': address.toString()
        };
        this.store.save();
        // add to internal bitcoinjs-lib wallet
        this.wallet.addresses.push(address.toString());
        return this.pubKeys[seq];
    }
}

/**
 * Get the wallet address structure for an address.
 * The structure has the following fields:
 *   index: bip32 sequence
 *   label: label
 *   balance: satoshis
 *   nOutputs: number of outputs
 *   address: address hash
 */
Wallet.prototype.getWalletAddress = function(address) {
    var keys = Object.keys(this.pubKeys);
    for (var idx=0; idx<keys.length; idx++) {
         var walletAddress = this.pubKeys[keys[idx]];
         if (walletAddress.address == address) {
             return walletAddress;
         }
    }
}

/**
 * Send bitcoins from this wallet.
 * XXX preliminary... needs storing more info here or just use bitcoinjs-lib api
 */
Wallet.prototype.sendBitcoins = function(recipient, changeAddress, amount, fee, password) {
    // test for stealth
    var ephemKey, stealthPrefix;
    if (recipient[0] == 'S') {
        var bytes = Bitcoin.base58.checkDecode('1'+recipient);
        stealthPrefix = bytes.slice(34, 39);
        var stealthData = Stealth.initiateStealth(bytes.slice(1,34));
        recipient = stealthData[0].toString();
        ephemKey = stealthData[1];
    }
    // find an output with enough funds
    var utxo = this.wallet.getUtxoToPay(amount+fee);
    if (utxo.length > 1) {
        console.log("several inputs not supported yet!");
        return;
    }
    // prepare some parameters
    var utxo1 = utxo[0];
    var outAmount = utxo1.value;

    // now prepare transaction
    var newTx = new Bitcoin.Transaction();
    // add inputs
    newTx.addInput(utxo1.output);
    var change = outAmount - (amount + fee);

    // add outputs
    newTx.addOutput(recipient, amount);
    newTx.addOutput(changeAddress.address, change);
    if (ephemKey) {
        if (stealthPrefix[0] > 0) {
            console.log("Stealth prefix not supported yet!");
            return;
        }
        var nonce = 0;
        var stealthOut = Stealth.buildNonceOutput(ephemKey, nonce);
        newTx.addOutput(stealthOut);
    }

    console.log("sending:", recipient ,"change", change, "sending", amount+fee, "utxo", outAmount);

    // XXX Might need to sign several inputs
    var pocket, n;
    var outAddress = this.getWalletAddress(utxo1.address);
    if (outAddress) {
        var seq = outAddress.index;
        pocket = seq[0];
        n = seq[1];
    } else {
        console.log("This address is not managed by the wallet!");
        return;
    }
    // XXX should catch exception on bad password:
    //   sjcl.exception.corrupt {toString: function, message: "ccm: tag doesn't match"}
    this.getPrivateKey([pocket, n], password, function(outKey) {
        newTx.sign(0, outKey.key);

        // XXX send transaction
        console.log("send tx", newTx);
        console.log("send tx", newTx.serializeHex());
        var notifyTx = function(error, count) {
            if (error) {
                console.log("Error sending tx: " + error);
                return;
            }
            console.log("tx radar: " + count);
        }
        if (ephemKey) {
            console.log("not broadcasting stealth tx yet...");
        } else {
            DarkWallet.obeliskClient.client.broadcast_transaction(newTx.serializeHex(), notifyTx)
        }
    });
}

/**
 * Process an output from an external source
 * @see Bitcoin.Wallet.processOutput
 */
Wallet.prototype.processOutput = function(output) {
    this.wallet.processOutput(output);
}

/**
 * Process history report from obelisk
 */
Wallet.prototype.processHistory = function(address, history) {
    var self = this;
    var walletAddress = this.getWalletAddress(address);
    if (!walletAddress) {
        console.log("no wallet record for", address);
        return;
    }
    // reset some numbers for the address
    walletAddress.balance = 0;
    walletAddress.height = 0;
    walletAddress.nOutputs = 0;
    // process history
    history.forEach(function(tx) {
         // sum unspent outputs for the address
        var outTxHash = tx[0];
        var inTxHash = tx[4];
        walletAddress.nOutputs += 1;
        if (inTxHash == null) {
            walletAddress.balance += tx[3];
            walletAddress.height = Math.max(tx[2], walletAddress.height);
        }
        // pass on to internal Bitcoin.Wallet
       self.processOutput({ output: tx[0]+":"+tx[1], value: tx[3], address: walletAddress.address });
    });
}


/**
 * Process stealth array from obelisk.
 * The array comes 
 */
Wallet.prototype.processStealth = function(stealthArray, password) {
    var self = this;
    stealthArray.forEach(function(stealthData) {
        var ephemkey = Bitcoin.convert.hexToBytes(stealthData[0]).slice(5);
        var address = stealthData[1];
        var txId = stealthData[2];

        // for now checking just the first stealth address derived from pocket 0 "default"
        self.getPrivateKey([0], password, function(privKey) {
            var stAddr = Stealth.uncoverStealth(privKey.key.export('bytes'), ephemkey);
            if (address == stAddr.getBitcoinAddress().toString()) {
                console.log("STEALTH MATCH!!");
            }
        });
    });
}

