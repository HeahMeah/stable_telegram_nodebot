const instanceManager = require ('./instanceManager');
const userQueue = [];
const userData = require('./datastore');
const { startGeneration } = require('./imageGeneration');


function enqueueUser(userId, userPayload) {
    // Store user's data
    userData[userId] = {
        userPayload,
        chatId: chatId, };

    // Enqueue user's id
    userQueue.push(userId);
    console.log("User with ID - ", userId, "in queue");
}

function dequeueUser() {
    const userId = userQueue.shift();
    const userPayload = userData[userId];

    return { userId, userPayload };
}



async function processQueue() {
    console.log("Running processQueue");
    try {
        if (userQueue.length > 0) {
            console.log("There are users in the queue");
            const instance = await instanceManager.getFreeInstance();
            if (instance) {
                console.log("Found a free instance: ", instance);
                const { userId, userPayload } = dequeueUser();
                const ctx = userData[userId].chatId;

                console.log("User payload: ", userPayload);
                console.log("Payload type: ", userPayload.type);

                //Call start generation
                if (userPayload.type === 'txt2img') {
                    console.log("Starting generation with payload: ", userPayload);
                    await startGeneration(chatId, userPayload, instance);

                } else if (userPayload.type === 'img2img') {
                    await startGeneration(chatId, userPayload, instance);
                }
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