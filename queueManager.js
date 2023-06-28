const instanceManager = require ('./instanceManager');
const userQueue = [];
const userData = require('./datastore');
const startGeneration = require('./bot').startGeneration;


function enqueueUser(userId, userPayload) {
    // Store user's data
    userData[userId] = userPayload;
    console.log(userPayload);

    // Enqueue user's id
    userQueue.push(userId);
}


function dequeueUser() {
    const userId = userQueue.shift();
    const userPayload = userData[userId];

    return { userId, userPayload };
}


function cleanUpUser(userId) {
    delete userData[userId];
}


async function processQueue() {
    try {
        if (userQueue.length > 0) {
            const instance = await instanceManager.getFreeInstance();
            if (instance) {
                const { userId, userPayload } = dequeueUser();
                const ctx = userData[userId].ctx;


                //Call start generation
                if (userPayload.type === 'txt2img') {
                    await startGeneration(ctx, userPayload.message_id, instance);
                } else if (userPayload.type === 'img2img') {
                    await startGeneration(ctx, userPayload.message_id, instance);
                }
                cleanUpUser(userId);
            }
        }
    } catch (error) {
        console.error('Error processing queue:', error);
    } finally {
        setTimeout(processQueue, 1000);
    }
}


module.exports.processQueue = processQueue;
module.exports.enqueueUser  = enqueueUser;