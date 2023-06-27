const { Telegraf, Markup } = require('telegraf');
const { MenuMiddleware } = require('telegraf-inline-menu');
const axios = require('axios');
const fs = require('fs');
const util = require('util');
const userData = require('./datastore');
require('dotenv').config();
const inlineMenu = require('./botmenus'); // Import inline menus
const guideMiddleware = require('./guidemenu'); //Import main menu
const http = require('http');
const https = require('https');

// Create the bot
const bot = new Telegraf(process.env.BOT_TOKEN);


const menu = [
    ["Generate Txt2Img"],
    ["Generate Img2Img"],
    ["Guide / Гайд"]
];

const writeFile = util.promisify(fs.writeFile);

const menuMiddleware = new MenuMiddleware('menu/', inlineMenu);

// Inline menu under pic
const inline_menu_again = [
    [{text: "Again" , callback_data: 'generate_again'}],
];


bot.use((ctx, next) => {  // Use user data initialization middleware
    const userId = ctx.from.id;
    const username =ctx.from.username;
    const firstName = ctx.from.first_name;
    if (!userData[userId]) {
        userData[userId] = {
            width: 768,
            height: 768,
            cfg: '6',
            sampler: 'Euler',
            upscaleTo: '2',
            quality: '20',
            upscaler: 'None',
            seed: -1,
            embedding: 'easynegative, verybadimagenegative_v1.3',
            upscale_on: 'false'
        };
        console.log(`Initialized data for user: ID - ${userId}, First Name - ${firstName}, Username - ${username}`);
    }
    return next();
});


bot.use((ctx, next) => { // Middleware management
    if (!ctx.callbackQuery || !ctx.callbackQuery.data) {
        return next();
    }
    if (ctx.callbackQuery.data.startsWith('guide/')) {
        return guideMiddleware.middleware()(ctx, next);
    }
    if (ctx.callbackQuery.data.startsWith('menu/')) {
        return menuMiddleware.middleware()(ctx, next);
    }
    return next();
});


bot.action('generate_again', async (ctx) => {
    try {
        console.log('Before startGeneration');
        await startGeneration(ctx);
        await updateProgress(ctx);
        await ctx.answerCbQuery('Generating the image again...');

    } catch (error) {
        console.error(`Error in generating image again:`, error);
    }
});

function createPayload(user) {
    return {
        //sd_model_checkpoint: user.model,
        prompt: user.prompt,
        seed: user.seed,
        subseed: -1,
        subseed_strength: 0.8,
        batch_count: 1,
        steps: user.quality,
        cfg_scale: user.cfg,
        width: user.width,
        height: user.height,
        negative_prompt: user.embedding,
        sampler_index: user.sampler,
        send_images: "true",
        save_images: "true",
        hr_upscaler: user.upscaler,
        hr_scale: user.upscaleTo,
        enable_hr: user.upscale_on,
        denoising_strength: 0.5
    };
}


bot.start((ctx) => handleBotStart(ctx));
async function handleBotStart(ctx) {
    const userId = ctx.from.id;

    if (!userData[userId]) {
        userData[userId] = {
            //sd_model_checkpoint: user.model,
            width: 768,  // default width
            height: 768,  // default height
            cfg: '6',  // default cfg
            sampler: 'Euler',  // default sampler
            upscaleTo: '1.2',  // default upscaleTo
            quality: '20',  // default quality
            upscaler: 'None',  // default upscaler
            seed: -1,  // default seed (random)
            embedding: 'easynegative, verybadimagenegative_v1.3',
            upscale_on: 'false'
        };

        userData[userId].payload = createPayload(userData[userId]);  // Add this line
    }
    ctx.reply("Hi ;)",Markup.keyboard(menu).resize());
    await guideMiddleware.replyToContext(ctx);
}


bot.hears('Generate Txt2Img', async ctx => {
    userData[ctx.from.id] = {
        ctx: ctx,
        type: 'txt2img'
    };
    await menuMiddleware.replyToContext(ctx)
});


bot.hears('Generate Img2Img', async ctx => {
    userData[ctx.from.id] = {
        ctx: ctx,
        type: 'img2img'
    };
    await menuMiddleware.replyToContext(ctx)
});


bot.hears('Guide / Гайд', async (ctx) => {
    await guideMiddleware.replyToContext(ctx);
});


bot.hears('Generate Txt2Img', async ctx => {
    userData[ctx.from.id] = {
        ctx: ctx,
        type: 'txt2img'
    };
    await menuMiddleware.replyToContext(ctx);
});


// MAIN Menu
bot.on('text', async (ctx) => {
    const userText = ctx.message.text;
    const userId = ctx.from.id;

    if (!userData[userId]) {
        userData[userId] = {};
    }

    // If user is expected to provide a prompt
    if (userData[userId].userPrompt) {
        userData[userId].prompt = userText;
        userData[userId].userPrompt = false;
        await startGeneration(ctx);
        await updateProgress(ctx);
    }
    else {
        userData[userId].prompt = userText;
        await startGeneration(ctx);
        await updateProgress(ctx);
    }
});


bot.on('photo', async (ctx) => {
    const fileId = ctx.message.photo.pop().file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    await axios({
        url: fileUrl,
        responseType: 'stream',
    }).then(
        response =>
            new Promise((resolve, reject) => {
                response.data
                    .pipe(fs.createWriteStream('user.png'))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }),
    );

    // Convert the downloaded image to base64
    let base64str = fs.readFileSync('user.png', { encoding: 'base64' });
    const userId = ctx.from.id;
    if (!userData[userId]) {
        userData[userId] = {};
    }
    userData[userId].init_image = base64str;

    await ctx.reply('Image received and saved.');

    const messageID = await startGeneration(ctx);
    await img2img(ctx, messageID);
});


bot.command('generate', async (ctx) => {
    await img2img(ctx);
});


//Main Stable-Dif functions
async function generateImage(ctx, userPayload, instance) {
    const userId = ctx.from.id;
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
                await upscaleImage(ctx, messageID);

                await cleanup(ctx, messageID);
            } else {
                await ctx.replyWithPhoto({ source: fs.createReadStream('generated_image.png') },
                    { reply_markup: { inline_keyboard: inline_menu_again } } );
                await cleanup(ctx, messageID);
                console.log('Sent image and cleaned up');
            }
        } else {
            await ctx.reply(`Generation failed with status code ${response.status}`);
            await cleanup(ctx, messageID);
            user.image_ready = true;
        }
    } catch (err) {
        console.error(err);
        if (err.response && err.response.data && err.response.data.error) {
            await ctx.reply(`Oops, something went wrong: Please try again ;P`);
        } else {
            await ctx.reply("Oops, something went wrong");
        }
        await cleanup(ctx, messageID);
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
async function upscaleImage(ctx, instance) {
    const userId = ctx.from.id;
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

function updateProgress(ctx,instance) {
    let lastProgress = 0;
    let lastMessage = '';
    let spinnerStates = ['-', '\\', '|', '/'];
    let spinnerIndex = 0;
    let messageID = userData[ctx.from.id].message_id;

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
    const { message_id } = userPayload
    const message = await ctx.reply('Generating image...');
    userData[ctx.from.id].message_id = message.message_id;
    userData[ctx.from.id].image_ready = false;
    await updateProgress(ctx, instance);
    await generateImage(ctx,message.message_id, instance);
}

async function cleanup(ctx, messageID) {
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageID);
    } catch (error) {
        console.error(`Cleanup failed with error ${error}`);
    }
}


async function makeRequest(instance) {
    const httpAgent = new http.Agent({keepAlive: true});
    const httpsAgent = new https.Agent({keepAlive: true});

    const response = await axios.get(instance.url, {
        httpAgent: httpAgent,
        httpsAgent: httpsAgent,
    });
}

bot.launch()

export {startGeneration}