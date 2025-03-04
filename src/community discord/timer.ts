import { timeDice } from 'config/emojiId';
import { isBanAppealDiscord } from 'config/guild';
import {
    ApplicationCommandData,
    Client,
    CommandInteraction,
    Guild,
    GuildMember,
    Message,
    MessageEmbed,
    TextBasedChannel,
} from 'discord.js';
import { database } from 'register/firebase';
import { promisify } from 'util';
import cache from 'util/cache';
import parseMsIntoReadableText, { parseStringIntoMs } from 'util/parseMS';
import { suppressUnknownMessage } from 'util/suppressErrors';
import banOnTimerEnds from './moderation/ban appeal/banOnTimerEnds';

const wait = promisify(setTimeout);

async function killTimerFromDB(timerKey: string): Promise<void> {
    try {
        await database
            .ref('discord_bot/community/timer')
            .child(timerKey)
            .set(null);
    } catch (err) {
        // silent
    }
}

function parseTimeText(time: number): string {
    return `__${parseMsIntoReadableText(time, true)
        .split(' ')
        .slice(0, 3)
        .map(timeString =>
            timeString.replace(
                /\d{0,2}(?:\.\d)?/,
                (match, i, arr) =>
                    `**${
                        i + 1 === arr.length ? Math.round(Number(match)) : match
                    }** `
            )
        )
        .join(' ')}__`;
}

async function tickTimer(
    message: Message,
    hostId: string,
    endTime: number,
    key: string
): Promise<void> {
    const { embeds, channel, reactions, guild, id, client } = message;
    const embed = embeds?.[0];
    if (!embed || !cache['discord_bot/community/timer'][key]) {
        killTimerFromDB(key);
        return;
    }
    const tick = async () => {
        const now = Date.now();
        if (now <= endTime) {
            const newText = parseTimeText(endTime - now);
            if (newText !== embed.description) {
                await message.edit({
                    embeds: [embed.setDescription(newText)],
                });
            }
            await wait(5000);
            await tick();
        } else {
            killTimerFromDB(key);
            await message.edit({
                embeds: [embed.setDescription('**Timer Ended**')],
            });
            const timerReact = reactions.cache.find(
                reaction => reaction.emoji.toString() === timeDice
            );
            const userList = (await timerReact?.users.fetch())
                ?.filter(user => !user.bot && user.id !== hostId)
                .map(user => user.toString())
                .join(' ');
            const messageOption = {
                content: `<@${hostId}> ${
                    // eslint-disable-next-line no-nested-ternary
                    userList
                        ? userList.length < 2048
                            ? userList
                            : `Too many user reacted to the timer, cannot ping everyone.\n${userList.slice(
                                  0,
                                  89
                              )}`
                        : ''
                }`,
                embeds: [
                    new MessageEmbed().setDescription(
                        `The [timer](https://discord.com/channels/${
                            (guild as Guild).id
                        }/${channel.id}/${id})${
                            embed.title ? ` for **${embed.title}**` : ''
                        } has ended.`
                    ),
                ],
            };
            const originalMessage = await channel.messages
                .fetch(id)
                .catch(suppressUnknownMessage);
            if (originalMessage) {
                await originalMessage.reply(messageOption);
            } else {
                await channel.send(messageOption);
            }
            if (
                embed.title ===
                    'You have 24 hours to respond to this appeal ticket or you will be banned' &&
                isBanAppealDiscord(guild) &&
                hostId === client.user?.id
            ) {
                await banOnTimerEnds(channel);
            }
        }
    };
    await tick();
}

export async function setTimer(
    channel: TextBasedChannel,
    member: GuildMember,
    title: string,
    time: number
): Promise<void> {
    const endTime = Date.now() + time;

    const timerMessage = await channel.send({
        embeds: [
            new MessageEmbed()
                .setAuthor({
                    name: `${member.displayName}'s Timer`,
                    iconURL: member.displayAvatarURL({ dynamic: true }),
                })
                .setTitle(title)
                .setColor(member.displayHexColor)
                .setFooter({
                    text: 'Timer ends at',
                    iconURL: member.guild.emojis.cache.find(
                        emoji => emoji.toString() === timeDice
                    )?.url,
                })
                .setTimestamp(endTime)
                .setDescription(parseTimeText(time)),
        ],
    });
    const ref = database.ref('discord_bot/community/timer').push();
    await ref.set({
        guildId: member.guild.id,
        channelId: channel.id,
        messageId: timerMessage.id,
        hostId: member.id,
        endTime,
    });
    await Promise.all([
        tickTimer(timerMessage, member.id, endTime, ref.key as string),
        timerMessage.react(timeDice),
    ]);
}

export default async function timerCommand(
    interaction: CommandInteraction
): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const { guild, member, channel } = interaction;

    if (!channel) return;

    if (interaction.options.getSubcommand(true) === 'cancel') {
        const timerId = interaction.options.getString('message-id', true);
        const existingTimer = Object.entries(
            cache['discord_bot/community/timer']
        ).find(([, timer]) => timer.messageId === timerId);
        if (!existingTimer) {
            await interaction.reply('No active timer found.');
            return;
        }
        const [key, timer] = existingTimer;
        const timerChannel = guild.channels.cache.get(timer.channelId);
        if (!timerChannel?.isText()) {
            await interaction.reply('No active timer found.');
            return;
        }
        if (
            !timerChannel.permissionsFor(member)?.has('MANAGE_MESSAGES') &&
            existingTimer?.[1].hostId !== member.id
        ) {
            await interaction.reply(
                `You do not have permission to end that timer. You need to either be the one started that timer or have \`MANAGE_MESSAGE\` permission in <#${timer.channelId}>`
            );
            return;
        }
        killTimerFromDB(key);
        (
            await timerChannel.messages
                .fetch(timerId)
                .catch(suppressUnknownMessage)
        )?.delete();
        await interaction.reply('Killed timer.');
        return;
    }

    const time = parseStringIntoMs(interaction.options.getString('time', true));
    const msg =
        interaction.options.getString('title') ??
        `${member.displayName}'s Timer`;

    if (!time) {
        await interaction.reply(
            'Invalid time string. Time string should be like `1d2h3m4s`'
        );
        return;
    }
    await interaction.deferReply();
    await setTimer(channel, member, msg, time);
    await interaction.deleteReply();
}

export async function registerTimer(client: Client): Promise<void> {
    const data = cache['discord_bot/community/timer'];
    Object.entries(data || {}).forEach(async ([key, timer]) => {
        try {
            const guild = client.guilds.cache.get(timer.guildId);
            if (!guild) {
                killTimerFromDB(key);
                return;
            }

            const channel = guild.channels.cache.get(timer.channelId);
            if (!channel?.isText()) {
                killTimerFromDB(key);
                return;
            }

            const message = await channel.messages.fetch(timer.messageId);
            if (!message) {
                killTimerFromDB(key);
                return;
            }

            await tickTimer(message, timer.hostId, timer.endTime, key);
        } catch (err) {
            killTimerFromDB(key);
        }
    });
}

export const commandData: ApplicationCommandData = {
    name: 'timer',
    description: 'timer',
    options: [
        {
            name: 'set',
            description: 'Set a timer',
            type: 1,
            options: [
                {
                    name: 'time',
                    description: 'The time string to set the timer for',
                    required: true,
                    type: 3,
                },
                {
                    name: 'title',
                    description: 'The title of the timer',
                    type: 3,
                },
            ],
        },
        {
            name: 'cancel',
            description: 'Cancel a timer',
            type: 1,
            options: [
                {
                    name: 'message-id',
                    description: 'The message id of the timer to cancel',
                    required: true,
                    type: 3,
                },
            ],
        },
    ],
};
