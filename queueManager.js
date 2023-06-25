const instanceManager = require('./instanceManager');
const userQueue = [];
const userData = require('./datastore');

function enqueueUser(userId, userPayload) {
    // Store user's data
    userData[userId] = userPayload;

    // Enqueue user's id
    userQueue.push(userId);
}

function dequeueUser() {
    const userId = userQueue.shift();
    const userPayload = userData[userId];

    // Clean up the user data
    delete userData[userId];

    return { userId, userPayload };
}

async function processQueue() {
    if (userQueue.length > 0) {
        const instance = await instanceManager.getFreeInstance();
        if (instance) {
            const { userId, userPayload } = dequeueUser();

            // Send user's payload to instance
            await instanceManager.sendPayloadToInstance(instance, userId, userPayload);
        }
    }

    // Process queue every second
    setTimeout(processQueue, 1000);
}

module.exports = { enqueueUser, processQueue };