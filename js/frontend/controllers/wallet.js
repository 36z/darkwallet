/**
 * @fileOverview Wallet classes.
 */

/**
 * Wallet constructor class.
 * @param {Object} $scope Angular scope.
 * @constructor
 */
define(['./module', 'darkwallet', 'frontend/services', 'util/ng/clipboard', 'util/ng/modals'],
function (controllers, DarkWallet, Services, ClipboardUtils, ModalUtils) {
  'use strict';
  controllers.controller('WalletCtrl',
  ['$scope', '$location' ,'ngProgress', 'toaster', '$modal', '$timeout',
   function($scope, $location, ngProgress, toaster, $modal, $timeout) {
  var pubKey, mpKey, addressIndex;

  // Pointer to service
  var bg = DarkWallet.service();
  $scope.rates = {};
  $scope.allAddresses = [];
  $scope.totalBalance = 0;

  // Global scope utils
  ModalUtils.registerScope($scope, $modal);
  ClipboardUtils.registerScope($scope, toaster);

  // Gui service, connect to report events on page.
  Services.connectNg('gui', $scope, function(data) {
    console.log('[WalletCtrl] gui bus:', data.type);
    if (data.type == 'balance') {
    }
    if (data.type == 'height') {
        $scope.currentHeight = data.value;
    }
    if (data.type == 'text' || data.type == 'note') {
        toaster.pop('note', 'gui', data.text);
    }
    if (data.type == 'error') {
        toaster.pop('error', data.title || 'gui', data.text);
    }
    if (data.type == 'warning') {
        toaster.pop('warning', 'gui', data.text);
    }
    if (['height', 'update', 'balance'].indexOf(data.type) > -1) {
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    }
  })

  // Obelisk service, connect to get notified on events and connection.
  Services.connectNg('obelisk', $scope, function(data) {
    console.log("[WalletCtrl] obelisk bus:", data.type);
    if (data.type == 'connected') {
        var identity = DarkWallet.getIdentity();
        toaster.pop('success', 'connected', identity.connections.servers[identity.connections.selectedServer].name);
        //ngProgress.color('green');
        //ngProgress.complete();
    }
    if (data.type == 'connectionError') {
        toaster.pop("error", "Error connecting", data.error)
        //ngProgress.color('red');
        //ngProgress.complete();
    }
  })

  // Wallet service, connect to get notified about identity getting loaded.
  Services.connectNg('wallet', $scope, function(data) {
    console.log("[WalletCtrl] wallet bus:", data.type);
    if (data.type == 'ready') {
        // identity is ready here
        loadIdentity(DarkWallet.getIdentity())
    }
    if (data.type == 'ticker') {
        $scope.rates[data.currency] = data.rate;
    }
  })


  // Check if a route is active
  $scope.isActive = function(route) {
    return route === $location.path();
  }

  // Initialize if empty wallet
  function initializeEmpty() {
      if (Object.keys($scope.addresses).length == 0) {
          // generate 5 addresses for now
          for(var idx=0; idx<5; idx++) {
              $scope.generateAddress(0);
              $scope.generateAddress(1);
          }
      }
  }

  function loadAddresses(identity) {
      /* Load addresses into angular */
      Object.keys(identity.wallet.pubKeys).forEach(function(pubKeyIndex) {
          var walletAddress = identity.wallet.getAddress(pubKeyIndex);
          // Init pockets
          for(var idx=0; idx<identity.wallet.pockets.length; idx++) {
              $scope.initPocket(idx);
          };
          // Regular addresses
          if (walletAddress.index.length > 1) {
              // add to scope
              var pocketIndex = walletAddress.index[0];
              if (!$scope.addresses[pocketIndex]) {
                  $scope.addresses[pocketIndex] = [];
              }
              var addressArray = $scope.addresses[pocketIndex];
              if ($scope.allAddresses.indexOf(walletAddress) == -1) {
                  addressArray.push(walletAddress);
                  $scope.allAddresses.push(walletAddress);
              }
          }
      });
  }

  function loadIdentity(identity) {
      $scope.addresses = {};
      $scope.allAddresses.splice(0,$scope.allAddresses.length);
      // set some links
      $scope.identity = identity;
      $scope.availableIdentities = bg.getKeyRing().availableIdentities;
      $scope.history = identity.history.history;
      // set history update callback
      $scope.totalBalance = identity.wallet.getBalance();
      $scope.selectedCurrency = identity.settings.currency;
      $scope.selectedFiat = identity.settings.fiatCurrency;
      $scope.defaultFee = identity.wallet.fee / 100000000;

      // load addresses into angular
      loadAddresses(identity);

      // initialize if empty wallet
      initializeEmpty();

      // this will connect to obelisk if we're not yet connected
      //ngProgress.color('firebrick');
      //ngProgress.start();
      if (bg.getClient() && bg.getClient().connected) {
          // If already connected set the progress bar to finish
          // we wait a moment to provide better visual feedback
          /*$timeout(function() {
              ngProgress.color('green');
              ngProgress.complete();
          }, 500);*/
      } else {
          // Request connecting to blockchain
          setTimeout(function() {
            bg.connect();
          })
      }
      console.log("[WalletCtrl] loadIdentity", identity.name);
      // apply scope changes
      /*if(!$scope.$$phase) {
          $scope.$apply();
      }*/
  };

  // Initialize pocket structures.
  $scope.initPocket = function(rowIndex) {
      var pocketIndex = rowIndex*2;
      if (!$scope.addresses[pocketIndex]) {
          $scope.addresses[pocketIndex] = [];
      }
      if (!$scope.addresses[pocketIndex+1]) {
          $scope.addresses[pocketIndex+1] = [];
      }
  }

  // scope function to generate (or load from cache) a new address
  $scope.generateAddress = function(isChange, n) {
    if (!isChange) {
        isChange = 0;
    }
    if (!$scope.addresses[isChange]) {
        $scope.addresses[isChange] = [];
    }
    var addressArray = $scope.addresses[isChange];
    if (n === undefined || n === null) {
        n = addressArray.length;
    }
    var walletAddress = $scope.identity.wallet.getAddress([isChange, n]);

    // add to scope
    if ($scope.allAddresses.indexOf(walletAddress) == -1) {
        addressArray.push(walletAddress);
        $scope.allAddresses.push(walletAddress);
    }

    // get history for the new address
    bg.initAddress(walletAddress);
    return walletAddress;
  };

  // get a free change address or a new one
  $scope.getChangeAddress = function() {
    for(var idx=0; $scope.allAddresses.length; idx++) {
        if ($scope.allAddresses[idx].nOutputs == 0 && $scope.allAddresses[idx].index[0]%2 == 1) {
            return $scope.allAddresses[idx];
        }
    }
    return $scope.generateAddress(1);
  }

  // Load identity
  if (bg.getKeyRing().availableIdentities.length && !bg.getIdentity()) {
    bg.loadIdentity(0);
  }
}]);
});
