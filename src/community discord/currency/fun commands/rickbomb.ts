import { rickCoin } from 'config/emojiId';
import roleIds from 'config/roleId';
import {
    ApplicationCommandData,
    Collector,
    CommandInteraction,
    Message,
    Snowflake,
    User,
} from 'discord.js';
import { promisify } from 'util';
import cooldown from 'util/cooldown';
import { activeCoinbombInChannel } from '../coinbomb';
import commandCost from './commandCost';

const wait = promisify(setTimeout);

export default async function rickBomb(
    interaction: CommandInteraction,
    replyToInteraction = true
): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const { guild, options, channel: originalChannel } = interaction;
    let channel = originalChannel;

    if (!channel) return;

    const anotherChannel = options.getChannel('channel');

    if (anotherChannel?.isText()) {
        channel = anotherChannel;
    }

    if (
        await cooldown(interaction, {
            default: 60 * 1000 * 5,
            donator: 60 * 1000 * 1,
        })
    ) {
        return;
    }
    if (activeCoinbombInChannel.get(channel.id)) {
        await interaction.reply({
            content: `There is an active coinbomb in ${channel}, you cannot spawn a new one before the last one has ended.`,
            ephemeral: true,
        });
        return;
    }
    if (!(await commandCost(interaction, 500))) return;

    if (replyToInteraction) {
        await interaction.reply({
            content: `${rickCoin} is on the way!`,
            ephemeral: true,
        });
    }
    const rand = Math.random();
    let rngMultiplier: number;
    if (rand > 0.5) {
        rngMultiplier = 1;
    } else if (rand > 0.1) {
        rngMultiplier = 2;
    } else {
        rngMultiplier = 3;
    }

    let messageToSend: string;
    let maxCollectorAllowed: number;
    let collectionTrigger: string;
    let endMessage: (members: User[]) => string;
    const basicCollectionTriggers = [
        'GIMME',
        'MINE',
        'RICK',
        'COLLECT',
        'ROB',
        'GRAB',
        'YOINK',
    ];
    const advancedCollectionTriggers = [
        'OMG Gimme all those',
        'I need all those',
        'PLZ COINS PLZ',
        'I am poor pls donate',
        'Gotta grab them this time',
        'Those are mine',
        'I am gonna yoink them all',
        'I am fan pls give',
    ];
    const uniqueChatters: string[] = [];
    [
        ...channel.messages.cache
            .filter(
                msg =>
                    msg.author &&
                    !msg.author.bot &&
                    Date.now() - msg.createdTimestamp < 60 * 1000
            )
            .values(),
    ]
        .concat(
            channel.messages.cache
                .filter(msg => msg.author && !msg.author.bot)
                .last(10)
        )
        .forEach(msg => {
            if (!uniqueChatters.includes(msg.author.id))
                uniqueChatters.push(msg.author.id);
        });

    if (rngMultiplier === 1) {
        maxCollectorAllowed = Math.ceil(uniqueChatters.length / 2);
        collectionTrigger =
            basicCollectionTriggers[
                Math.floor(basicCollectionTriggers.length * Math.random())
            ];
        messageToSend = `💵💵 A batch of ${rickCoin} rick has shown up, the first ${
            maxCollectorAllowed > 1 ? `${maxCollectorAllowed} people` : 'person'
        } to type \`${collectionTrigger}\` can watch rick roll. 💵💵`;
        endMessage = (members): string =>
            `${rickCoin} ${members.join(' ')} ${
                members.length > 1 ? 'have' : 'has'
            } gone to watch rick roll videos ${rickCoin}`;
    } else if (rngMultiplier === 2) {
        maxCollectorAllowed = Math.ceil(uniqueChatters.length / 10);
        collectionTrigger =
            basicCollectionTriggers[
                Math.floor(basicCollectionTriggers.length * Math.random())
            ];
        messageToSend = `💰💰💰💰 A huge batch of ${rickCoin} rick has shown up. The first ${
            maxCollectorAllowed > 1 ? `${maxCollectorAllowed} people` : 'person'
        } to type \`${collectionTrigger}\` can selfie with rick. 💰💰💰💰`;
        endMessage = (members): string =>
            `${rickCoin} ${members.join(' ')} ${
                members.length > 1 ? 'have' : 'has'
            } ⛏️ up the huge batch of Rick Astley selfies ${rickCoin}`;
    } else {
        collectionTrigger =
            advancedCollectionTriggers[
                Math.floor(advancedCollectionTriggers.length * Math.random())
            ];
        messageToSend = `💎💎💎💎💎💎**BIG MONEY TIME**💎💎💎💎💎💎\n${rickCoin} Rick has shown up. The first one to type \`${collectionTrigger}\` can get rick rolled.`;
        maxCollectorAllowed = 1;
        endMessage = (members): string =>
            `${rickCoin}\n ${members.join(' ')} ${
                members.length > 1 ? 'have' : 'has'
            } got rick roll`;
    }

    const collected: User[] = [];
    const sentMessage = await channel.send(messageToSend);
    activeCoinbombInChannel.set(channel.id, true);
    const collector: Collector<Snowflake, Message> =
        channel.createMessageCollector({
            filter: (m: Message) =>
                m.author &&
                !m.author.bot &&
                m.content.toLowerCase() === collectionTrigger.toLowerCase(),
            time: 20 * 1000,
        });
    collector.on('collect', async (collect: Message) => {
        const { id } = collect.author;
        if (collected.some(user => user.id === id)) return;
        collected.push(collect.author);
        await collect.react(rickCoin);
        await guild.members.cache.get(id)?.roles.add(roleIds.rick);
        await wait(1000 * 60 * 5);
        await guild.members.cache.get(id)?.roles.remove(roleIds.rick);
    });
    collector.on('end', async () => {
        if (channel) activeCoinbombInChannel.set(channel.id, false);
        try {
            if (collected.length > 0) {
                await sentMessage.edit(endMessage(collected));
            } else {
                await sentMessage.delete();
            }
        } catch {
            // nothing
        }
    });
}

export const commandData: ApplicationCommandData = {
    name: 'rickbomb',
    description: 'Spawns a rickbomb',
    options: [
        {
            name: 'channel',
            description: 'The channel to spawn the rickbomb in',
            type: 'CHANNEL',
        },
    ],
};
