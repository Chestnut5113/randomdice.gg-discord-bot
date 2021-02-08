import * as Discord from 'discord.js';
import * as firebase from 'firebase-admin';
import { parseStringIntoMs } from '../helper/parseMS';
import cache, { Raffle } from '../helper/cache';
import cooldown from '../helper/cooldown';

async function announceWinner(
    database: firebase.database.Database,
    guild: Discord.Guild
): Promise<void> {
    const channel = guild.channels.cache.get('807229757049012266');
    const ref = database.ref('discord_bot/community/raffle');
    if (channel?.type !== 'text') return;
    let raffle = (await ref.once('value')).val() as Raffle;
    if (!raffle.hostId) {
        return;
    }

    setTimeout(async () => {
        raffle = (await ref.once('value')).val() as Raffle;

        const entries = Object.entries(raffle.tickets ?? {});
        const uniqueEntry = {} as { [uid: string]: string };
        entries.forEach(([, uid]) => {
            if (!uniqueEntry[uid]) {
                uniqueEntry[uid] = uid;
            }
        });
        const winner =
            raffle.tickets[Math.ceil(Math.random() * entries.length)];
        await (channel as Discord.TextChannel).send(
            '<@&804544088153391124>',
            new Discord.MessageEmbed()
                .setAuthor(
                    'randomdice.gg Server',
                    guild.iconURL({ dynamic: true }) ?? undefined
                )
                .setColor('#800080')
                .setTitle('XP Raffle')
                .setDescription(
                    entries.length === 0
                        ? 'Raffle ended but no one entered the raffle.'
                        : `Raffle ended, **${
                              Object.keys(uniqueEntry).length
                          }** people entered the raffle with a total of **${
                              entries.length
                          }** tickets. <@${winner}> walked away grabbing **${
                              entries.length * raffle.ticketCost
                          } exp**. Congratulations!`
                )
                .setFooter('A new round of raffle will be hosted very soon')
        );
        await ref.set({
            endTimestamp: 0,
            hostId: 0,
            maxEntries: 0,
            ticketCost: 0,
        });
    }, Math.max(raffle.endTimestamp - Date.now(), 0));
}

export default async function lotto(
    message: Discord.Message,
    database: firebase.database.Database
): Promise<void> {
    const { channel, member, content, guild, author } = message;

    const [command, subcommand, arg, arg2, arg3] = content
        .split(' ')
        .map(word => word.trim());

    if (!member || !guild || command?.toLowerCase() !== '!raffle') return;

    if (channel.id !== '807229757049012266') {
        await channel.send(
            'You can only use this command in <#807229757049012266>'
        );
        return;
    }

    if (
        await cooldown(message, '!raffle', {
            default: 60 * 1000,
            donator: 60 * 1000,
        })
    ) {
        return;
    }

    const ref = database.ref('discord_bot/community/raffle');
    const raffle = cache['discord_bot/community/raffle'];
    const currentEntries = Object.entries(raffle.tickets ?? {});
    const raffleTimeLeft = raffle.endTimestamp - Date.now();

    switch (subcommand?.toLowerCase()) {
        case 'info':
            if (raffleTimeLeft > 0) {
                await channel.send(
                    new Discord.MessageEmbed()
                        .setAuthor(
                            'randomdice.gg Server',
                            guild.iconURL({ dynamic: true }) ?? undefined
                        )
                        .setColor('#00ff00')
                        .setTitle('XP Raffle')
                        .addField(
                            'Ticket Entries',
                            `**${raffle.ticketCost} xp per ticket** (${raffle.maxEntries} ticket(s) max)`
                        )
                        .addField(
                            'Current Prize Pool',
                            `**${
                                currentEntries.length * raffle.ticketCost
                            } EXP** (${currentEntries.length} Tickets)`
                        )
                        .addField('Hosted by', `<@${raffle.hostId}>`)
                        .addField(
                            'Your Entries',
                            Object.entries(raffle.tickets)
                                .filter(([, uid]) => uid === author.id)
                                .map(([ticketNumber]) => `**${ticketNumber}**`)
                                .join(', ') || '*none*'
                        )
                        .setFooter('Raffle ends at')
                        .setTimestamp(raffle.endTimestamp)
                );
            } else {
                await channel.send(
                    new Discord.MessageEmbed()
                        .setAuthor(
                            'randomdice.gg Server',
                            guild.iconURL({ dynamic: true }) ?? undefined
                        )
                        .setColor('#ff0000')
                        .setTitle('XP Raffle')
                        .setDescription(
                            'There is no active raffle at the moment'
                        )
                );
            }
            return;
        case 'join':
            {
                if (raffleTimeLeft < 0) {
                    await channel.send(
                        new Discord.MessageEmbed()
                            .setAuthor(
                                'randomdice.gg Server',
                                guild.iconURL({ dynamic: true }) ?? undefined
                            )
                            .setColor('#ff0000')
                            .setTitle('XP Raffle')
                            .setDescription(
                                'There is no active raffle at the moment'
                            )
                    );
                    return;
                }
                if (arg === '0') {
                    await channel.send(
                        'You cannot enter the raffle with 0 ticket'
                    );
                    return;
                }
                const currEntry = Number(arg) || 1;
                const prevEntry =
                    currentEntries.filter(([, uid]) => uid === author.id)
                        ?.length || 0;
                const logChannel = guild.channels.cache.get(
                    '806033486850162708'
                );
                if (!Number.isInteger(currEntry) || currEntry < 1) {
                    await channel.send(
                        'Tickets entered should be a positive integer'
                    );
                    return;
                }
                if (logChannel?.type !== 'text') {
                    await channel.send(
                        'Error, <#806033486850162708> does not exist.'
                    );
                    return;
                }
                if (currEntry + prevEntry > raffle.maxEntries) {
                    await channel.send(
                        `You have already entered with ${prevEntry} ticket(s), the max entires allowance per person for this raffle is ${
                            raffle.maxEntries
                        } ticket(s). You can only join with ${
                            raffle.maxEntries - prevEntry
                        } more ticket(s).`
                    );
                    return;
                }
                raffle.tickets = raffle.tickets || {};
                for (
                    let i = currentEntries.length;
                    i < currEntry + currentEntries.length;
                    i += 1
                ) {
                    raffle.tickets[i + 1] = author.id;
                }
                await ref.child('tickets').set(raffle.tickets);
                await (logChannel as Discord.TextChannel).send(
                    `${author} entered the raffle with ${currEntry} ticket(s). Total exp deduction: ${
                        currEntry * raffle.ticketCost
                    }`
                );
                await channel.send(
                    `You have entered the raffle with ${currEntry} ticket(s)${
                        prevEntry > 0
                            ? `, you now have a total of ${
                                  currEntry + prevEntry
                              } ticket(s)`
                            : '.'
                    }\nTicket Numbers: ${Object.entries(raffle.tickets)
                        .filter(([, uid]) => uid === author.id)
                        .map(([ticketNumber]) => `**${ticketNumber}**`)
                        .join(', ')}`
                );
            }
            return;
        case 'host': {
            if (
                !(
                    member.roles.cache.has('805772165394858015') ||
                    member.roles.cache.has('805000661133295616') ||
                    member.hasPermission('ADMINISTRATOR')
                )
            ) {
                await channel.send(
                    'You do not have permission to host a raffle.'
                );
                return;
            }
            const time = parseStringIntoMs(arg);
            const ticketCost = Number(arg2);
            const maxEntries = Number(arg3) || 1;
            if (!time || !ticketCost || !maxEntries) {
                await channel.send(
                    new Discord.MessageEmbed()
                        .setTitle('Command Parse Error')
                        .setColor('#ff0000')
                        .setDescription('usage of the command')
                        .addField(
                            'Hosting a raffle',
                            '`!raffle host <time> <ticketCost> [maxEntries default=1]`' +
                                '\n' +
                                'Example```!raffle host 12h30m 1000\n!raffle host 3d 500 4```'
                        )
                );
                return;
            }
            if (maxEntries < 0 || maxEntries > 50) {
                await channel.send('Max entries should be between 0 - 50');
                return;
            }
            if (time > 604800000) {
                await channel.send('The duration for the raffle is too long.');
                return;
            }
            await ref.set({
                endTimestamp: Date.now() + time,
                hostId: author.id,
                maxEntries,
                ticketCost,
            });
            announceWinner(database, guild);
            await channel.send(
                '<@&804544088153391124>',
                new Discord.MessageEmbed()
                    .setAuthor(
                        'randomdice.gg Server',
                        guild.iconURL({ dynamic: true }) ?? undefined
                    )
                    .setColor('#00ff00')
                    .setTitle('New XP Raffle')
                    .addField(
                        'Ticket Entries',
                        `**${ticketCost} xp per ticket** (${maxEntries} max)`
                    )
                    .addField('Hosted by', `${author}`)
                    .setFooter('Raffle ends at')
                    .setTimestamp(Date.now() + time)
            );
            return;
        }
        case 'cancel':
            if (raffleTimeLeft < 0) {
                await channel.send(
                    new Discord.MessageEmbed()
                        .setAuthor(
                            'randomdice.gg Server',
                            guild.iconURL({ dynamic: true }) ?? undefined
                        )
                        .setColor('#ff0000')
                        .setTitle('XP Raffle')
                        .setDescription(
                            'There is no active raffle at the moment'
                        )
                );
                return;
            }
            if (
                !(
                    member.roles.cache.has('805772165394858015') ||
                    member.roles.cache.has('805000661133295616') ||
                    member.hasPermission('ADMINISTRATOR')
                )
            ) {
                await channel.send(
                    'You do not have permission to cancel a raffle.'
                );
                return;
            }
            await channel.send(
                '⚠️ WARNING ⚠️\n Type `end` to cancel the raffle, the action is irreversible.'
            );
            try {
                await channel.awaitMessages(
                    (newMessage: Discord.Message) =>
                        newMessage.author.id === author.id &&
                        newMessage.content.toLowerCase() === 'end',
                    { time: 60000, max: 1, errors: ['time'] }
                );
                await ref.set({
                    endTimestamp: 0,
                    hostId: 0,
                    maxEntries: 0,
                    ticketCost: 0,
                });
                await channel.send(`${author} has cancelled the raffle.`);
            } catch {
                await channel.send(
                    "Ok, look's like we are not canceling the raffle today."
                );
            }
            return;
        default:
            await channel.send(
                new Discord.MessageEmbed()
                    .setTitle('Command Parse Error')
                    .setColor('#ff0000')
                    .setDescription('usage of the command')
                    .addField(
                        'Joining the raffle',
                        '`!raffle join [ticket Amount default=1]`' +
                            '\n' +
                            'Example```!raffle join\n!raffle join 10```'
                    )
                    .addField(
                        'Showing the info for current raffle',
                        '`!raffle info`\nExample```!raffle info```'
                    )
                    .addField(
                        'Hosting a raffle (requires Event Manager)',
                        '`!raffle host <time> <ticketCost> [maxEntries default=1]`' +
                            '\n' +
                            'Example```!raffle host 12h30m 1000\n!raffle host 3d 500 4```'
                    )
                    .addField(
                        'Canceling a raffle (requires Event Manager)',
                        '`!raffle cancel`' +
                            '\n' +
                            'Example```!raffle cancel```'
                    )
            );
    }
}

export async function setTimerOnBoot(
    client: Discord.Client,
    database: firebase.database.Database
): Promise<void> {
    const guild = await client.guilds.fetch('804222694488932362');
    if (!guild) return;
    announceWinner(database, guild);
}
