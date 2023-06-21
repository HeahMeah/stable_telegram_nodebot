const { Telegraf, Markup} = require('telegraf');
const { MenuMiddleware } = require('telegraf-inline-menu');

const axios = require('axios');
const fs = require('fs');
const util = require('util');
const userData = require('./datastore');
require('dotenv').config();
const menuMiddleware = new MenuMiddleware('/', inlineMenu);
const inlineMenu = require('./botmenus'); // Import inline menus


// Create the bot
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(menuMiddleware.middleware());
bot.use((ctx, next) => {  // Use user data initialization middleware
    const userId = ctx.from.id;
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
        console.log(`Initialized data for user: ${userId}`);
    }
    return next();
});



const menu = [
    ["Generate!"],
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


// Inline menu under pic
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

bot.hears('Generate!', async ctx => menuMiddleware.replyToContext(ctx));


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

bot.on('photo', async (ctx) => {
    // Get the file_id of the highest resolution image
    const fileId = ctx.message.photo.pop().file_id;
    // Get the file object using the file_id
    const file = await ctx.telegram.getFile(fileId);
    // Construct the file download URL
    const fileUrl = `https://api.telegram.org/file/bot${your_bot_token_here}/${file.file_path}`;
    // Download
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


// img2img flow
async function img2img(ctx,messageID){
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
    const endpoint = `${url}/sdapi/v1/img2img`;


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