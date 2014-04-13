/**
 * @fileOverview HistoryCtrl angular controller
 */

define(['./module', 'bitcoinjs-lib', 'util/btc', 'frontend/services', 'darkwallet'],
function (controllers, Bitcoin, BtcUtils, Services, DarkWallet) {
  'use strict';
  controllers.controller('HistoryCtrl', ['$scope', 'notify', function($scope, notify) {

  // Start some structures
  $scope.pocket = {index: undefined, name: 'All Pockets', mpk: undefined, addresses: $scope.allAddresses, changeAddresses: []};
  $scope.pocketName = "All Pockets";
  $scope.selectedPocket = 'pocket:all';

  $scope.isAll = true;
  $scope.isFund = false;

  // Create a profile out of a public key by looking in contacts and wallet.
  var detectParticipant = function(pubKeyBytes) {
      var identity = $scope.identity;

      // Ensure we check the compressed version
      var pubKey = new Bitcoin.ECPubKey(pubKeyBytes, true);
      var address = pubKey.toString();

      var uncompressedAddress = new Bitcoin.ECPubKey(pubKeyBytes, false).toString();
      var participant = { name: uncompressedAddress,
                          pubKey: pubKey.toBytes(false),
                          hash: pubKey.toHex() };

      var walletAddress = identity.wallet.getWalletAddress(address);
      if (walletAddress) {
          // Current identity
          participant.type = 'me';
          participant.name = identity.name;
          participant.address = walletAddress;
          // In some cases would not be the stealth identifier.
          // Also, doing it like this so it would show the same as in contacts..
          participant.hash = Bitcoin.Crypto.SHA256(walletAddress.stealth).toString();
      } else {
          // Check if it's a contact
          var contact = identity.contacts.findByPubKey(pubKey.toBytes(false));
          if (contact) {
              participant.name = contact.name;
              participant.hash = contact.hash;
              participant.type = 'contact';
          }
      }
      return participant;
  }

  // Detect participants for a fund from contacts and wallet.
  var detectFundParticipants = function(fund) {
      // TODO: Not very efficient, should keep track in some way
      var participants = [];

      fund.pubKeys.forEach(function(pubKey) {
          participants.push(detectParticipant(pubKey));
      });

      return participants;
  }

  // Check tasks and put some info in the pocket
  var checkFundTasks = function(fund) {
      var identity = $scope.identity;
      var res = [];
      // Check pending tasks for fund
      var tasks = identity.tasks.tasks.multisig;
      if (tasks) {
          tasks.forEach(function(task) {
              if (task.pending[0].address == fund.address) {
                  var tx = new Bitcoin.Transaction(task.tx);
                  res.push({tx: tx, task: task});
              }
          });
      }
      return res;
  }

  // History Listing
  $scope.selectFund = function(fund, rowIndex) {
      $scope.pocket.name = fund.name;
      $scope.pocket.index = fund.seq[0];
      var address = $scope.identity.wallet.getAddress(fund.seq)
      $scope.pocket.participants = detectFundParticipants(fund);
      $scope.pocket.changeAddresses = [];
      $scope.pocket.addresses = [address];
      $scope.pocket.fund = fund;
      $scope.pocket.tasks = checkFundTasks(fund);
      $scope.isAll = false;
      $scope.isFund = true;
      $scope.pocket.mpk = undefined;
      $scope.pocket.stealth = undefined;
      $scope.selectedPocket = 'fund:' + rowIndex;
      $scope.balance = $scope.identity.wallet.getAddress(fund.seq).balance;
      //balanceStart($scope.balance);

      // Check tasks and put some info in the pocket
      checkFundTasks(fund, $scope.pocket);
  }
  $scope.selectPocket = function(pocketName, rowIndex, form) {
      var pocketIndex;
      if (pocketName === undefined) {
          $scope.pocket.name = "All Pockets";
          $scope.pocket.index = undefined;
          $scope.pocket.mpk = undefined;
          $scope.pocket.stealth = undefined;
          $scope.pocket.fund = null;
          $scope.pocket.addresses = $scope.allAddresses;
          $scope.pocket.changeAddresses = [];
          $scope.isAll = true;
          $scope.isFund = false;
          $scope.balance = $scope.identity.wallet.getBalance()
          $scope.pocket.tasks = [];
          //balanceStart($scope.balance);
          rowIndex = 'all';
      } else {
          pocketIndex = rowIndex*2;
          $scope.pocket.index = pocketIndex;
          $scope.pocket.name = pocketName;
          $scope.pocket.fund = null;
          var walletAddress = $scope.identity.wallet.getAddress([$scope.pocket.index]);
          if (!walletAddress.mpk) {
              // derive mpk here for now so we can show as master address
	      var mpKey = Bitcoin.HDWallet.fromBase58($scope.identity.wallet.mpk);
              var childKey = mpKey.derive($scope.pocket.index);
              walletAddress.mpk = childKey.toBase58(false);
              $scope.identity.wallet.store.save();
          }
          $scope.pocket.mpk = walletAddress.mpk;
          $scope.pocket.stealth = walletAddress.stealth;
          $scope.pocket.addresses = $scope.addresses[$scope.pocket.index];
          $scope.pocket.changeAddresses = $scope.addresses[$scope.pocket.index+1];
          var walletPocket = $scope.identity.wallet.getPocket(pocketName);
          $scope.pocket.mixing = walletPocket.mixing;
          $scope.pocket.tasks = [];
          $scope.isAll = false;
          $scope.isFund = false;
          // balance is sum of public and change branches
          $scope.balance = $scope.identity.wallet.getBalance(pocketIndex)+$scope.identity.wallet.getBalance(pocketIndex+1);
          $scope.forms.pocketLabelForm = form;
      }
      $scope.selectedPocket = 'pocket:' + rowIndex;
  }

  $scope.renamePocket = function(pocket) {
    if (!pocket.name) {
      $scope.forms.pocketLabelForm.$show();
    } else {
      $scope.identity.store.save();
    }
  };

  $scope.newMultiSig = function() {
    $scope.selectedPocket = 'newMultisig';
  }

  // Pockets
  $scope.newPocket = {};
  $scope.creatingPocket = false;
  $scope.deletePocket = function(pocket) {
      $scope.openModal('confirm-delete', {name: pocket.name, object: pocket}, $scope.deletePocketFinish)
  }
  $scope.deletePocketFinish = function(pocket) {
      $scope.identity.wallet.deletePocket(pocket.name);
      $scope.selectPocket();
  }
  $scope.setMixing = function(pocket) {
      var identity = $scope.identity;
      var walletPocket = identity.wallet.getPocket(pocket.name);
      walletPocket.mixing = !walletPocket.mixing;
      pocket.mixing = walletPocket.mixing;
      identity.wallet.store.save();
      var mixerService = DarkWallet.service().getMixerService();
      mixerService.checkMixing();
  }
  $scope.createPocket = function() {
    if ($scope.creatingPocket) {
      if ($scope.newPocket.name) {
          // create pocket
          $scope.identity.wallet.createPocket($scope.newPocket.name);
          // initialize pocket on angular
          $scope.initPocket($scope.identity.wallet.pockets.length-1);
          // generate an address
          $scope.generateAddress($scope.identity.wallet.pockets.length-1, 0);
          // select the pocket
          $scope.selectPocket($scope.newPocket.name, $scope.identity.wallet.pockets.length-1);
          // reset pocket form
          $scope.newPocket = {};
      }
    }
    $scope.creatingPocket = !$scope.creatingPocket;
  }

  // Filters

  var shownRows = [];
  $scope.txFilter = 'last10';

  var pocketFilter = function(row) {
      // Making sure shownRows is reset before historyFilter stage is reached.
      shownRows = [];
      if ($scope.isAll) {
          // only add pocket transactions for now
          return typeof row.pocket === 'number';
      }
      else {
          // row pocket here is just 1st element in index, pocket can be pocket/2
          if (typeof row.pocket === 'number') {
              return Math.floor(row.pocket/2) == $scope.pocket.index;
          } else {
              return row.pocket == $scope.pocket.index;
          }
      }
  }

  // Get date 30 days ago
  var prevmonth = new Date();
  prevmonth.setDate(prevmonth.getDate()-30)
  // Get date 7 days ago
  var prevweek = new Date();
  prevweek.setDate(prevweek.getDate()-7)

  // Set the history filter
  $scope.setHistoryFilter = function(name) {
      $scope.txFilter = name;
      shownRows = [];
  }

  // History filter, run for every row to see if we should show it
  $scope.unusedAddressFilter = function(address) {
      return address.nOutputs == 0;
  }
  $scope.usedAddressFilter = function(address) {
      return address.nOutputs;
  }
  $scope.pocketFilter = function(row) {
      return pocketFilter(row);
  }
  $scope.historyFilter = function(row) {
      switch($scope.txFilter) {
          case 'all':
              return true;
          case 'lastWeek':
              var ts = BtcUtils.heightToTimestamp(row.height);
              if (ts > prevweek.getTime()) {
                  return true;
              }
              break;
          case 'lastMonth':
              var ts = BtcUtils.heightToTimestamp(row.height);
              if (ts > prevmonth.getTime()) {
                  return true;
              }
              break;
          case 'last10':
          default:
              if (shownRows.indexOf(row.hash) != -1) {
                  return true;
              } else if (shownRows.length < 10) {
                  shownRows.push(row.hash)
                  return true;
              }
      }
      return false;
  }

  $scope.moveFunds = function(type, index) {
    var to;
    if (type === 'pocket') {
      to = $scope.identity.wallet.pockets[index].name;
    } else if (type === 'multisig') {
      to = $scope.identity.wallet.multisig.funds[index].name;
    } else {
      to = $scope.availableIdentities[index];
    }
    $scope.openModal('confirm', {message: "Are you sure you want to move all " + $scope.pocket.name +
    " funds to " + to + "?"}, function() {
      console.log('Move funds not implemented yet');
    })
  };

}]);
});
