const userData = require("./datastore");
const axios = require("axios");
const fs = require("fs");
const {cleanUpUser} = require("./userCleaner");


//Main Stable-Dif functions
async function generateImage(chatId, userPayload, instance) {
    const userId = userPayload.userId;
    const user = userData[userId];
    const payload = userPayload.payload;

    const headers = {'accept': 'application/json'};
    const endpoint = `${instance.url}/sdapi/v1/txt2img`;

    try {
        const response = await axios.post(endpoint, payload, {headers: headers});
        if (response.status === 200) {
            const image_data_base64 = response.data.images[0];
            user.image_data_base64 = image_data_base64;
            const image_data = Buffer.from(image_data_base64, 'base64');
            await writeFile("generated_image.png", image_data);
            user.image_ready = true;

            console.log('Upscale on:', user.upscale_on);
            if (user.upscale_on === -1) { //Not relevant more need to clean up or replace to Control net function call
                await upscaleImage(chatId); // pass chatId here

                await cleanup(chatId); // pass chatId here
            } else {
                await bot.telegram.sendPhoto(chatId, { source: fs.createReadStream('generated_image.png') },
                    { reply_markup: { inline_keyboard: inline_menu_again } } );
                await cleanup(chatId); // pass chatId here
                console.log('Sent image and cleaned up');
                cleanUpUser(userId);
            }
        } else {
            await bot.telegram.sendMessage(chatId, `Generation failed with status code ${response.status}`);
            await cleanup(chatId); // pass chatId here
            user.image_ready = true;
        }
    } catch (err) {
        console.error(err);
        if (err.response && err.response.data && err.response.data.error) {
            await bot.telegram.sendMessage(chatId, `Oops, something went wrong: Please try again ;P`);
        } else {
            await bot.telegram.sendMessage(chatId, "Oops, something went wrong");
        }
        await cleanup(chatId); // pass chatId here
        user.image_ready = true;
    }
}


// img2img flow
async function img2img(ctx,messageID,instance){
    const userId = ctx.from.id;
    const user = userData[userId];

    const payload = {
        init_images: user.init_image, //here i should put base64code
        resize_mode: 0,
        denoising_strength: 0.75,
        image_cfg_scale: 0,
        mask: user.mask,
        mask_blur: 4,
        inpainting_fill: 0,
        inpaint_full_res: true,
        inpaint_full_res_padding: 0,
        inpainting_mask_invert: 0,
        initial_noise_multiplier: 0,
        prompt: user.prompt,
        seed: user.seed,
        subseed: -1,
        subseed_strength: 0.5,
        sampler_name: user.sampler_name,
        batch_size: 1,
        n_iter: 1,
        steps: user.steps,
        cfg_scale: user.cfg,
        width: user.width,
        height: user.height,
        restore_faces: false,
        tiling: false,
        do_not_save_samples: true,
        do_not_save_grid: true,
        negative_prompt: user.embedding,
        eta: 0,
        s_churn: 0,
        s_tmax: 0,
        s_tmin: 0,
        s_noise: 1,
        script_args: [],
        sampler_index: "Euler",
        include_init_images: false,
        send_images: true,
        save_images: false,
        alwayson_scripts: {}
    };
    const headers = {'accept': 'application/json'};
    const endpoint = `${instance.url}/sdapi/v1/img2img`;


    try {
        const response = await axios.post(endpoint, payload, {headers: headers});
        if (response.status === 200) {
            const image_data_base64 = response.data.images[0];
            user.image_data_base64 = image_data_base64;
            const image_data = Buffer.from(image_data_base64, 'base64');
            await writeFile("generated_imh2img.png", image_data);

            if (user.upscale_on === "true") {
                await upscaleImage(ctx, messageID);
                await cleanup(ctx, messageID);
            } else {
                await ctx.replyWithPhoto({ source: fs.createReadStream('generated_img2img.png') },
                    { reply_markup: { inline_keyboard: inline_menu_again } } );
                await cleanup(ctx, messageID);

            }
            user.image_ready = true;
        } else {
            await ctx.reply(`Generation failed with status code ${response.status}`);
            await cleanup(ctx, messageID);
            user.image_ready = true;
        }
    } catch (err) {
        console.error(err);
    }
}


//Upscale
async function upscaleImage(chatId, instance) {
    const userId = userPayload.userId;
    const user = userData[userId];
    const payload = {
        resize_mode: 0,
        upscaling_resize: user.upscaleTo,
        upscaler_1: user.upscaler,
        upscaler_2: "None",
        extras_upscaler_2_visibility: 0,
        upscale_first: false,
        image: user.image_data_base64,
        denoising_strength: 0.5
    };

    const headers = {'accept': 'application/json'};
    const endpoint = `${instance.url}/sdapi/v1/extra-single-image`;

    try {
        const response = await axios.post(endpoint, payload, {headers: headers});
        if (response.status === 200) {
            const upscaled_image_data_base64 = response.data.image;
            const upscaled_image_data = Buffer.from(upscaled_image_data_base64, 'base64');
            await writeFile("upscaled_image.png", upscaled_image_data);
            await ctx.replyWithPhoto({ source: fs.createReadStream('upscaled_image.png') });
        } else {
            await ctx.reply(`Upscaling failed with status code ${response.status}`);

        }
    } catch (err) {
        console.error(err);
    }
}


async function getProgress(instance) {
    try {
        const response = await axios.get(`${instance.url}/sdapi/v1/progress?skip_current_image=false`);
        const data = response.data;
        const progress = data.progress;
        const eta_relative = data.eta_relative;
        return { progress, eta_relative, error: null };
    } catch (error) {
        console.error(`Error in getProgress: ${error}`);
        let errorMessage = "Oops, something went wrong.";
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = `Error: ${error.response.data.error}`;
        }
        return { progress: 0, eta_relative: 0, error: errorMessage };
    }
}

function updateProgress(ctx,userPayload, instance) {
    let lastProgress = 0;
    let lastMessage = '';
    let spinnerStates = ['-', '\\', '|', '/'];
    let spinnerIndex = 0;
    let messageID = userPayload.message_id;

    const updateTask = async () => {
        const { progress, eta_relative } = await getProgress(instance);

        const progressPercentage = Math.floor(progress * 100);
        const etaMinutes = Math.floor(eta_relative / 60);
        const etaSeconds = Math.floor(eta_relative % 60);
        const spinnerState = spinnerStates[spinnerIndex % 4];
        console.log("Progress!!", progress);

        const newMessage = `Generating image...${spinnerState} (${progressPercentage}% complete, ETA: ${etaMinutes}m ${etaSeconds}s)`;

        // If the new message is different from the last message, update the message
        if (newMessage !== lastMessage) {
            try {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    messageID,
                    undefined,
                    newMessage
                );
                lastMessage = newMessage;  // Store the new message as the last message
            } catch (error) {
                console.error(`Failed to update progress: ${error}`);
            }
        }

        lastProgress = progress;
        spinnerIndex = (spinnerIndex + 1) % 4; // Ensure spinnerIndex stays within the range of spinnerStates

        // If the image is ready, stop the update task
        if (!userData[ctx.from.id].image_ready) {
            setTimeout(updateTask, 800);  // If the image is not ready, re-run the task after 500ms
        }
    };

    updateTask();  // Start the task
}

async function startGeneration(ctx, userPayload, instance) {
    try {
        console.log("In startGeneration function with userPayload: ", userPayload);

        // Check if userPayload.message_id is available
        if (userPayload.message_id) {
            console.log("Message ID from queue manager: ", userPayload.message_id);
        }

        userPayload.image_ready = false;
        await updateProgress(ctx, instance);
        await generateImage(ctx, userPayload.message_id, instance);
    } catch (error) {
        console.error('Error in startGeneration: ', error);
        await ctx.reply('Oops! Something went wrong. Please try again.');
    }
}

async function cleanup(ctx, messageID) {
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageID);
    } catch (error) {
        console.error(`Cleanup failed with error ${error}`);
    }
}
module.exports = {
    startGeneration,
}