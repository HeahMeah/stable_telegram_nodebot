const { MenuTemplate, createBackMainMenuButtons } = require('telegraf-inline-menu');
const userData = require('./datastore');

const menu = new MenuTemplate(() => 'Set up generation parameters or just send text with whatever you want to see:');
const submenuSampler = new MenuTemplate(ctx => 'Choose a sampler:')
const submenuQuality = new MenuTemplate(ctx => 'Choose a sampling steps:')
const submenuRes = new MenuTemplate(ctx => 'Choose a resolution:')
const submenuNumpic = new MenuTemplate(ctx => 'Choose a pics :')
const submenuUpscaler = new MenuTemplate(ctx => 'Choose a upscaler:')
const submenuUpscaleTo = new MenuTemplate(ctx => 'Upscale to :')
const submenuCfg = new MenuTemplate(ctx => 'Choose strength of context:')
const submenuSeed = new MenuTemplate(ctx => 'Choose a seed:')
const submenuEmbedding = new MenuTemplate(ctx => 'Choose a embedding:')


const inline_menu_sampler = {
    'Euler': 'Euler',
    'DPM2 Karras': 'DPM2 Karras',
    'DPM++ 2M Karras': 'DPM++ 2M Karras',
    'DPM++ SDE Karras': 'DPM++ SDE Karras'
};

const inline_menu_embedding = {
    'realisticvision-negative-embedding': 'Realistic',
    'anime-style-negative-embedding': 'Anime',
    'easynegative, verybadimagenegative_v1.3': 'Default',
     'ng_deepnegative_v1_75t': 'Overall quality',
}

const inline_menu_res = {
    'horizontal': 'Set to 768x512',
    'vertical': 'Set to 512x768',
    'square': 'Set to 768x768'
};

const inline_menu_quality = {
     20: 'Set to 20',
     30: 'Set to 35',
     50: 'Set to 50'
}

const inline_menu_num_of_pic = {
     2: 'Set to 2 images',
     4: 'Set to 4 images'
}

const inline_menu_upscaler = {
     'rea': 'R-ESRGAN 4x+ Anime6B',
     're': 'ESRGAN_4x',
     'noups': 'Without upscale'

}

const inline_menu_upscale_to = {
    1.1: '1.5',
    1.3:'2',
    1.5:'3'

}

const inline_menu_cfg = {
    6: 'set to 6', 6.5: 'set to 6.5', 7: 'set to 7',
    7.5: 'set to 7.5', 8: 'set to 8', 8.5: 'set to 8.5',
    9: 'set to 9', 9.5: 'set to 9.5', 10: 'set to 10',
    10.5: 'set to 10.5', 11: 'set to 11', 11.5: 'set to 11.5',
    12: 'set to 12', 12.5: 'set to 12.5', 13: 'set to 13',
}


const inline_menu_seed = {
    'randomize': 'Randomize',
    'return_prev': 'Return previous seed'

}


submenuSampler.select('sampler', inline_menu_sampler, {
    set: (ctx, key) => {
        // save user's choice
        const userId = ctx.from.id;
        userData[userId].sampler = key;
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].sampler === key;
    },
    columns: 2
});


submenuEmbedding.select('embedding', inline_menu_embedding, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        userData[userId].embedding = key;
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].embedding === key;
    },
    columns: 2
});


submenuRes.select('res', inline_menu_res, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        switch (key) {
            case 'horizontal':
                userData[userId].width = 768;
                userData[userId].height = 512;
                break;
            case 'vertical':
                userData[userId].width = 512;
                userData[userId].height = 768;
                break;
            case 'square':
                userData[userId].width = 768;
                userData[userId].height = 768;
                break;
        }
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        switch (key) {
            case 'horizontal':
                return userData[userId].width === 768 && userData[userId].height === 512;
            case 'vertical':
                return userData[userId].width === 512 && userData[userId].height === 768;
            case 'square':
                return userData[userId].width === 768 && userData[userId].height === 768;
            default:
                return false;
        }
    },
    columns: 2
});

submenuQuality.select('quality', inline_menu_quality, {
    set: (ctx, key) => {
        // save user's choice
        const userId = ctx.from.id;
        userData[userId].quality = key;
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].quality === key;
    },
    columns: 2
});

submenuNumpic.select('numpic', inline_menu_num_of_pic, {
    set: (ctx, key) => {
        // save user's choice
        const userId = ctx.from.id;
        userData[userId].numpic = key;
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].numpic === key;
    },
    columns: 2
});

submenuUpscaler.select('upscaler', inline_menu_upscaler, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        switch (key) {
            case 're':
                userData[userId].upscaler = 'ESRGAN_4x';
                userData[userId].upscale_on = true;
                ctx.answerCbQuery("You've selected ESRGAN 4x.");
                console.log(userData[userId].upscale_on)
                break;
            case 'rea':
                userData[userId].upscaler = 'R-ESRGAN 4x+ Anime6B';
                userData[userId].upscale_on = true;
                ctx.answerCbQuery("You've selected R-ESRGAN_4x+ Anime6B.");
                break;
            case 'noups':
                userData[userId].upscaler = ''
                userData[userId].upscale_on = 'false'
                break;
        }
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].upscaler === inline_menu_upscaler[key];
    },
    columns: 1
})

submenuUpscaleTo.select('upscale_to', inline_menu_upscale_to, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        userData[userId].upscaleTo = inline_menu_upscale_to[key];
        return true;
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].upscaleTo === inline_menu_upscale_to[key];
    },
    columns: 1
});

submenuCfg.select('cfg', inline_menu_cfg, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        userData[userId].cfg = parseFloat(key);
        return true;
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        return userData[userId].cfg === parseFloat(key);
    },
    columns: 3
});

submenuSeed.select('seed', inline_menu_seed, {
    set: (ctx, key) => {
        const userId = ctx.from.id;
        switch (key) {
            case 'randomize':
                userData[userId].seed = -1;
                ctx.answerCbQuery("You've selected randomize.");
                break;
            case 'return_prev':
                userData[userId].seed = -1; //should implement a mechanism to return the previous seed.
                ctx.answerCbQuery("Returned to the previous seed.");
                break;
        }
        return true; // refresh menu
    },
    isSet: (ctx, key) => {
        const userId = ctx.from.id;
        // Return always false as we don't want to mark any option
        return false;
    },
    columns: 1
});


submenuSampler.manualRow(createBackMainMenuButtons())
submenuQuality.manualRow(createBackMainMenuButtons())
submenuRes.manualRow(createBackMainMenuButtons())
submenuNumpic.manualRow(createBackMainMenuButtons())
submenuUpscaler.manualRow(createBackMainMenuButtons())
submenuUpscaleTo.manualRow(createBackMainMenuButtons())
submenuCfg.manualRow(createBackMainMenuButtons())
submenuSeed.manualRow(createBackMainMenuButtons())
submenuEmbedding.manualRow(createBackMainMenuButtons())



menu.submenu('Sampler', 'sampler', submenuSampler)
menu.submenu('Sampling steps / Качество', 'quality', submenuQuality)
menu.submenu('Resolution / Разрешение', 'res', submenuRes)
menu.submenu('Upscaler', 'upscaler', submenuUpscaler)
menu.submenu('Upscale to', 'upscale_to', submenuUpscaleTo)
menu.submenu('CFG scale', 'cfg', submenuCfg)
menu.submenu('Seed', 'seed', submenuSeed)
menu.submenu('Embedding', 'embedding', submenuEmbedding)
menu.submenu('Number of pictures / Кол-во изображений','numpic', submenuNumpic)


menu.manualRow(createBackMainMenuButtons());

module.exports = menu;
