const { MenuTemplate, MenuMiddleware } = require('telegraf-inline-menu');
const userData = require('./datastore');
const mainMenu = new MenuTemplate(ctx => guide_sections[(userData[ctx.from.id].currentSectionIndex || 0)]);


const guide_sections = [
    'Before you start creating, this bot is made possible by:\n' +
    'Automatic1111 and many model authors from Civitai.com\n' +
    '\n'+
    'On the next page you will learn all about the parameters with which you can get exactly what you want to see :)',
    '𝗦𝗲𝗰𝘁𝗶𝗼𝗻 2\nHere soon about parameters for text2img generation.',
    '*Section 3*\nHere soon about parameters for img2img generation.'
];


mainMenu.interact('Next', 'guide:next_section', {
    do: async (ctx) => {
        userData[ctx.from.id].currentSectionIndex = (userData[ctx.from.id].currentSectionIndex || 0) + 1;
        if (userData[ctx.from.id].currentSectionIndex < guide_sections.length) {
            return true;
        } else {
            await ctx.answerCbQuery('End of the guide');
        }
        return false;
    },
    hide: (ctx) => (userData[ctx.from.id].currentSectionIndex || 0) >= guide_sections.length - 1,
});


mainMenu.interact('Back', 'guide:previous_section', {
    do: async (ctx) => {
        userData[ctx.from.id].currentSectionIndex = (userData[ctx.from.id].currentSectionIndex || 0) - 1;
        return userData[ctx.from.id].currentSectionIndex >= 0;
    },
    hide: (ctx) => (userData[ctx.from.id].currentSectionIndex || 0) <= 0,
});


mainMenu.interact('End Guide', 'guide:end_guide', {
    do: async (ctx) => {
        // TODO: replace the following with a call to the function that opens the 'Generate Txt2Img' menu.
        await ctx.reply('Guide ended. You can now start the Generate Txt2Img process.');
        return false;
    },
    joinLastRow: true
});


const guideMiddleware = new MenuMiddleware('guide/', mainMenu);
module.exports.guideMiddleware = guideMiddleware;