/**
 * @fileOverview HistoryCtrl angular controller
 */
'use strict';

define(['./module', 'darkwallet', 'frontend/port'],
function (controllers, DarkWallet, Port) {
  controllers.controller('HistoryCtrl', ['$scope', '$history', function($scope, $history) {

  // Scope variables
  $scope.pocket = $history.getCurrentPocket();
  $scope.selectedPocket = $history.selectedPocket;

  $scope.historyRows = $history.rows;

  // Filters
  $scope.txFilter = $history.txFilter;


  /**
   * Identity Loading
   */
  var identityLoaded = function(identity) {
      // set stealth address on the general section
      if ($scope.pocket.isAll && !$scope.pocket.stealth) {
          identity = identity || DarkWallet.getIdentity();
          var mainAddress = identity.wallet.getAddress([0]);
          $scope.pocket.stealth = mainAddress.stealth;
      }
  }

  var identity = DarkWallet.getIdentity();
  if (identity && $scope.pocket.isAll) {
      identityLoaded(identity);
  }


  /**
   * Gui Port
   */
  Port.connectNg('gui', $scope, function(data) {
      // Check on gui balance updates to recalculate pocket balance so it shows properly
      if (data.type == 'balance') {
          if ($history.isCurrentPocket(data.pocketId)) {
              $scope.historyRows = $history.onBalanceUpdate();
          }
      }
  });
 
  /**
   * Wallet port
   */
  Port.connectNg('wallet', $scope, function(data) {
      if (data.type == 'ready') {
          identityLoaded();

          // update history rows shown
          $scope.historyRows = $history.onBalanceUpdate();
      }
  });


  /**
   * Select fund as current pocket
   */
  $scope.selectFund = function(fund, rowIndex) {
      // Select the fund in history
      $scope.historyRows = $history.selectFund(fund, rowIndex);

      // Set the selected pocket
      $scope.selectedPocket = $history.selectedPocket;

      // Update tabs
      $scope.tabs.updateTabs($history.pocket.isAll, $history.pocket.isFund, $history.pocket.tasks);
  };


  /**
   * Select overview as current pocket
   */
  $scope.selectOverview = function() {
      $scope.historyRows = $scope.selectPocket('overview');

      // Set the selected pocket
      $scope.selectedPocket = $history.selectedPocket;
  }


  /**
   * Select an hd pocket
   */
  $scope.selectPocket = function(pocketName, rowIndex, form) {
      if (pocketName === undefined || pocketName == 'overview') {
          $scope.historyRows = $history.selectAll(pocketName, rowIndex);
      } else {
          $scope.historyRows = $history.selectPocket(pocketName, rowIndex);

          $scope.forms.pocketLabelForm = form;
      }

      // Set the selected pocket
      $scope.selectedPocket = $history.selectedPocket;

      // Update tabs
      $scope.tabs.updateTabs($scope.pocket.isAll, $scope.pocket.isFund, $scope.pocket.tasks);
  };


  /**
   * Start creating a new multisig
   */
  $scope.newMultiSig = function() {
      $scope.selectedPocket = 'newMultisig';
  };


  /**
   * History filter
   */
  $scope.pocketFilter = function(row) {
      return $history.pocketFilter(row);
  };

  // Set the history filter
  $scope.setHistoryFilter = function(name) {
      $scope.txFilter = name;
      $scope.historyRows = $history.setHistoryFilter(name);
  };

  $scope.historyFilter = function(row, shownRows) {
      return $history.historyFilter(row, shownRows);
  };


}]);
});
