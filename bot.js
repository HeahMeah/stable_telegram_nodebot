const { Telegraf, Markup } = require('telegraf');
const { MenuMiddleware } = require('telegraf-inline-menu');
const axios = require('axios');
const fs = require('fs');
const util = require('util');
const userData = require('./datastore');
require('dotenv').config();
const inlineMenu = require('./botmenus'); // Import inline menus
const { guideMiddleware } = require('./guidemenu'); //Import main menu
const http = require('http');
const https = require('https');
const { processQueue, enqueueUser } = require ('./queueManager');

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


bot.start((ctx) => handleBotStart(ctx));
async function handleBotStart(ctx) {
    const userId = ctx.from.id;

    if (!userData[userId]) {
        userData[userId] = {
            //sd_model_checkpoint: user.model,
            width: 512,  // default width
            height: 512,  // default height
            cfg: '6',  // default cfg
            sampler: 'Euler',  // default sampler
            upscaleTo: '1.2',  // default upscaleTo
            quality: '20',  // default quality
            upscaler: 'None',  // default upscaler
            seed: -1,  // default seed (random)
            embedding: 'easynegative, verybadimagenegative_v1.3',
            upscale_on: 'false'
        };

        userData[userId].payload = createPayload(userData[userId]);
        userData[userId].ctx = ctx;
        console.log(userData);
    }
    ctx.reply("Hi ;)",Markup.keyboard(menu).resize());
    await guideMiddleware.replyToContext(ctx);
}

processQueue ();


bot.hears('Generate Txt2Img', async ctx => {
    userData[ctx.from.id].ctx = ctx;
    userData[ctx.from.id].type = 'txt2img';
    console.log('Generate Txt2Img handler: ', userData[ctx.from.id]);
    await menuMiddleware.replyToContext(ctx)
});


bot.hears('Generate Img2Img', async ctx => {
    userData[ctx.from.id].ctx = ctx;
    userData[ctx.from.id].type = 'img2img';
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
        userData[userId] = {
            type: 'txt2img',
            prompt: userText || 'Banana Duck',
            seed: -1,
            subseed: -1,
            subseed_strength: 0.8,
            batch_count: 1,
            steps: '25',
            cfg_scale: '6',
            width: 512,
            height: 512,
            negative_prompt: 'easynegative, verybadimagenegative_v1.3',
            sampler_index: 'Euler',
            send_images: 'true',
            save_images: 'true',
            hr_upscaler: 'None',
            hr_scale: '1.2',
            enable_hr: 'false',
            denoising_strength: 0.5,
            ctx: ctx,
        };
    }

    // If user is expected to provide a prompt
    if (userData[userId].userPrompt) {
        userData[userId].prompt = userText;
        userData[userId].userPrompt = false;
    } else {
        userData[userId].prompt = userText;
    }

    // Update type and ctx before creating the payload
    userData[ctx.from.id].type = 'txt2img';
    userData[ctx.from.id].ctx = ctx;

    // Update the payload every time user's data is updated
    userData[userId].payload = createPayload(userData[userId]);

    try {
        // Enqueue the user with updated payload
        enqueueUser(userId, userData[userId].payload);
        ctx.reply('Added your request to the queue. Please wait.');
        console.log(userId);
    } catch (error) {
        console.error(`Error in adding to queue:`, error);
    }
});


//bot.on('photo', async (ctx) => {
//    const fileId = ctx.message.photo.pop().file_id;
//     const file = await ctx.telegram.getFile(fileId);
//     const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
//     await axios({
//         url: fileUrl,
//         responseType: 'stream',
//     }).then(
//         response =>
//             new Promise((resolve, reject) => {
//                 response.data
//                     .pipe(fs.createWriteStream('user.png'))
//                     .on('finish', () => resolve())
//                     .on('error', e => reject(e));
//             }),
//     );

    // Convert the downloaded image to base64
//     let base64str = fs.readFileSync('user.png', { encoding: 'base64' });
//     const userId = ctx.from.id;
//     if (!userData[userId]) {
//         userData[userId] = {};
//     }
//     userData[userId].init_image = base64str;
//
//     await ctx.reply('Image received and saved.');
//
//     const messageID = await startGeneration(ctx);
//     await img2img(ctx, messageID);
// });

bot.action('generate_again', async (ctx) => {
    try {
        const userId = ctx.from.id;
        // Ensure that user data and payload exist
        if (!userData[userId] || !userData[userId].payload) {
            console.error(`User data or payload not found for ID: ${userId}`);
            return;
        }
        // Enqueue the user with stored payload
        enqueueUser(userId, userData[userId].payload);
        await ctx.answerCbQuery('Generating the image again...');
    } catch (error) {
        console.error(`Error in generating image again:`, error);
    }
});


bot.command('generate1', async (ctx) => {
    await img2img(ctx);
});


async function makeRequest(instance) {
    const httpAgent = new http.Agent({keepAlive: true});
    const httpsAgent = new https.Agent({keepAlive: true});

    const response = await axios.get(instance.url, {
        httpAgent: httpAgent,
        httpsAgent: httpsAgent,
    });
}

function createPayload(user) {
    return {
        type: user.type,
        prompt: user.prompt || 'Banana Duck',
        seed: user.seed || -1,
        subseed: user.subseed || -1,
        subseed_strength: user.subseed_strength || 0.8,
        batch_count: user.batch_count || 1,
        steps: user.steps || '25',
        cfg_scale: user.cfg_scale || '6',
        width: user.width || 512,
        height: user.height || 512,
        negative_prompt: user.negative_prompt || 'easynegative, verybadimagenegative_v1.3',
        sampler_index: user.sampler_index || 'Euler',
        send_images: user.send_images || 'true',
        save_images: user.save_images || 'true',
        hr_upscaler: user.hr_upscaler || 'None',
        hr_scale: user.hr_scale || '1.2',
        enable_hr: user.enable_hr || 'false',
        denoising_strength: user.denoising_strength || 0.5
    };
}

bot.launch()

