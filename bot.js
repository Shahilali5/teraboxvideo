const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');

// Load environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const adminChatId = process.env.ADMIN_CHAT_ID;
const imageUrl = process.env.IMAGE_URL;

const bot = new Telegraf(token);

// Terabox API endpoint
const apiEndpoint = 'https://teraboxvideodownloader.nepcoderdevs.workers.dev/?url=';

// Middleware to check if user is in the channel
async function checkUserInChannel(ctx, next) {
    const userId = ctx.from.id;

    try {
        const member = await ctx.telegram.getChatMember(channelId, userId);
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            return next();
        } else {
            await sendJoinMessage(ctx);
        }
    } catch (error) {
        console.error(error);
        await reportErrorToAdmin(error, ctx);
        await sendJoinMessage(ctx);
    }
}

async function sendJoinMessage(ctx) {
    await ctx.replyWithPhoto(
        imageUrl,
        {
            caption: 'Please join our channel to use this bot.',
            reply_markup: Markup.inlineKeyboard([
                Markup.button.url('Join Channel', `https://t.me/${channelId.replace('@', '')}`),
                Markup.button.callback('Joined 🟢', 'check_joined')
            ])
        }
    );
}

async function reportErrorToAdmin(error, ctx) {
    await bot.telegram.sendMessage(adminChatId, `Error occurred: ${error.message}\nUser: ${ctx.from.id} (${ctx.from.username})`);
}

async function notifyAdminNewMember(ctx) {
    await bot.telegram.sendMessage(adminChatId, `New member joined the channel: ${ctx.from.id} (${ctx.from.username})`);
}

bot.start(async (ctx) => {
    await checkUserInChannel(ctx, async () => {
        ctx.reply('Welcome! Send me a Terabox video URL to download.');
    });
});

bot.on('text', checkUserInChannel, async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.message.chat.id;

    if (text && text.startsWith('http')) {
        await ctx.reply('Processing your request...');

        try {
            const response = await fetch(`${apiEndpoint}${encodeURIComponent(text)}`);
            const data = await response.json();
            const videoUrl = data.downloadUrl;

            if (videoUrl) {
                await ctx.reply(`Here is your download link: ${videoUrl}`);
            } else {
                await ctx.reply('Failed to retrieve the video. Please check the URL and try again.');
            }
        } catch (error) {
            console.error(error);
            await reportErrorToAdmin(error, ctx);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    }
});

bot.action('check_joined', async (ctx) => {
    const userId = ctx.from.id;

    try {
        const member = await ctx.telegram.getChatMember(channelId, userId);
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            await notifyAdminNewMember(ctx);
            await ctx.reply('Thank you for joining! You can now send me a Terabox video URL to download.');
        } else {
            await ctx.reply('You must join the channel to use this bot. ❌');
        }
    } catch (error) {
        console.error(error);
        await reportErrorToAdmin(error, ctx);
        await ctx.reply('An error occurred while checking your status. Please try again later.');
    }
});

bot.launch();
console.log('Bot is running...')
