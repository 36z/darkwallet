'use strict';

define(['./module', 'darkwallet', 'bitcoinjs-lib', 'frontend/port'], function (controllers, DarkWallet, Bitcoin, Port) {

  // Controller
  controllers.controller('ToolsCtrl', ['$scope', 'notify', function($scope, notify) {

  $scope.tools = {status: 'OK'};
  $scope.storeSize = 0;
  $scope.totalStoreSize = 0;

  var loadIdentity = function(name) {
      console.log("getting", name);
      DarkWallet.getKeyRing().getSize(name, function(value) {
          $scope.storeSize = Math.ceil(value/1024);
          console.log("partial", value);
          if(!$scope.$$phase) {
              $scope.$apply();
          }
      });
      DarkWallet.getKeyRing().getSize(null, function(value) {
          $scope.totalStoreSize = Math.ceil(value/1024);
          console.log("total", value);
          if(!$scope.$$phase) {
              $scope.$apply();
          }
      });
  };

  Port.connectNg('wallet', $scope, function(data) {
    if (data.type == 'ready') {
        loadIdentity(data.identity);
    }
  });


  var finishClearStorage = function() {
      var keyRing = DarkWallet.getKeyRing();
      keyRing.clear();
      notify.note('Storage cleared, please restart your browser.');
  }


  // Clear the local storage
  $scope.clearStorage = function() {
      $scope.openModal('confirm-delete', {name: 'Your WHOLE storage', object: {}}, finishClearStorage)
  };
  
  // Clear all tasks
  $scope.clearTasks = function() {
      var identity = DarkWallet.getIdentity();
      identity.tasks.clear();
      notify.note('Tasks cleared.');
  };


  /**
   * Message formatting
   */

  var SIGHEADER = '-----BEGIN BITCOIN SIGNED MESSAGE-----\n';
  var SIGINIT = '\n-----BEGIN BITCOIN SIGNATURE-----\n';
  var SIGEND = '\n-----END BITCOIN SIGNATURE-----';

  var parseText = function(text) {
      var initHead = text.indexOf(SIGHEADER);

      if (initHead == -1) {
          throw Error('Not a bitcoin signed message');
      }
      var message = text.substring(initHead);
      var initText = message.indexOf('\n\n');
      var initSigHead = message.indexOf(SIGINIT);
      if (initSigHead == -1) {
          throw Error('Message is incomplete');
      }
      var initSig = message.substring(initSigHead).indexOf('\n\n');
      var endSig = message.indexOf(SIGEND);

      if (endSig == -1) {
          throw Error('Message is incomplete');
      }
      var initAddress = message.indexOf('Address: ');
      var endAddress = message.substring(initAddress).indexOf('\n');
      var address = message.substring(initAddress+9, initAddress+endAddress);

      var resText = message.substring(initText+2, initSigHead);
      var resSig = message.substring(initSigHead+initSig+2, endSig);

      var sigBase64 = resSig.split('\n').join('');

      return {text: resText, signature: sigBase64, address: address};
  }

  /**
   * Format text address and signatures as one message
   */
  var formatText = function(text, address, signature) {
      var formatted = SIGHEADER;
      formatted += 'Address: '+address+'\n';
      formatted += 'Hash: SHA256\n\n';
      formatted += text;
      formatted += SIGINIT;
      formatted += 'Version: GnuPG v1.4.12 (GNU/Linux)\n\n';
      var i = 0;
      while(i*64 < signature.length) {
          formatted += signature.substr(i*64, (i+1)*64)+'\n';
          i += 1;
      }
      formatted += SIGEND;
      return formatted;
  };


  /**
   * Verify a signature
   */

  $scope.verifyText = function() {
      var address = $scope.tools.verifyAddress;
      var sigText = $scope.tools.verifySig;
      var text = $scope.tools.verifyText;

      if (!sigText) {
          var parsed;
          try {
              parsed = parseText(text);
          } catch(e) {
              notify.error('Error decoding', e.message);
              return;
          }
          sigText = parsed.signature;
          if (!address) {
              address = parsed.address;
          }
          text = parsed.text;
      }
      if (!sigText || !address) {
          notify.error('Could not find address or signature');
          return;
      }
      var sig = Bitcoin.convert.base64ToBytes(sigText);
      var res = Bitcoin.Message.verify(address, sig, text);
      if (res) {
          $scope.tools.status = 'signature ok by ' + address;
          notify.success('Signature ok');
      } else {
          $scope.tools.status = 'invalid signature';
          notify.warning('Invalid signature');
      }
      $scope.tools.output = '';
      $scope.verifyOpen = false;
      $scope.tools.open = false;
  }


  /**
   * Sign and verify the given text
   */
  var signText = function(privKey, address, text) {
      var sig = Bitcoin.Message.sign(privKey, text);

      var res = Bitcoin.Message.verify(address, sig, text);

      var sigText = Bitcoin.convert.bytesToBase64(sig);

      return sigText;
  };

  /**
   * Sign the given text
   */
  $scope.signText = function() {
      var text = $scope.tools.signText;
      var address = $scope.tools.signAddress;
      var identity = DarkWallet.getIdentity();
      var walletAddress = identity.wallet.getWalletAddress(address);
      if (!walletAddress) {
          notify.warning("Incorrect address for this wallet");
      } else {
          $scope.openModal('ask-password', {text: 'Unlock password', password: ''}, function(password) {
              try {
                  identity.wallet.getPrivateKey(walletAddress.index, password, function(privKey) {
                      var signature = signText(privKey, walletAddress.address, text);
                      $scope.tools.output = formatText(text, address, signature);
                      $scope.tools.status = 'ok';
                      $scope.tools.signOpen = false;
                      $scope.tools.open = false;
                      notify.success("Signed");
                  });
              } catch (e) {
                  notify.error('Incorrect password', e.message);
              }
          } );
      }
  } 

}]);
});
