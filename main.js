'use strict';

/*
 * Created with @iobroker/create-adapter v1.18.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const express = require('express');
const http = require('http');
const cron = require('node-cron');
const {google} = require('googleapis');

let adapter;

let oauth2;
const googleScope = 'https://www.googleapis.com/auth/contacts.readonly';

const objectCommon = {
    familyName:     {name: 'Family Name',       type: 'string',     role: 'contact.familyName'},
    givenName:      {name: 'Given Name',        type: 'string',     role: 'contact.givenName'},
    photo:          {name: 'Photo',             type: 'string',     role: 'contact.photo'},
    streetAddress:  {name: 'Street Address',    type: 'string',     role: 'contact.streetAddress'},
    city:           {name: 'City',              type: 'string',     role: 'contact.city'},
    postalCode:     {name: 'Postal Code',       type: 'string',     role: 'contact.postalCode'},
    country:        {name: 'Country',           type: 'string',     role: 'contact.country'},
    emailAddresses: {name: 'Email Addresses',   type: 'string',     role: 'contact.emailAddresses'},
    phoneNumbers:   {name: 'Phone Numbers',     type: 'string',     role: 'contact.phoneNumbers'}
};

let contacts = [];

class Contact extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'contact',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {

        if(!String.prototype.startsWith) {
            String.prototype.startsWith = function(searchString, position) {
                position = position || 0;
                return this.indexOf(searchString, position) === position;
            };
        }

        if(this.config.googleActive) {
            oauth2 = getGoogleAuthentication(adapter.config);
        }

        if(hasAccountWithoutGrantPermission(adapter.config)) {
            initServer(adapter.config);
        }

        if(this.config.googleActive) {
            if(oauth2) {
                startSchedule(adapter.config, oauth2);
            }
        }

        adapter.setObjectNotExistsAsync('query', {
            type: 'state',
            common: {
                name: 'Query phone number',
                type: 'string',
                role: 'contact.query',
                read: true,
                write: true
            },
            native: {},
        });
        //adapter.setStateAsync('query', { val: '', ack: true });

        addState('familyName', 'Queried family name', 'string', 'contact.familyName');
        addState('givenName', 'Queried given name', 'string', 'contact.givenName');
        addState('photo', 'Queried photo', 'string', 'contact.photo');
        addState('id', 'Queried id', 'string', 'contact.id');

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            //this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            //this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            //this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {

        if(id == adapter.namespace + '.query') {
            if(state) {
                if(state.ack == false) {
                    const number = state.val;
                    queryContactByPhoneNumber(number);
                }
            }
        }
    }
}

function queryContactByPhoneNumber(number) {

    number = cleanPhoneNumber(number);

    adapter.log.debug('Queried phonenumber: ' + number);

    for(let i = 0; i < contacts.length; i++) {
        for(let j = 0; j < contacts[i].phoneNumbers.length; j++) {

            const tmpNumber = cleanPhoneNumber(contacts[i].phoneNumbers[j].value);

            adapter.log.debug('Compared phonenumber: ' + tmpNumber);

            if(tmpNumber == number) {
                addState('familyName', 'Queried family name', 'string', 'contact.familyName', contacts[i].familyName);
                addState('givenName', 'Queried given name', 'string', 'contact.givenName', contacts[i].givenName);
                addState('photo', 'Queried photo', 'string', 'contact.photo', contacts[i].photo);
                addState('id', 'Queried id', 'string', 'contact.id', contacts[i].id);

                return;
            }
        }
    }

    addState('familyName', 'Queried family name', 'string', 'contact.familyName', '');
    addState('givenName', 'Queried given name', 'string', 'contact.givenName', '');
    addState('photo', 'Queried photo', 'string', 'contact.photo', '');
    addState('id', 'Queried id', 'string', 'contact.id', '');
}

function cleanPhoneNumber(number) {
    
    number = number.replace(/[+/()\-\\ ]/g, '');

    if(number.startsWith('00')) {
        number = number.replace('00', '');
    }

    if(number.startsWith('0')) {
        number = number.replace('0', '49');
    }

    return number;
}

async function updateConfig(newConfig) {
    // Create the config object
    const config = {
        ...adapter.config,
        ...newConfig,
    };
    // Update the adapter object
    const adapterObj = await adapter.getForeignObjectAsync(`system.adapter.${adapter.namespace}`);
    adapterObj.native = config;
    await adapter.setForeignObjectAsync(`system.adapter.${adapter.namespace}`, adapterObj);
}

function startSchedule(config, auth) {

    const googleAccount = config.google;
    
    for(let i = 0; i < googleAccount.length; i++) {
        getGoogleContacts(googleAccount[i], auth, i);
    }

    //0 */10 * * *

    const hours = googleAccount[0].hours;
    let cronInterval = '0 */';

    if(hours && hours > 0 && hours <= 24) {
        cronInterval += hours + ' * * *';
    } else {
        cronInterval += 12 + ' * * *';
    }

    cron.schedule(cronInterval, () => {
        for(let i = 0; i < googleAccount.length; i++) {
            getGoogleContacts(googleAccount[i], auth, i);
        }
    });
}

function manageContacts(contactList) {
    
    const contactIds = [];

    contacts = [];

    adapter.getChannels(function (err, channels) {

        contactList.forEach((person) => {

            if (person.names && person.names.length > 0) {
                contactIds.push(addContact(person));
            } else {
                adapter.log.info('No display name found for connection.');
            }
        });
    
        removeUnused(channels, contactIds);
    });
}

function removeUnused(oldList, newList) {

    for(let i = 0; i < oldList.length; i++) {

        let inNewList = false;

        for(let j = 0; j < newList.length; j++) {
            if(newList[j] == oldList[i]._id.split('.')[2]) {
                inNewList = true;
            }
        }

        if(inNewList == false) {
            adapter.log.warn(oldList[i]._id);
            adapter.deleteChannel(oldList[i]._id);
        }
    }
}

function removeChannel(id) {

    adapter.getChannels(function (err, channels) {

        for(let i = 0; i < channels.length; i++) {
            if(id == channels[i]._id) {
                adapter.deleteChannel(id);
            }
        }
    });
}

function addChannel(id, name) {
    adapter.setObjectNotExistsAsync(id, {
        type: 'channel',
        common: {
            name: name,
        },
        native: {},
    });
}

function addState(id, name, type, role, value = null) {
    adapter.setObjectNotExistsAsync(id, {
        type: 'state',
        common: {
            name: name,
            type: type,
            role: role,
            read: true,
            write: false
        },
        native: {},
    });
    if(value != null) {
        adapter.setStateAsync(id, { val: value, ack: true });
    }
}

function addContact(contact) {
    
    const contactJson = {};

    const contactId = contact.names[0].metadata.source.id;

    //Add contact channel
    addChannel(contactId, contact.names[0].displayNameLastFirst);
    contactJson.id = contactId;

    const familyName = objectCommon.familyName;
    addState(contactId + '.familyName', familyName.name, familyName.type, familyName.role, contact.names[0].familyName);
    contactJson.familyName = contact.names[0].familyName;

    const givenName = objectCommon.givenName;
    addState(contactId + '.givenName', givenName.name, givenName.type, givenName.role, contact.names[0].givenName);
    contactJson.givenName = contact.names[0].givenName;

    const photo = objectCommon.photo;
    addState(contactId + '.photo', photo.name, photo.type, photo.role, contact.photos[0].url);
    contactJson.photo = contact.photos[0].url;

    if(contact.addresses) {
        //Add addresses channel
        addChannel(contactId + '.addresses', 'Addresses');

        const streetAddress = objectCommon.streetAddress;
        const city = objectCommon.city;
        const postalCode = objectCommon.postalCode;
        const country = objectCommon.country;

        for(let i = 0; i < contact.addresses.length; i++) {
            
            const address = contact.addresses[i];

            addState(contactId + '.addresses.' + i + '.streetAddress', streetAddress.name, streetAddress.type, streetAddress.role, address.streetAddress);
            addState(contactId + '.addresses.' + i + '.city', city.name, city.type, city.role, address.city);
            addState(contactId + '.addresses.' + i + '.postalCode', postalCode.name, postalCode.type, postalCode.role, address.postalCode);
            addState(contactId + '.addresses.' + i + '.country', country.name, country.type, country.role, address.country);
        }
    } else removeChannel(contactId + '.addresses');

    const contactJsonNumbers = [];

    if(contact.phoneNumbers) {
        //Add phonenumbers channel
        addChannel(contactId + '.phoneNumbers', 'Phone Numbers');

        const phoneNumbers = objectCommon.phoneNumbers;

        for(let i = 0; i < contact.phoneNumbers.length; i++) {
            
            const phoneNumber = contact.phoneNumbers[i];

            addState(contactId + '.phoneNumbers.' + i, phoneNumbers.name, phoneNumbers.type, phoneNumbers.role, phoneNumber.value);
            contactJsonNumbers.push({value: phoneNumber.value});
        }
    } else removeChannel(contactId + '.phoneNumbers');
    contactJson.phoneNumbers = contactJsonNumbers;

    if(contact.emailAddresses) {

        //Add emailaddresses channel
        addChannel(contactId + '.emailAddresses', 'Email Addresses');

        const emailAddresses = objectCommon.emailAddresses;

        for(let i = 0; i < contact.emailAddresses.length; i++) {
            
            const emailAddress = contact.emailAddresses[i];
            
            addState(contactId + '.emailAddresses.' + i, emailAddresses.name, emailAddresses.type, emailAddresses.role, emailAddress.value);
        }
    } else removeChannel(contactId + '.emailAddresses');

    contacts.push(contactJson);

    return contactId;
}

function getGoogleContacts(account, auth, index) {

    if(account.accessToken && account.refreshToken && account.refreshToken != ''/* && account.id != '' //Comming soon*/) {

        const oauth2 = auth;
        oauth2.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken
        });

        const cal = google.people({
            version: 'v1',
            auth: oauth2
        });

        cal.people.connections.list({
            resourceName: 'people/me',
            /*pageSize: 10,*/
            personFields: 'names,emailAddresses,photos,phoneNumbers,addresses',
        }, (err, res) => {
            if (err) return adapter.log.info('The API returned an error: ' + err);
            if(res) {
                const connections = res.data.connections;
                if (connections) {
                    manageContacts(connections);
                    adapter.log.info(`Contacts for account "${account.name}" have been updated.`);
                } else {
                    adapter.log.info('No connections found.');
                }
            } else adapter.log.info('No response found.');
        });
    } else adapter.log.warn(`No permission granted for account "${account.name}". Please visit http://${adapter.config.fqdn}:${adapter.config.port}/google/login/${index}`);
}

function hasAccountWithoutGrantPermission(config) {

    if(config.googleActive) {

        const googleAccount = config.google;

        for(let i = 0; i < googleAccount.length; i++) {
            if(!googleAccount[i].accessToken || !googleAccount[i].refreshToken || googleAccount[i].refreshToken == '') {
                return true;
            }
        }
    }

    return false;
}

function getGoogleAuthentication(settings) {

    let oauth2 = null;

    if(settings.googleClientID && settings.googleClientSecret && settings.fqdn && settings.port)  {
        oauth2 = new google.auth.OAuth2(settings.googleClientID, settings.googleClientSecret, `http://${settings.fqdn}:${settings.port}/google`);
    } else adapter.log.warn('Client id, client secret, fqdn or port missing for google account.');

    return oauth2;
}

function initServer(settings) {

    let server;

    if(settings.port) {

        server = {
            app: express(),
            server: null,
            settings:  settings
        };

        if(oauth2) {
            server.app.get('/google/login/:id', function (req, res) {

                const id = req.params.id;
                
                //Check if account id exists
                if(id < settings.google.length && id >= 0) {

                    const account = settings.google[id];

                    //Check if a refresh token exists
                    if(!account.refreshToken) {

                        const url = oauth2.generateAuthUrl({
                            scope: googleScope,
                            //include_granted_scopes: true,
                            state: id,
                            //response_type: 'token',
                            access_type: 'offline'
                        });

                        res.redirect(url);
                    } else res.send(`The rights for account ${req.params.id} have already been granted.`); 
                } else res.send(`Cannot find account ${req.params.id}.`);
            });

            server.app.get('/google/success', function (req, res) {
                res.send('Done');
            });

            server.app.get('/google', function (req, res) {
                if(req.query) {
                    if(req.query.state) {
                        if(req.query.state < settings.google.length && req.query.state >= 0) {
                            if(req.query.scope) {
                                const scope = req.query.scope.split(' ');
                                let isRightScope = false;
                                
                                for(let i = 0; i < scope.length; i++) {
                                    if(scope[i] == googleScope) {

                                        oauth2.getToken(req.query.code, function(err, tokens) {

                                            if (err) {
                                                adapter.log.error(err);
                                                res.send(err);
                                                return;
                                            }
                                        
                                            adapter.log.info(`Received rights for google account ${req.query.state} (${settings.google[req.query.state].name})`);
                                            
                                            oauth2.setCredentials(tokens);

                                            const configGoogle = adapter.config.google;

                                            configGoogle[req.query.state].accessToken = tokens.access_token;
                                            configGoogle[req.query.state].refreshToken = tokens.refresh_token;

                                            updateConfig({
                                                google: configGoogle
                                            });
                                        });

                                        isRightScope = true;
                                    }
                                }

                                if(isRightScope) {
                                    res.redirect('/google/success');
                                } else res.send('Wrong scope were defined');
                            } else res.send('No scope were defined');
                        } else res.send(`Account ${req.query.state} not found`);
                    } else res.send('No account defined');
                } else res.send('No parameters were passed');            
            });
        }
        
        server.server = http.createServer(server.app);
    } else {
        adapter.log.error('Port is missing');
    }

    if(server && server.server) {
        adapter.getPort(settings.port, function (port) {
            if (port != settings.port && !adapter.config.findNextPort) {
                adapter.log.error('Port ' + settings.port + ' already in use');
                process.exit(1);
            }

            server.server.listen(port);
        });
    }

    if(server && server.app) {
        return server;
    } else {
        return null;
    }
}

function startAdapter(options) {

    const opts = options || {};

    adapter = new Contact(opts);

    return adapter;
}


// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => startAdapter(options);
} else {
    // otherwise start the instance directly
    startAdapter();
}