/*
 * @fileOverview Background service running for the wallet
 */
define(['model/keyring', 'backend/port', 'dwutil/currencyformat', 'dwutil/tasks/transaction', 'bitcoinjs-lib'],
function(IdentityKeyRing, Port, CurrencyFormatting, TransactionTasks, Bitcoin) {
  'use strict';

  function WalletService(core) {
    var keyRing = new IdentityKeyRing();
    var self = this;
    this.name = 'wallet';
    var heightTimeout;

    // Some scope variables
    var currentIdentity = false;

    this.currentHeight = 0;

    // Wallet port
    Port.listen('wallet', function() {
      }, function(port) {
          // Client connected
          if (currentIdentity && keyRing.identities.hasOwnProperty(currentIdentity)) {
              port.postMessage({'type': 'ready', 'identity': currentIdentity});
          }
      }, function(port) {
          // Client disconnected
    });

    var setBadgeItems = function(identity) {
        var identity = identity || self.getCurrentIdentity();
        var openTasks = identity.tasks.getOpenTasks();
        if (openTasks) {
            chrome.browserAction.setBadgeText({text: ""+openTasks});
        } else {
            chrome.browserAction.setBadgeText({text: ""});
        }
    }

    /***************************************
    /* Identities
     */

    var startIdentity = function(identity, callback) {
        if (heightTimeout) {
            clearInterval(heightTimeout);
            heightTimeout = false;
        }
        currentIdentity = identity.name;

        //Load up tasks
        setBadgeItems(identity);

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
    var notifyRow = function(walletAddress, row, height) {
        var title;
        var value = row.myOutValue - row.myInValue;
        var taskType = value>0 ? 'receive' : 'send';

        if (value > 0) {
            if (height) {
                title = "Received";
            } else {
                title = "Receiving (unconfirmed)";
            }
        } else {
            if (height) {
                title = "Sending";
            } else {
                title = "Sending (unconfirmed)";
            }
        }
        TransactionTasks.processRow(taskType, value, row, height);
        setBadgeItems();
        var formattedValue = CurrencyFormatting.format(value);

        // Port the the os notification service
        core.service.notifier.post(title, formattedValue);

        // Post the balance update to the gui so it can be updated
        var pocketId = core.getIdentity().wallet.pockets.getAddressPocketId(walletAddress);
        Port.post('gui', {type: 'balance', pocketId: pocketId});
    };

    // Callback for when an address was updated
    var onAddressUpdate = function(walletAddress, addressUpdate) {
        var identity = self.getCurrentIdentity();

        // Get variables from the update
        var height = addressUpdate.height;
        var tx = addressUpdate.tx;
        // var block_hash = addressUpdate.block_hash;
        var address = addressUpdate.address;

        if (addressUpdate.address != walletAddress.address) {
            // not for us..
            console.log("Invalid address update!!!!!");
            return;
        }

        // Process
        var row = identity.wallet.processTx(walletAddress, tx, height);

        // Show a notification for incoming transactions
        if (row) {
            notifyRow(walletAddress, row, height);
        }
    }

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
        client.subscribe(walletAddress.address, function(err, res) {
            // fill history after subscribing to ensure we got all histories already (for now).
            identity.history.fillHistory(walletAddress, history);
            var pocketId = identity.wallet.pockets.getAddressPocketId(walletAddress);
            Port.post('gui', {type: 'balance', pocketId: pocketId});
        }, function(addressUpdate) {
            onAddressUpdate(walletAddress, addressUpdate);
        });
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
        console.log("fetch history for", walletAddress.address);
        client.fetch_history(walletAddress.address, function(err, res) { historyFetched(err, walletAddress, res); });
    };

    // Handle initial connection to obelisk
    function handleHeight(err, height) {
        if (height != self.currentHeight) {
            self.currentHeight = height;
            console.log("[wallet] height fetched", height);
            TransactionTasks.processHeight(height);
            setBadgeItems();
            Port.post('gui', {type: 'height', value: height});
        }
    }

    this.fetchHeight = function() {
        if (heightTimeout) {
            console.log("[wallet] warning, height timeout launched but still active!");
            clearInterval(heightTimeout);
        }

        var client = core.getClient();
        client.fetch_last_height(handleHeight);

        // Run again in one minute to get last height (gateway doesn't give this yet..)
        heightTimeout = setInterval(function() {
            var client = core.getClient();
            if (client && client.connected) {
                client.fetch_last_height(handleHeight);
            }
        }, 60000);
    }


    this.handleInitialConnect = function() {
        console.log("[wallet] initial connect");
        var identity = self.getCurrentIdentity();

        var client = core.getClient();

        self.fetchHeight();

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
        var mixerService = core.service.mixer;
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
                // Else, broadcast and add task
                var txHash = Bitcoin.convert.bytesToHex(newTx.getHash());
                TransactionTasks.processSpend(txHash, metadata.myamount, metadata.recipients);
                setBadgeItems(identity);
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
         core.getClient().broadcast_transaction(newTx.serializeHex(), notifyTx);
     };
  }
  return WalletService;
});

