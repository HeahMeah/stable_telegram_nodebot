const instanceManager = require('./instanceManager');
const userQueue = [];
const userData = require('./datastore');
import {startGeneration} from "./bot";


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
            const ctx = userData[userId].ctx;

            //Call start generation=
            if (userPayload.type === 'txt2img') {
                startGeneration(ctx, userPayload.message_id, instance);
            } else if (userPayload.type === 'img2img') {
                startGeneration(ctx, userPayload.message_id, instance);
            }
        }
    }

    // Process queue every second
    setTimeout(processQueue, 1000);
}

export {enqueueUser, processQueue}