const { Telegraf, Markup} = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const util = require('util');
require('dotenv').config();


// Create the bot
const bot = new Telegraf(process.env.BOT_TOKEN);

const userData = {};

const menu = [
    ["Generate!"],
    ["Sampler", "Sampling steps / Качество"],
    ["Resolution / Разрешение", "Number of pictures / Кол-во изображений"],
    ["Upscaler", "Upscale to"],
    ["CFG scale", "Seed"],
    ["Guide / Гайд"]
];

const guide_sections = [
    "*Section 1*\nStyles:hewlett, 80s-anime-AI, kuvshinov, roy-lichtenstein.",
    "*Section 2*\nThis is the second section of the guide.",
    "*Section 3*\nThis is the third section of the guide."
];

const NEXT = "NEXT";
const PREVIOUS = "PREVIOUS";
const END_GUIDE = "END_GUIDE";
const url = 'http://127.0.0.1:7860'
const writeFile = util.promisify(fs.writeFile);


// Inline menus
const inline_menu_embedding = [
    [{text: "Realistic", callback_data: 'realisticvision-negative-embedding'}, {text: "Anime", callback_data: 'anime-style-negative-embedding,easynegative'}],
    [{text: "Default", callback_data: 'easynegative, verybadimagenegative_v1.3'}, {text: "Overall quality", callback_data: 'ng_deepnegative_v1_75t'}]
]

const inline_menu_sampler = [
    [{text: "Euler", callback_data: 'Euler'}, {text: "DPM2 Karras", callback_data: 'DPM2 Karras'}],
    [{text: "DPM++ 2M Karras", callback_data: 'DPM++ 2M Karras'}, {text: "DPM++ SDE Karras", callback_data: 'DPM++ SDE Karras'}]
];

const inline_menu_quality = [
    [{text: "Set to 20", callback_data: '20'}, {text: "Set to 35", callback_data: '35'}],
    [{text: "Set to 50", callback_data: '50'}, {text: "Set to 70", callback_data: '70'}]
];

const inline_menu_res = [
    [{text: "Set to 768x512", callback_data: 'horizontal'}, {text: "Set to 512x768", callback_data: 'vertical'}],
    [{text: "Set to 768x768", callback_data: 'square'}]
];

const inline_menu_num_of_pic = [
    [{text: "2 images", callback_data: '2'}, {text: "4 images", callback_data: '4'}]
]


const inline_menu_upscaler = [
    [{text: "R-ESRGAN 4x+ Anime6B", callback_data: 'rea'}],
    [{text: "ESRGAN_4x", callback_data: 're'}]
];

const inline_menu_upscale_to = [
    [{text: "Upscale x1.5", callback_data: '1.5'}, {text: "Upscale x2", callback_data: '2'}],
    [{text: "Upscale x3", callback_data: '3'}]
]


const inline_menu_cfg = [
    [{text: "Set to 6", callback_data: '6'}, {text: "Set to 6.5", callback_data: '6.5'}],
    [{text: "Set to 7", callback_data: '7'}, {text: "Set to 7.5", callback_data: '7.5'}],
    [{text: "Set to 8", callback_data: '8'}, {text: "Set to 8.5", callback_data: '8.5'}],
    [{text: "Set to 9", callback_data: '9'}, {text: "Set to 9.5", callback_data: '9.5'}],
    [{text: "Set to 10", callback_data: '10'}, {text: "Set to 10.5", callback_data: '10.5'}],
    [{text: "Set to 11", callback_data: '11'}, {text: "Set to 11.5", callback_data: '11.5'}],
    [{text: "Set to 12", callback_data: '12'}, {text: "Set to 12.5", callback_data: '12.5'}],
    [{text: "Set to 13", callback_data: '13'}],
];

const inline_menu_seed = [
    [{text: "Randomize" + " 🎲", callback_data: 'randomize'}],
    [{text: "Return previous seed" + " ♻", callback_data: 'return_prev'}]
];

const inline_menu_again = [
    [{text: "Again" , callback_data: 'generate_again'}],
];


bot.start((ctx) => {
    const userId = ctx.from.id;

    if (!userData[userId]) {
        userData[userId] = {
            //sd_model_checkpoint: user.model,
            width: 768,  // default width
            height: 768,  // default height
            cfg: '6',  // default cfg
            sampler: 'Euler',  // default sampler
            upscaleTo: '2',  // default upscaleTo
            quality: '20',  // default quality
            upscaler: 'None',  // default upscaler
            seed: -1,  // default seed (random)
            embedding: 'easynegative, verybadimagenegative_v1.3',
            upscale_on: 'false'
        };
    }

    ctx.reply('Welcome!', Markup.keyboard(menu).resize());
    ctx.reply(guide_sections[0], createMenu(0));
})

bot.hears('Sampler', (ctx) => {
    ctx.reply('Choose a sampler', Markup.inlineKeyboard(inline_menu_sampler));
});

bot.hears('Sampling steps / Качество', (ctx) => {
    ctx.reply('Choose a sampler', Markup.inlineKeyboard(inline_menu_quality));
});

bot.hears('Resolution / Разрешение', (ctx) => {
    ctx.reply('Choose resolution and aspect ratio', Markup.inlineKeyboard(inline_menu_res));
});

bot.hears('Seed', (ctx) => {
    ctx.reply('Choose a seed', Markup.inlineKeyboard(inline_menu_seed));
});

bot.hears('Upscaler', (ctx) => {
    ctx.reply('Choose a upscaler', Markup.inlineKeyboard(inline_menu_upscaler));
});

bot.hears('Upscale to', (ctx) => {
    ctx.reply('Choose multiplier', Markup.inlineKeyboard(inline_menu_upscale_to));
});

bot.hears('Generate!', (ctx) => {
    ctx.reply('Choose negative prompt, Then please type your prompt....', Markup.inlineKeyboard(inline_menu_embedding));
});

bot.hears('Number of pictures / Кол-во изображений', (ctx) => {
    ctx.reply('Choose quantity', Markup.inlineKeyboard(inline_menu_num_of_pic));
});

bot.hears('CFG scale', (ctx) => {
    ctx.reply('Choose quantity', Markup.inlineKeyboard(inline_menu_cfg));
});


let userGuideSections = {};
bot.hears("Guide / Гайд", (ctx) => {
    const userId = ctx.from.id;

    // Initialize user's data if it's their first time
    if (!userData[userId]) {
        userData[userId] = {
            //sd_model_checkpoint: user.model,
            width: 768,  // default width
            height: 768,  // default height
            cfg: '6',  // default cfg
            sampler: 'Euler',  // default sampler
            upscaleTo: '2',  // default upscaleTo
            quality: '20',  // default quality
            upscaler: 'None',  // default upscaler
            seed: -1,  // default seed (random)
            embedding: 'easynegative, verybadimagenegative_v1.3',
            upscale_on: 'false'
        };
    }

    // Initialize the user's guide section
    userGuideSections[userId] = 0;

    ctx.reply(guide_sections[0], Markup.inlineKeyboard(createMenu(0)));
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
    // If user has entered "Generate!"
    else if (userText === 'Generate!') {
        userData[userId].userPrompt = true;
        await ctx.reply('Choose negative prompt, Then please type your prompt....', Markup.inlineKeyboard(inline_menu_embedding));
    }
    // If user sends any other message, start image generation
    else {
        userData[userId].prompt = userText;
        await startGeneration(ctx);
        await updateProgress(ctx);
    }
});


// Inline keyboards menus callback
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.update.callback_query.data;
    const userId = ctx.from.id;

    console.log('callbackData:', callbackData);
    console.log('userId:', userId);
    console.log('userData:', userData);

    if(!userData[userId]) {
        userData[userId] = {};
    }

    if (['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'].includes(callbackData)) {
        // Simulate asynchronous processing, such as a network request
        await new Promise(resolve => setTimeout(resolve, 3000));

        userData[userId].cfg = callbackData;
        ctx.answerCbQuery(`You've selected ${callbackData}.`);
    }
    else if (['Euler', 'DPM2 Karras', 'DPM++ 2M Karras', 'DPM++ SDE Karras'].includes(callbackData)) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        userData[userId].sampler = callbackData;
        ctx.answerCbQuery(`You've selected ${callbackData}.`);
    }
    else if (['1.5', '2', '3'].includes(callbackData)) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        userData[userId].upscaleTo = callbackData;
        ctx.answerCbQuery(`You've selected ${callbackData}.`);
    }
    else if (['20', '35', '50', '70'].includes(callbackData)) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        userData[userId].quality = callbackData;
        ctx.answerCbQuery(`You've selected ${callbackData}.`);
    }
    else if (['realisticvision-negative-embedding', 'anime-style-negative-embedding,easynegative', 'easynegative, verybadimagenegative_v1.3', 'ng_deepnegative_v1_75t'].includes(callbackData)) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        userData[userId].embedding = callbackData;
        ctx.answerCbQuery(`You've selected ${callbackData}.`);
    }
    switch (callbackData) {
        case NEXT:
            if (userGuideSections[userId] < guide_sections.length - 1) {
                userGuideSections[userId]++;
                console.log('New section index:', userGuideSections[userId]);
                console.log('New section text:', guide_sections[userGuideSections[userId]]);
                console.log('New menu:', createMenu(userGuideSections[userId]));
                ctx.editMessageText(guide_sections[userGuideSections[userId]],
                    {reply_markup: createMenu(userGuideSections[userId])}
                );
            }
            break;
        case PREVIOUS:
            if (userGuideSections[userId] > 0) {
                userGuideSections[userId]--;
                ctx.editMessageText(guide_sections[userGuideSections[userId]],
                    {reply_markup: createMenu(userGuideSections[userId])}
                );
            }
            break;
        case END_GUIDE:
            ctx.editMessageText("End of the guide");
            break;
    }
    switch (callbackData) {
        case 'vertical':
            userData[userId].width = 512;
            userData[userId].height = 768;
            ctx.answerCbQuery("You've selected vertical resolution.");
            break;
        case 'horizontal':
            userData[userId].width = 768;
            userData[userId].height = 512;
            ctx.answerCbQuery("You've selected horizontal resolution.");
            break;
        case 'square':
            userData[userId].width = 768;
            userData[userId].height = 768;
            ctx.answerCbQuery("You've selected square resolution.");
            break;
    }
    switch (callbackData){
        case 're':
            userData[userId].upscaler = 'R-ESRGAN 4x+ Anime6B';
            userData[userId].upscale_on = 'true';
            ctx.answerCbQuery("You've selected R-ESRGAN 4x+ Anime6B.");
            break;
        case 'rea':
            userData[userId].upscaler = 'ESRGAN_4x';
            userData[userId].upscale_on = 'true';
            ctx.answerCbQuery("You've selected ESRGAN 4x.");
            break;
    }
    switch(callbackData){
        case 'randomize':
            userData[userId].seed = -1;
            ctx.answerCbQuery("You've selected randomize.");
            break;
        case 'return_prev':
            userData[userId].seed = -1;
            ctx.answerCbQuery("Returned");
            break;
    }
});

bot.action('generate_again', async (ctx) => {
    console.log('Generate again action triggered');
    try {
        console.log('Before startGeneration');
        await startGeneration(ctx);
        console.log('After startGeneration, before updateProgress');
        await updateProgress(ctx);
        console.log('After updateProgress, before answerCbQuery');
        await ctx.answerCbQuery('Generating the image again...');
        console.log('After answerCbQuery');
    } catch (error) {
        console.error(`Error in generating image again: ${error}`);
    }
});

async function createMenu(index) {
    const menu = [];

    if (index > 0) {
        menu.push(Markup.button.callback("Previous", "PREVIOUS"));
    }
    if (index < guide_sections.length - 1) {
        menu.push(Markup.button.callback("Next", "NEXT"));
    }
    if (index === guide_sections.length - 1) {
        menu.push(Markup.button.callback("End Guide", "END_GUIDE"));
    }
    return Markup.inlineKeyboard(menu);
}

//Main Stable-Dif functions
async function generateImage(ctx, messageID) {
    const userId = ctx.from.id;
    const user = userData[userId];
    const payload = {
        //sd_model_checkpoint: user.model,
        prompt: user.prompt,
        seed: user.seed,
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
    };

    const headers = {'accept': 'application/json'};
    const endpoint = `${url}/sdapi/v1/txt2img`;

    try {
        const response = await axios.post(endpoint, payload, {headers: headers});
        if (response.status === 200) {
            const image_data_base64 = response.data.images[0];
            user.image_data_base64 = image_data_base64;
            const image_data = Buffer.from(image_data_base64, 'base64');
            await writeFile("generated_image.png", image_data);
            user.image_ready = true;

            if (user.upscale_on === "true") {
                await upscaleImage(ctx, messageID);
                await cleanup(ctx, messageID);
            } else {
                await ctx.replyWithPhoto({ source: fs.createReadStream('generated_image.png') },
                    { reply_markup: { inline_keyboard: inline_menu_again } } );
                await cleanup(ctx, messageID);

            }
        } else {
            await ctx.reply(`Generation failed with status code ${response.status}`);
            await cleanup(ctx, messageID);
            user.image_ready = true;
        }
    } catch (err) {
        console.error(err);
    }
}


async function img2img(ctx){
    const userId = ctx.from.id;
    const user = userData[userId];

    const payload = {
        init_images: [user.init_image],
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
        styles: [user.style],
        seed: user.seed,
        subseed: user.subseed,
        subseed_strength: 0,
        seed_resize_from_h: user.seed_resize_from_h,
        seed_resize_from_w: user.seed_resize_from_w,
        sampler_name: user.sampler_name,
        batch_size: 1,
        n_iter: 1,
        steps: user.steps,
        cfg_scale: 7,
        width: user.width,
        height: user.height,
        restore_faces: false,
        tiling: false,
        do_not_save_samples: false,
        do_not_save_grid: false,
        negative_prompt: user.negative_prompt,
        eta: 0,
        s_churn: 0,
        s_tmax: 0,
        s_tmin: 0,
        s_noise: 1,
        override_settings: {},
        override_settings_restore_afterwards: true,
        script_args: [],
        sampler_index: "Euler",
        include_init_images: false,
        script_name: user.script_name,
        send_images: true,
        save_images: false,
        alwayson_scripts: {}
    };

    // rest of your function here...
}


//Upscale
async function upscaleImage(ctx) {
    const userId = ctx.from.id;
    const user = userData[userId];
    const payload = {
        resize_mode: 0,
        upscaling_resize: user.upscaleTo,
        upscaler_1: user.upscaler,
        upscaler_2: "None",
        extras_upscaler_2_visibility: 0,
        upscale_first: false,
        image: user.image_data_base64
    };

    const headers = {'accept': 'application/json'};
    const endpoint = `${url}/sdapi/v1/extra-single-image`;

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

async function getProgress() {
    try {
        const response = await axios.get(`${url}/sdapi/v1/progress?skip_current_image=false`);
        const data = response.data;
        const progress = data.progress;
        const eta_relative = data.eta_relative;
        return { progress, eta_relative };
    } catch (error) {
        console.error(`Error in getProgress: ${error}`);
        return { progress: 0, eta_relative: 0 };  // Return default values in case of error
    }
}

function updateProgress(ctx) {
    let lastProgress = 0;
    let spinnerStates = ['-', '\\', '|', '/'];
    let spinnerIndex = 0;
    let messageID = userData[ctx.from.id].message_id;

    // Start a repeating task that updates the progress every 500 milliseconds
    let updateTask = setInterval(async () => {
        const { progress, eta_relative } = await getProgress();

        if (progress != lastProgress) {
            const progressPercentage = Math.floor(progress * 100);
            const etaMinutes = Math.floor(eta_relative / 60);
            const etaSeconds = Math.floor(eta_relative % 60);
            const spinnerState = spinnerStates[spinnerIndex % 4];
            console.log("Progress!!", progress);

            try {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    messageID,
                    undefined,
                    `Generating image...${spinnerState} (${progressPercentage}% complete, ETA: ${etaMinutes}m ${etaSeconds}s)`
                );
            } catch (error) {
                console.error(`Failed to update progress: ${error}`);
            }

            lastProgress = progress;
            spinnerIndex += 1;
        }

        // If the image is ready, stop the update task
        if (userData[ctx.from.id].image_ready) {
            clearInterval(updateTask);
        }
    }, 500);
}
async function startGeneration(ctx) {
    const message = await ctx.reply('Generating image...');
    userData[ctx.from.id].message_id = message.message_id;
    userData[ctx.from.id].image_ready = false;
    await updateProgress(ctx);
    await generateImage(ctx,message.message_id);
}
async function cleanup(ctx, messageID) {
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageID);
    } catch (error) {
        console.error(`Cleanup failed with error ${error}`);
    }
}

process.on('uncaughtException', function (err) {
    console.log(err);
});

bot.launch()