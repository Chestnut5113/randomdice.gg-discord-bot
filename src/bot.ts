import * as Discord from 'discord.js';
import * as admin from 'firebase-admin';
import help from './commands/help';
import postNow from './commands/postNow';
import { register, unregister } from './commands/register';
import updateListener from './helper/updateListener';
import sendLink from './commands/sendLinks';
import ping from './commands/ping';
import dice from './commands/dice';
import deck from './commands/deck';
import guide from './commands/guide';
import boss from './commands/boss';
import randomTip from './commands/tip';

const client = new Discord.Client();
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: 'random-dice-web',
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
            /\\n/g,
            '\n'
        ),
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    }),
    databaseURL: 'https://random-dice-web.firebaseio.com/',
    databaseAuthVariableOverride: {
        uid: 'discord-bot',
    },
});

const database = admin.database();
updateListener(client, database);

client.on('ready', () => {
    client.user?.setActivity('.gg help', {
        type: 'PLAYING',
    });
    (
        (client.channels.cache.get(
            process.env.DEV_SERVER_LOG_CHANNEL_ID || ''
        ) as Discord.TextChannel) || undefined
    )?.send(
        `Timestamp: ${new Date().toTimeString()}, bot is booted on ${
            process.env.NODE_ENV
        }`
    );
});

client.on('message', async message => {
    const { content, channel, guild, author } = message;
    const [suffix, command] = content.split(' ');
    if (
        process.env.NODE_ENV === 'development' &&
        guild?.id !== process.env.DEV_SERVER_ID
    ) {
        return;
    }
    if (suffix !== '.gg' || !command || author.bot) {
        return;
    }
    try {
        switch (command.toLowerCase()) {
            case 'ping': {
                await ping(message);
                break;
            }
            case 'register': {
                await register(message, database);
                break;
            }
            case 'unregister': {
                await unregister(message, database);
                break;
            }
            case 'postnow': {
                await postNow(message, client, database);
                break;
            }
            case 'dice': {
                await dice(message, database);
                break;
            }
            case 'guide': {
                await guide(message, database);
                break;
            }
            case 'deck': {
                await deck(message, database);
                break;
            }
            case 'boss': {
                await boss(message, database);
                break;
            }
            case 'help': {
                await help(message);
                break;
            }
            case 'randomtip': {
                await randomTip(message, database);
                break;
            }
            case 'website':
            case 'app':
            case 'support':
                await sendLink(message);
                break;
            default:
                await channel.send(
                    `Hi! I am awake. But I don't understand your command for \`${command}\``
                );
        }
    } catch (err) {
        try {
            await channel.send(`Oops, something went wrong: ${err.message}`);
        } catch (criticalError) {
            // eslint-disable-next-line no-console
            console.error(criticalError);
        }
    }
});

client.login(process.env.BOT_TOKEN);
