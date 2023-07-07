const axios = require('axios');


let instances = ['http://127.0.0.1:7860', 'http://127.0.0.1:7861', 'http://127.0.0.1:7862'].map(url => {
    return { url: url, busy: false };
});


function findFreeInstance() {
    return instances.find(instance => !instance.busy);
}


async function isInstanceBusy(instance) {
    try {
        const response = await axios.get(`${instance.url}/sdapi/v1/progress?skip_current_image=false`);
        // If the progress is greater than 0 = true
        // TODO: Check another method in API - temporary checking by progress
        return response.data.progress > 0;
    } catch (error) {
        console.log(`Error checking instance status: ${error}`);
        return false;
    }
}


async function updateInstanceStatuses() {
    await Promise.all(instances.map(async (instance) => {
        instance.busy = await isInstanceBusy(instance);
    }));
}


async function getFreeInstance() {
    await updateInstanceStatuses();
    return findFreeInstance();
}


module.exports.getFreeInstance =  getFreeInstance;