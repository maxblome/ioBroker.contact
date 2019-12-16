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

class Calendar extends utils.Adapter {

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

        if(this.config.googleActive) {
            oauth2 = getGoogleAuthentication(adapter.config);
        }

        if(hasCalendarWithoutGrantPermission(adapter.config)) {
            initServer(adapter.config);
        }

        if(this.config.googleActive) {
            if(oauth2) {
                startSchedule(adapter.config, oauth2);
            }
        }

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
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }

}

function getDatetime(add = 0, hours = 0, mins = 0, secs = 0) {
    // current timestamp in milliseconds
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + add);
    dateObj.setHours(hours);
    dateObj.setMinutes(mins);
    dateObj.setSeconds(secs);
    const date = (`0${dateObj.getDate()}`).slice(-2);
    const month = (`0${dateObj.getMonth() + 1}`).slice(-2);
    const year = dateObj.getFullYear();
    const hour = (`0${dateObj.getHours()}`).slice(-2);
    const min = (`0${dateObj.getMinutes()}`).slice(-2);
    const sec = (`0${dateObj.getSeconds()}`).slice(-2);

    // prints date & time in YYYY-MM-DD format 2011-06-03T10:00:00Z
    return `${year}-${month}-${date}T${hour}:${min}:${sec}Z`;
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

    const googleCalendars = config.google;
    
    for(let i = 0; i < googleCalendars.length; i++) {
        getGoogleCalendarEvents(googleCalendars[i], auth, i);
    }

    cron.schedule('*/5 * * * *', () => {
        for(let i = 0; i < googleCalendars.length; i++) {
            getGoogleCalendarEvents(googleCalendars[i], auth, i);
        }
    });
}

function sameDate(targetDate, calendarDate) {

    targetDate = targetDate.substr(0, 10);
    calendarDate = calendarDate.substr(0, 10);

    if(targetDate == calendarDate) {
        return true;
    } else return false;
}

function addContact(contact) {
    
    const contactId = contact.names[0].metadata.source.id;

    adapter.setObjectNotExistsAsync(contactId, {
        type: 'channel',
        common: {
            name: contact.names[0].displayNameLastFirst,
        },
        native: {},
    });

    adapter.setObjectNotExistsAsync(contactId + `.familyName`, {
        type: 'state',
        common: {
            name: 'Summary',
            type: 'string',
            role: 'contact.name',
            read: false,
            write: false
        },
        native: {},
    });
    adapter.setStateAsync(contactId + `.familyName`, { val: contact.names[0].familyName, ack: true });

    adapter.setObjectNotExistsAsync(contactId + `.givenName`, {
        type: 'state',
        common: {
            name: 'Summary',
            type: 'string',
            role: 'contact.name',
            read: false,
            write: false
        },
        native: {},
    });

    adapter.setStateAsync(contactId + `.givenName`, { val: contact.names[0].givenName, ack: true });

    adapter.setObjectNotExistsAsync(contactId + `.photo`, {
        type: 'state',
        common: {
            name: 'Summary',
            type: 'string',
            role: 'contact.name',
            read: false,
            write: false
        },
        native: {},
    });

    adapter.setStateAsync(contactId + `.photo`, { val: contact.photos[0].url, ack: true });
}

function getGoogleCalendarEvents(calendar, auth, index) {

    if(calendar.accessToken && calendar.refreshToken && calendar.refreshToken != '' && calendar.id != '') {

        const oauth2 = auth;
        oauth2.setCredentials({
            access_token: calendar.accessToken,
            refresh_token: calendar.refreshToken
        });

        const cal = google.people({
            version: 'v1',
            auth: oauth2
        });

        cal.people.connections.list({
            resourceName: 'people/me',
            pageSize: 10,
            personFields: 'names,emailAddresses,photos,phoneNumbers,urls,addresses',
          }, (err, res) => {
            if (err) return adapter.log.info('The API returned an error: ' + err);
            const connections = res.data.connections;
            if (connections) {
              adapter.log.info('Connections:');
              connections.forEach((person) => {
                if (person.names && person.names.length > 0) {
                    adapter.log.info(JSON.stringify(person.names[0].displayName));
                    addContact(person);
                } else {
                    adapter.log.info('No display name found for connection.');
                }
              });
            } else {
                adapter.log.info('No connections found.');
            }
        });
    } else adapter.log.warn(`No permission granted for calendar "${calendar.name}". Please visit http://${adapter.config.fqdn}:${adapter.config.port}/google/login/${index}`);
}

function hasCalendarWithoutGrantPermission(config) {

    if(config.googleActive) {

        const googleCalendars = config.google;

        for(let i = 0; i < googleCalendars.length; i++) {
            if(!googleCalendars[i].accessToken || !googleCalendars[i].refreshToken || googleCalendars[i].refreshToken == '') {
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
    } else adapter.log.warn('Client id, client secret, fqdn or port missing for google calendar.');

    return oauth2;
}

function getGoogleCalendarId(index, auth, callback) {

    let id = [];

    const cal = google.calendar({
        version: 'v3',
        auth: auth
    });

    cal.calendarList.list((err, res) => {
        if (err) {
            adapter.log.error('The Google API returned an error.');
            adapter.log.error(err);
            callback(id);
        }

        if(res) {
            const items = res.data.items;
            if(items) {
                if(items.length === 0) {
                    adapter.log.warn('No calendar id found.');
                } else {
                    const calendarId = items[0].id || '';

                    id.push(calendarId);
                    id.push(new Buffer(calendarId).toString('base64').replace('=', '').replace('+', '').replace('/', ''));

                    callback(id);
                }
            }
        }
    });
}

function initServer(settings) {

    let server;

    if(settings.port) {

        server = {
            app: express(),
            server: null ,
            settings:  settings
        };

        if(oauth2) {
            server.app.get('/google/login/:id', function (req, res) {

                const id = req.params.id;
                
                //Check if calendar id exists
                if(id < settings.google.length && id >= 0) {

                    const calendar = settings.google[id];

                    //Check if a refresh token exists
                    if(!calendar.refreshToken) {

                        const url = oauth2.generateAuthUrl({
                            scope: googleScope,
                            //include_granted_scopes: true,
                            state: id,
                            //response_type: 'token',
                            access_type: 'offline'
                        });

                        res.redirect(url);
                    } else res.send(`The rights for calendar ${req.params.id} have already been granted.`); 
                } else res.send(`Cannot find calendar ${req.params.id}.`);
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
                                        
                                            adapter.log.info(`Received rights for google calendar ${req.query.state} (${settings.google[req.query.state].name})`);
                                            
                                            //settings.google[req.query.state].oauth2 = oauth2;
                                            oauth2.setCredentials(tokens);
                                            
                                            getGoogleCalendarId(req.query.state, oauth2, (id) => {

                                                let configGoogle = adapter.config.google;
                                                
                                                configGoogle[req.query.state].id = id[1];
                                                configGoogle[req.query.state].email = id[0];
                                                configGoogle[req.query.state].accessToken = tokens.access_token;
                                                configGoogle[req.query.state].refreshToken = tokens.refresh_token;

                                                /*adapter.setObjectNotExistsAsync(id[1] + '.email', {
                                                    type: 'state',
                                                    common: {
                                                        name: 'E-Mail',
                                                        type: 'string',
                                                        role: 'email',
                                                        read: false,
                                                        write: false
                                                    },
                                                    native: {},
                                                });
                            
                                                adapter.setStateAsync(id[1] + '.email', { val: id[0], ack: true });*/

                                                updateConfig({
                                                    google: configGoogle
                                                });
                                            });
                                        });

                                        isRightScope = true;
                                    }
                                }

                                if(isRightScope) {
                                    res.redirect('/google/success');
                                } else res.send('Wrong scope were defined');
                            } else res.send('No scope were defined');
                        } else res.send(`Calendar ${req.query.state} not found`);
                    } else res.send('No calendar defined');
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

    adapter = new Calendar(opts);

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