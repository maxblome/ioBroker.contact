/**
 * Parse vCrad to Json.
 * @param {string} vcard The vCrad body
 * @returns {Object} Object
 */
function parse(vcard) {

    const body = vcard.split('\r\n');
				
    const person = {};

    const address = [];
    const email = [];
    const phonenumber = [];
    
    for(let j = 0; j < body.length; j++) {

        //Fullname
        if(body[j].split(':')[0] == 'FN') person.fn = body[j].split(':')[1];
        
        //Address
        if(body[j].split(':')[0].split(';')[0] == 'ADR') {
            
            const tmpAdr = {};
            
            if(body[j].split(':')[0].split(';')[1].split('=')[0] == 'TYPE') {
                tmpAdr.type = body[j].split(':')[0].split(';')[1].split('=')[1];
            }
            
            const tmp = body[j].split(':')[1].split(';');
            
            tmpAdr.postBox = tmp[0];
            tmpAdr.extendedAddress = tmp[1];
            tmpAdr.street = tmp[2];
            tmpAdr.city = tmp[3];
            tmpAdr.state = tmp[4];
            tmpAdr.postcode = tmp[5];
            tmpAdr.country = tmp[6];
            
            address.push(tmpAdr);
        }
        
        //Email
        if(body[j].split(':')[0].split(';')[0] == 'EMAIL') {
            
            const tmpEmail = {};
            
            if(body[j].split(':')[0].split(';')[1].split('=')[0] == 'TYPE') {
                tmpEmail.type = body[j].split(':')[0].split(';')[1].split('=')[1];
            }
            
            const tmp = body[j].split(':')[1].split(';');
            
            tmpEmail.value = body[j].split(':')[1];
            
            email.push(tmpEmail);
        }
        
        //Phonenumber
        if(body[j].split(':')[0].split(';')[0] == 'TEL') {
            
            const tmpTel = {};
            
            if(body[j].split(':')[0].split(';')[1].split('=')[0] == 'TYPE') {
                tmpTel.type = body[j].split(':')[0].split(';')[1].split('=')[1];
            }
            
            const tmp = body[j].split(':')[1].split(';');
            
            tmpTel.value = body[j].split(':')[1];
            
            phonenumber.push(tmpTel);
        }
        
        //Photo
        if(body[j].split(':')[0].split(';')[0] == 'PHOTO') {
        
            if(body[j].split(':')[0].split(';')[1].split('=')[0] == 'ENCODING' && body[j].split(':')[0].split(';')[1].split('=')[1] == 'b') {
                person.photo = 'data:image/' + body[j].split(':')[0].split(';')[2].split('=')[1] + ';base64,' + body[j].split(':')[1];
            }
        }
    }
    
    person.address = address;
    person.email = email;
    person.phonenumber = phonenumber;

    return person;
}

module.exports = {
    parse
};