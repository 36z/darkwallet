/*
 * @fileOverview Background service running for the wallet
 */
define(['model/keyring', 'backend/port'],
function(IdentityKeyRing, Port) {
  'use strict';

  function WalletService(core) {
    var keyRing = new IdentityKeyRing();
    var self = this;

    // Some scope variables
    var currentIdentity = false;

    var identityNames = [];

    this.currentHeight = 0;

    // Wallet port
    Port.listen('wallet', function() {
      }, function(port) {
          // Connected
          console.log('[bus] wallet client connected');
          if (currentIdentity && keyRing.identities.hasOwnProperty(currentIdentity)) {
              port.postMessage({'type': 'ready', 'identity': currentIdentity});
          }
      }, function(port) {
          // Disconnected
          console.log('[bus] wallet client disconnected');
    });

    /***************************************
    /* Identities
     */

    var startIdentity = function(identity, callback) {
        currentIdentity = identity.name;

        //Load up tasks
        var openTasks = identity.tasks.getOpenTasks();
        if (openTasks) {
             chrome.browserAction.setBadgeText({text: ""+openTasks});
        }

        // Inform gui and other services
        identity.history.update = function() { Port.post('gui', {name: 'update'}); };

        Port.post('wallet', {'type': 'ready', 'identity': identity.name});
        Port.post('wallet', {'type': 'loaded', 'identity': identity.name});

        callback ? callback(identity) : null;
    }

    this.createIdentity = function(name, secret, password, callback) {
        console.log("[wallet] Create identity", name);
        if (currentIdentity) {
            Port.post('wallet', {'type': 'closing', 'identity': currentIdentity});
        }
        var identity = keyRing.createIdentity(name, secret, password);
        startIdentity(identity, callback);
    }

    this.loadIdentity = function(idx, callback) {
        var name = keyRing.availableIdentities[idx];
        if (currentIdentity != name) {
            Port.post('wallet', {'type': 'closing', 'identity': currentIdentity});
            console.log("[wallet] Load identity", name);
            keyRing.get(name, function(identity) {
                startIdentity(identity, callback);
            });
        }
    };

    // Get an identity from the keyring
    this.getIdentity = function(idx) {
        if (idx === null || idx === undefined) {
            return self.getCurrentIdentity();
        }
        var name = keyRing.availableIdentities[idx];
        currentIdentity = name;
        return keyRing.identities[name];
    };

    this.getCurrentIdentity = function() {
        return keyRing.identities[currentIdentity];
    };

    // Notify frontend of history row updates
    var notifyRow = function(newRow, height) {
        if (newRow && (newRow.myOutValue - newRow.myInValue) > 0) {
            if (height) {
                Port.post('gui', {type: "note", text: 'Received: ' + newRow.myOutValue - newRow.myInValue});
            } else {
                Port.post('gui', {type: "note", text: 'Unconfirmed: ' + newRow.myOutValue - newRow.myInValue});
            }
        }
    };

    /***************************************
    /* History and address subscription
     */
    function historyFetched(err, walletAddress, history) {
        if (err) {
            core.servicesStatus.obelisk = 'error';
            console.log("[wallet] Error fetching history for", walletAddress.address);
            return;
        }
        core.servicesStatus.obelisk = 'ok';
        var client = core.getClient();
        var identity = self.getCurrentIdentity();

        // pass to the wallet to process outputs
        identity.wallet.processHistory(walletAddress, history);

        // now subscribe the address for notifications
        console.log("[wallet] subscribing", walletAddress.address);
        client.subscribe(walletAddress.address, function(err, res) {
            console.log("[wallet] subscribed", walletAddress.address, err, res);

            // fill history after subscribing to ensure we got all histories already (for now).
            identity.history.fillHistory(walletAddress, history);
        }, function(addressUpdate) {
            console.log("[wallet] update", addressUpdate);

            // Get variables from the update
            var height = addressUpdate.height;
            var tx = addressUpdate.tx;
            var block_hash = addressUpdate.block_hash;
            var address = addressUpdate.address;

            // Process
            var walletAddress = identity.wallet.getWalletAddress(address);
            if (walletAddress) {
                var newRow = identity.wallet.processTx(walletAddress, tx, height);
                // Show a notification for incoming transactions
                notifyRow(newRow, height);
            }
        });
        Port.post('gui', {type: "balance"});
    }

    // Start up history for an address
    this.initAddress = function(walletAddress) {
        var client = core.getClient();
        if (!client) {
            // TODO manage this case better
            console.log("trying to init address but not connected yet!... skipping :P");
            return;
        }
        var identity = self.getCurrentIdentity();
        client.fetch_history(walletAddress.address, function(err, res) { historyFetched(err, walletAddress, res); });
    };

    // Handle initial connection to obelisk
    function handleHeight(err, height) {
        self.currentHeight = height;
        console.log("[wallet] height fetched", height);
        Port.post('gui', {type: 'height', value: height});
    }

    this.handleInitialConnect = function() {
        console.log("[wallet] initial connect");
        var identity = self.getCurrentIdentity();

        var client = core.getClient();
        client.fetch_last_height(handleHeight);

        // get balance for addresses
        Object.keys(identity.wallet.pubKeys).forEach(function(pubKeyIndex) {
            var walletAddress = identity.wallet.pubKeys[pubKeyIndex];
            if (walletAddress.index.length > 1) {
                self.initAddress(walletAddress);
            }
        });
    };

    this.getKeyRing = function() {
        return keyRing;
    };

    /*
     * Send a transaction into the mixer
     */
    var mixTransaction = function(newTx, metadata, callback) {
        var identity = self.getCurrentIdentity();
        var task = {tx: newTx.serializeHex(),
                    state: 'announce',
                    total: metadata.total,
                    fee: metadata.fee,
                    change: metadata.change,
                    myamount: metadata.myamount};

        // Add the task to model
        identity.tasks.addTask('mixer', task);

        // Now start the task in the mixer service
        var mixerService = core.getService('mixer');
        mixerService.startTask(task);
                
        // Callback for calling process
        callback(null, {task: task, tx: newTx, type: 'mixer'});
    };

    /*
     * Sign a transaction, then broadcast or add task to gather sigs
     */
    this.signTransaction = function(newTx, metadata, password, callback) {
        var identity = self.getCurrentIdentity();
        // Otherwise just sign and lets go
        identity.wallet.signTransaction(newTx, metadata.utxo, password, function(err, pending) {
            if (err) {
                // There was some error signing the transaction
                callback(err);
            } else if (pending.length) {
                // If pending signatures add task and callback with 2nd parameter
                var task = {tx: newTx.serializeHex(), 'pending': pending, stealth: metadata.stealth};
                identity.tasks.addTask('multisig', task);
                callback(null, {task: task, tx: newTx, type: 'signatures'});
            } else {
                // Else, just broadcast
                self.broadcastTx(newTx, metadata.stealth, callback);
            }
        });
    };

    /*
     * Send bitcoins
     */
    this.send = function(pocketIdx, recipients, changeAddress, fee, mixing, callback) {
        var identity = self.getCurrentIdentity();

        // Prepare the transaction
        try {
            var prepared = identity.wallet.prepareTx(pocketIdx, recipients, changeAddress, fee);
        } catch (e) {
            callback(e);
            return;
        }

        // Now process the new transaction
        if (mixing) {
            mixTransaction(prepared.tx, prepared, callback);
        } else {
            prepared.type = 'sign';
            callback(null, prepared);
            //signTransaction(prepared.tx, prepared, password, callback);
        }
    };

    /*
     * Broadcast the given transaction
     */
     this.broadcastTx = function(newTx, isStealth, callback) {
         // Broadcasting
         console.log("send tx", newTx);
         console.log("send tx", newTx.serializeHex());
         var notifyTx = function(error, count) {
             if (error) {
                 console.log("Error sending tx: " + error);
                 callback({data: error, text: "Error sending tx"});
             } else {
                 // TODO: radar can be added as a task to maintain progress
                 callback(null, {radar: count, type: 'radar'});
                 console.log("tx radar: " + count);
             }
         };
         if (isStealth) {
             console.log("not broadcasting stealth tx yet...");
         } else {
             core.getClient().broadcast_transaction(newTx.serializeHex(), notifyTx);
         }
     };
  }
  return WalletService;
});

