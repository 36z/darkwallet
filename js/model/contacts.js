/**
 * @fileOverview Contacts (Address book).
 */

define(['bitcoinjs-lib', 'util/btc'], function(Bitcoin, BtcUtils) {

var Crypto = Bitcoin.Crypto;

/**
 * Contacts class.
 * @param {Object} store Object store
 * @constructor
 */
function Contacts(store) {
  this.store = store;
  this.contacts = this.store.init('contacts', []);
  this.initContacts();
}

/**
 * Update contacts after loading them.
 * @private
 */
Contacts.prototype.initContacts = function() {
  var self = this;
  // TODO Remove when Darkwallet 1.0 release
  if (!Array.isArray(this.contacts)) {
    this.contacts = [];
    this.store.set('contacts', this.contacts);
    this.store.save();
  }
  this.contacts.forEach(function(contact) {
      if (contact && !contact.hash) {
          self.updateContactHash(contact);
      }
  });
}

/**
 * Update fingerprint hash for a contact
 */
Contacts.prototype.updateContactHash = function(contact) {
    contact.hash = Crypto.SHA256(contact.address).toString();
}

/**
 * Find Contact
 * @param {Object} data Contact information.
 */
Contacts.prototype.findByPubKey = function (pubKey) {
  var toCheck = pubKey.toString();
  var compressed = (pubKey.length == 33);
  for(var i=0; i<this.contacts.length; i++) {
    var address = this.contacts[i].address;
    var cPubKey;
    try {
        cPubKey = BtcUtils.extractPublicKey(address, compressed);
    } catch(e) {
        // not a good address
        continue;
    }
    if (cPubKey.toString() == toCheck) {
      return this.contacts[i];
    }
  }
};


/**
 * Add a contact to the address book
 * @param {Object} data Contact information.
 */
Contacts.prototype.addContact = function (data) {
  this.updateContactHash(data);
  this.contacts.push(data);
  this.store.save();
};

/**
 * Edit a contact in the address book
 */
Contacts.prototype.updateContact = function (contact) {
  if (this.contacts.indexOf(contact) == -1) {
    throw Error("This is not an already existing contact!");
  }
  this.updateContactHash(contact);
  this.store.save();
};


/**
 * Delete a contact from the address book
 * @param {String} data Contact information.
 */
Contacts.prototype.deleteContact = function (contact) {
  var i = this.contacts.indexOf(contact);
  if (i == -1) {
    throw Error("Contact does not exist!");
  }
  this.contacts.splice(i, 1);
  this.store.save();
};

return Contacts;
});
