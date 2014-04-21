/**
 * @fileOverview ContactsCtrl angular controller
 */
'use strict';

define(['angular-mocks', 'testUtils'], function (mocks, testUtils) {

  describe('Contacts controller', function() {
    var contactsController, scope, routeParams, location, _contacts, DarkWallet;

    var identity = {
      contacts: {
        contacts: _contacts,
        addContact: function(newContact) {
          identity.contacts.contacts.push(newContact);
        },
        updateContact: function(contact) {},
        deleteContact: function(contact) {}
      }
    };
    
    var resetContacts = function() {
      identity.contacts.contacts = [
        {name: "Satoshi Nakamoto", address: "address1"},
        {name: "Dorian Nakamoto", address: "address2"},
        {name: "Satoshi Forest", address: "address3"}
      ];
      _contacts = identity.contacts.contacts;
    };
    
    var injectController = function(routeParams) {
      mocks.inject(["$rootScope", "$controller", function ($rootScope, $controller) {
        scope = $rootScope.$new();
        routeParams = routeParams || {};
        location = {
          path: function(path) {
            location._path = path;
          }
        };
        contactsController = $controller('ContactsCtrl', {$scope: scope, $routeParams: routeParams, $location: location});
      }]);
    };
    
    beforeEach(function(done) {
      testUtils.stub('darkwallet', {
        getIdentity: function() {
          return identity;
        }
      });
      
      mocks.module("DarkWallet.controllers");
      
      testUtils.loadWithCurrentStubs('frontend/controllers/contacts', function() {
        resetContacts();
        injectController();
        DarkWallet = require('darkwallet');
        spyOn(identity.contacts, 'updateContact');
        spyOn(identity.contacts, 'deleteContact');
        done();
      });
    });
    
    afterEach(function() {
      testUtils.reset();
    });

    describe('', function() {

      it('is created properly', function() {
        expect(scope.newContact).toEqual({});
        expect(scope.contactToEdit).toEqual({});
        expect(scope.contactFormShown).toBe(false);
        expect(scope.contacts).toEqual(DarkWallet.getIdentity().contacts.contacts);
        expect(scope.allContacts).toEqual(DarkWallet.getIdentity().contacts.contacts);
        expect(scope.contactSearch).toBe('');
      });

      it('filters contacts', function() {
        scope.contactSearch = 'Nakamoto';
        scope.filterContacts();
        expect(scope.contacts.length).toEqual(2);
        scope.contactSearch = 'Satoshi Nakamoto';
        scope.filterContacts();
        expect(scope.contacts.length).toEqual(1);
      });

      it('creates a new contact', function() {
        var newContact = {name: 'DarkWallet donations', address: '31oSGBBNrpCiENH3XMZpiP6GTC4tad4bMy'};
        scope.newContact = newContact;
        scope.createContact();
        expect(scope.contacts).toContain(newContact);
        expect(scope.newContact).toEqual({});
        expect(scope.contactFormShown).toBe(false);
      });

      it('opens the edit form', function() {
        scope.openEditForm(_contacts[0]);
        expect(scope.contactToEdit).not.toBe(_contacts[0]);
        expect(scope.contactToEdit).toEqual(_contacts[0]);
      });

      it('opens a contact', function() {
        scope.openContact(_contacts[2]);
        expect(location._path).toBe('/contact/2');
      });

      it('edits a contact', function() {
        scope.contactToEdit = {name: 'Nakamoto Satoshi', address: '6...'};
        scope.editContact(_contacts[0]);
        expect(identity.contacts.updateContact).toHaveBeenCalledWith(scope.contactToEdit);
      });

      it('deletes a contact', function() {
        expect(_contacts[0].name).toEqual('Satoshi Nakamoto');
        expect(scope.contacts[0].name).toEqual('Satoshi Nakamoto');

        scope.deleteContact(_contacts[0]);

        expect(identity.contacts.deleteContact).toHaveBeenCalledWith(_contacts[0]);
        expect(scope.contacts[0].name).not.toEqual('Satoshi Nakamoto');
        expect(scope.contacts.length).toBe(2);
        expect(location._path).toBe('/contacts');
        
        // Deleting unexisting contact fails silently
        scope.deleteContact({});
        expect(scope.contacts.length).toBe(2);
      });
    });

    describe('initiated with route param', function() {
      it('redirects to a contact', function() {
        injectController({contactId: 2});
        expect(scope.vars.contact).toBe(_contacts[2]);
      });
    });
    
    describe('initiated with incorrect route param', function() {
      it('redirects to a contact', function() {
        injectController({contactId: -1});
        expect(location._path).toBe('/contacts');
      });
    });
  });
});
