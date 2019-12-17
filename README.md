![Logo](admin/contact.png)
# ioBroker.contact

[![NPM version](http://img.shields.io/npm/v/iobroker.contact.svg)](https://www.npmjs.com/package/iobroker.contact)
[![Downloads](https://img.shields.io/npm/dm/iobroker.contact.svg)](https://www.npmjs.com/package/iobroker.contact)
![Number of Installations (latest)](http://iobroker.live/badges/contact-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/contact-stable.svg)
[![Dependency Status](https://img.shields.io/david/WLAN-Kabel/ioBroker.contact.svg)](https://david-dm.org/WLAN-Kabel/iobroker.contact)
[![Known Vulnerabilities](https://snyk.io/test/github/WLAN-Kabel/ioBroker.contact/badge.svg)](https://snyk.io/test/github/WLAN-Kabel/ioBroker.contact)

[![NPM](https://nodei.co/npm/iobroker.contact.png?downloads=true)](https://nodei.co/npm/iobroker.contact/)

**Tests:**: [![Travis-CI](http://img.shields.io/travis/WLAN-Kabel/ioBroker.contact/master.svg)](https://travis-ci.org/WLAN-Kabel/ioBroker.contact)

## Contact adapter for ioBroker

Read your google contact.

## Todo
* 

## Google Authentication
The following step is only needed if your ioBroker is installed on another computer/server and you cannot acces the webinterface via localhost.

### Windows:

Run ```nodepad.exe``` with admin right and open the ```C:\Windows\System32\drivers\etc\hosts``` file.
Add a entry like ```192.168.0.10    example.com //<IP-Adress ioBroker>     <FQDN>```
Save the file and open the webinterface via the <FQDN> you have written in the hosts file. Example: http://example.com:8081

### Linux:

    Comming soon ...

### Mac

    Comming soon ...

### Google API Key

!!! Note: If you have already installed and set up the iobroker.contact adapter you only need to add the API to your project (3.).

1. You need an api key. Visit https://console.cloud.google.com/apis/dashboard and login with your google account.

2. Open the list in the header and create a new project. Enter a project name like "ioBroker" and click create.

3. Make sure you have selected the right project from the list. Open the library tab. Search for "contact" and click on "Google People API".

4. Click "activate" and then click on "APIs & Services". Open the tab "OAuth consent screen" and type a application name like "ioBroker". You can also upload a logo, but this is not necessary.

5. Open the "Credentials" tab, click the "Create credentials" dropdown and select "OAuth client ID". In the next step choose "Web application". Type a name like "ioBroker" or "Webclient". Add ```http://<FQDN>:<Port from adapter config>``` to authorised JavaScript origins. Add ```http://<FQDN>:<Port from adapter config>/google``` and ```http://<FQDN>:<Port from adapter config>/google/``` to Authorised redirect URIs.

6. Create the client id and copy the displayed client ID and the client secret.

Go to the adapter config an add the client ID and the client secret.

### contact.0

| State name | meaning |
| - | - |
| query | Query a contact for a phone number |
| familyName | Family name of the requested contact |
| givenName | Given name of the requested contact |
| photo | Photo of the requested contact |
| id | ID of the requested contact |

### contact.0.<id>

| State name | meaning |
| - | - |
| familyName | Family name of the contact |
| givenName | Given name of the contact |
| photo | Photo of the contact |
| addresses.* | Adresses of the contact |
| emailAddresses.* | Email adresses of the contact |
| phoneNumbers.* | Phone numbers of the contact |

## Changelog

### 0.0.1
* (WLAN-Kabel) Initial release

## License
MIT License

Copyright (c) 2019 WLAN-Kabel <wlan-kabel@outlook.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.