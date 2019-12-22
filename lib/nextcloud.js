const request = require('request');
const xml2js = require('xml2js');

/**
 * Get the contact list.
 * @param {string} host The host of the Nexcloud server like https://nextcloud.example.com
 * @param {string} username Username of the Nextcloud account
 * @param {string} password Password of the Nextcloud account
 * @returns {Promise<Object>} Object
 */
async function queryContactList(host, username, password) {

    const path = '/remote.php/dav/addressbooks/users/' + username + '/contacts/';
    const url = host + path;

    const auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

    const options = {
        url: url,
        method: 'PROPFIND',
        headers: {
            'Authorization' : auth
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
            <d:propfind xmlns:d="DAV:">
            </d:propfind>`
    };

    return new Promise(function (resolve, reject) {

        request(options, (error, response, body) => {

            if(!error && (response.statusCode == 200 || response.statusCode == 207)) {

                const parser = new xml2js.Parser();
                
                parser.parseString(body, function (err, result) {
                    
                    const response = JSON.parse(JSON.stringify(result).replace(/d:/g, '').replace(/xmlns:/g, '')).multistatus.response;
                    
                    resolve(response);
                });

            } else {
                reject(error);
            }
        });
    });
}

/**
 * Get the contact list.
 * @param {string} host The host of the Nexcloud server like https://nextcloud.example.com
 * @param {string} path The path to the contact file
 * @param {string} username Username of the Nextcloud account
 * @param {string} password Password of the Nextcloud account
 * @returns {Promise<Object>} Object
 */
async function queryContact(host, path, username, password) {
    
    const url = host + path;

    const auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

    const options = {
        url: url,
        method: 'GET',
        headers: {
            'Authorization' : auth
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
            <d:propfind xmlns:d="DAV:">
            </d:propfind>`
    };

    return new Promise(function (resolve, reject) {

        request(options, (error, response, body) => {
            if (!error && (response.statusCode == 200 || response.statusCode == 207)) {
                resolve(body);
            } else {
                reject(error);
            }
        });
    });      
}

module.exports = {
    queryContactList,
    queryContact
};