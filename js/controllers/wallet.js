/**
 * @fileOverview Wallet classes.
 */

/**
 * Wallet constructor class.
 * @param {Object} $scope Angular scope.
 * @constructor
 */
function WalletCtrl($scope, ngProgress, toaster) {
  var pubKey, mpKey, addressIndex;

  // generated addresses
  $scope.addresses = [];
  $scope.changeAddresses = [];
  $scope.subsection = 'history';
  $scope.section = 'wallet';

  var bg = DarkWallet.service();

  // Listen for messages from the background service
  bg.addListener(function(message, send) {
    if (message.name == 'guiUpdate' || message.name == 'balanceUpdate') {
        if (message.name == 'balanceUpdate') {
            $scope.totalBalance = $scope.identity.wallet.getBalance();
        }
    }
    if (message.name == 'height') {
        $scope.currentHeight = message.value;
    }
    // apply interface changes
    if(['height', 'guiUpdate', 'balanceUpdate'].indexOf(message.name) > -1 && !$scope.$$phase) {
        $scope.$apply();
    }
  });

  // Initialize if empty wallet
  function initializeEmpty() {
      if ($scope.addresses.length == 0) {
          // generate 5 addresses for now
          for(var idx=0; idx<5; idx++) {
              $scope.generateAddress(0);
          }
      }
  }
  function loadAddresses(identity) {
      /* Load addresses into angular */
      Object.keys(identity.wallet.pubKeys).forEach(function(pubKeyIndex) {
          var walletAddress = identity.wallet.getAddress(pubKeyIndex);
          // Regular addresses
          if (walletAddress.index.length > 1) {
              // add to scope
              var addressArray = walletAddress.index[0] ? $scope.changeAddresses : $scope.addresses;
              addressArray.push(walletAddress);
          }
      });
  }

  function loadIdentity(identity) {
      // set some links
      $scope.identity = identity;
      $scope.history = identity.history.history;
      // set history update callback
      $scope.totalBalance = identity.wallet.getBalance();

      // load addresses into angular
      loadAddresses(identity);

      // initialize if empty wallet
      initializeEmpty();

      // apply scope changes
      if(!$scope.$$phase) {
          $scope.$apply();
      }
      // this will connect to obelisk if we're not yet connected
      ngProgress.start();
      bg.connect(function() {ngProgress.complete()});
  };

  // scope function to generate (or load from cache) a new address
  $scope.generateAddress = function(isChange, n) {
    var addressArray = isChange ? $scope.changeAddresses : $scope.addresses;
    if (n === undefined || n === null) {
        n = addressArray.length;
    }
    var walletAddress = $scope.identity.wallet.getAddress([isChange, n]);

    // add to scope
    addressArray.push(walletAddress)

    // get history for the new address
    bg.initAddress(walletAddress);
    return walletAddress;
  };

  // get a free change address or a new one
  $scope.getChangeAddress = function() {
    for(var idx=0; $scope.changeAddresses.length; idx++) {
        if ($scope.changeAddresses[idx].balance == 0) {
            return $scope.changeAddresses[idx];
        }
    }
    return $scope.generateAddress(1);
  }

  // function to receive stealth information
  $scope.receiveStealth = function() {
      toaster.pop('note', "stealth", "receiving")
      ngProgress.start();
      
      var client = DarkWallet.getClient();
      var stealth_fetched = function(error, results) {
          if (error) {
              write_to_screen('<span style="color: red;">ERROR:</span> ' + error);
              return;
          }
          console.log("STEALTH", results);
          ngProgress.complete();
          $scope.identity.wallet.processStealth(results, $scope.send.password);
      }
      client.fetch_stealth([0,0], stealth_fetched, 0);
  }

  // Load identity
  bg.loadIdentity(0, loadIdentity);

};



