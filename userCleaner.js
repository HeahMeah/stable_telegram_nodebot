const userData = require("./datastore");

function cleanUpUser(userId) {
    if (userData[userId]) {
        console.log(`${userId} was cleaned`);
        delete userData[userId];
    } else {
        console.error(`Unable to clean up user with ID ${userId}`);
    }
}

module.exports = { cleanUpUser };