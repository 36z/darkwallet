'use strict';

define(['bitcoinjs-lib'], function(Bitcoin) {

  /*
   * CoinJoin Class
   * @constructor
   */
  function CoinJoin(core, role, state, tx, myAmount, fee) {
    this.core = core;
    this.state = state;
    this.role = role;
    this.myTx = tx;
    this.myAmount = myAmount;
    this.fee = fee;
  }

  /*
   * CoinJoin State machine once paired
   * 1st message guest -> [initiator]
   */
  CoinJoin.prototype.fullfill = function(msg) {
      // Check there is one output like we want to join
      var amount = this.myAmount;
      var remoteTx = new Bitcoin.Transaction(msg.tx);
      console.log("fullfill", msg, remoteTx, amount);
      var isOk = false;
      remoteTx.outs.forEach(function(anOut) {
          console.log("check", anOut.value, amount);
          if (anOut.value == amount) {
              isOk = true;
          }
      });
      if (!isOk) {
          console.log("no output found with the right value");
          return;
      }
      // Now check there are inputs with enough funds
      isOk = false;

      // Now add our inputs and outputs after the ones from guest
      var myTx = this.myTx;
      myTx.ins.forEach(function(anIn) {
          remoteTx.addInput(anIn.clone());
      });
      myTx.outs.forEach(function(anOut) {
          remoteTx.addOutput(anOut.clone());
      });

      // Save tx
      this.tx = remoteTx;
      this.state = 'fullfilled';
      return remoteTx;
  };

  /*
   * 1st message initiator -> [guest]
   */
  CoinJoin.prototype.sign = function(msg) {
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check the original inputs and outputs are there
      if (!this.checkMyInputsOutputs(this.myTx, remoteTx)) {
          return;
      }

      // Needs signing of inputs
      this.tx = remoteTx;
      this.state = 'sign';
  };

  /*
   * Add signatures manually
   * tx: Transaction with user inputs signed
   */
  CoinJoin.prototype.addSignatures = function(tx) {
      // Save tx
      // TODO: maybe check signatures, but they come from the application here
      this.tx = tx;
      if (this.role == 'initiator') {
          this.state = 'finished';
      } else {
          this.state = 'signed';
      }
      return tx;
  }

  /*
   * 2nd message guest -> [initiator]
   */
  CoinJoin.prototype.finishInitiator = function(msg) {
      var myTx = this.tx;
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check no new inputs or outputs where added
      if (!this.checkInputsOutputs(myTx, remoteTx)) {
          return;
      }

      // Check the guest signed

      // Now sign our input(s) against the outputs
      this.tx = remoteTx;
      this.state = 'sign';
  };

  /*
   * 2nd message initiator -> [guest]
   */
  CoinJoin.prototype.finishGuest = function(msg) {
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check no new inputs or outputs where added
      if (!this.checkInputsOutputs(this.tx, remoteTx)) {
          return;
      }

      // Check our signatures are there

      // Check the inititator signed
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // We are done here...

      // Save tx
      this.state = 'finished';
      this.tx = remoteTx;
      return remoteTx;
  };

  /*
   * Process a message for an ongoing CoinJoin
   */
  CoinJoin.prototype.process = function(msg) {
      switch (this.state) {
          case 'announce':
              // 1. If initiator, comes with new input and outputs from guest
              return this.fullfill(msg);
          case 'accepted':
              // 2. If guest, comes with full tx, check and sign
              return this.sign(msg);
          case 'fullfilled':
              // 3. Initiator finally signs his part
              return this.finishInitiator(msg);
          case 'signed':
              // 4. Guest getting the final transaction
              return this.finishGuest(msg);
      }
  };

  CoinJoin.prototype.cancel = function() {
      if (this.role == 'initiator') {
          // Back to announce state
          this.state = 'announce';
      }
      else if (this.role == 'guest') {
          this.state = 'cancelled';
      }
  };

  /*
   * Process a message finishing a coinjoin conversation
   */
  CoinJoin.prototype.kill = function() {

     switch(this.state) {
         case 'accepted':
         case 'fullfilled':
         case 'signed':
             this.cancel();
             break;
         case 'finished':
         case 'announce':
         default:
             // do nothing
             break;
     }

  };

  /*
   * Helper functions
   */
  CoinJoin.prototype.checkInputsOutputs = function(origTx, newTx) {
      var isValid = true;
      if (origTx.ins.length != newTx.ins.length) return false;
      if (origTx.outs.length != newTx.outs.length) return false;

      isValid = this.checkMyInputsOutputs(origTx, newTx);

      return isValid;
  };

  CoinJoin.prototype.checkMyInputsOutputs = function(origTx, newTx) {
      for(var i=0; i<origTx.ins.length; i++) {
          // TODO: should check the scripts too
          var origInP = origTx.ins[i].outpoint;
          var found = newTx.ins.filter(function(newIn) {
              return (origInP.hash == newIn.outpoint.hash) && (parseInt(origInP.index) == parseInt(newIn.outpoint.index));
          });
          if (found.length != 1) return false;
      }
      for(var i=0; i<origTx.outs.length; i++) {
          var origOut = origTx.outs[i];
          var found = newTx.outs.filter(function(newOut) {
             return (origOut.address.toString() == newOut.address.toString()) && (origOut.value == newOut.value);
          });
          if (found.length != 1) return false;
      }
      return true;
  };


  return CoinJoin;

});
