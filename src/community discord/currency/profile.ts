import * as Discord from 'discord.js';
import getBalance from './balance';
import cache from '../../helper/cache';
import parseMsIntoReadableText from '../../helper/parseMS';

export default async function Profile(message: Discord.Message): Promise<void> {
    const { member, channel, author, guild } = message;
    const numberFormat = new Intl.NumberFormat();

    const balance = await getBalance(message, 'emit new member');
    if (balance === false || !member || !guild) return;

    const prestigeLevels = {
        1: { id: '806312627877838878', coinsNeeded: 196055 },
        2: { id: '806896328255733780', coinsNeeded: 444055 },
        3: { id: '806896441947324416', coinsNeeded: 792055 },
        4: { id: '809142950117245029', coinsNeeded: 1240055 },
        5: { id: '809142956715671572', coinsNeeded: 1788055 },
        6: { id: '809142968434950201', coinsNeeded: 2436055 },
        7: { id: '809143362938339338', coinsNeeded: 3184055 },
        8: { id: '809143374555774997', coinsNeeded: 4032055 },
        9: { id: '809143390791925780', coinsNeeded: 4980055 },
        10: { id: '809143588105486346', coinsNeeded: 6028055 },
    } as {
        [level: number]: {
            id: string;
            coinsNeeded: number;
        };
    };

    function cooldown(
        timestamp = 0,
        mode: 'hourly' | 'daily' | 'weekly' | 'monthly'
    ): string {
        const now = new Date();
        const msNow = now.getMilliseconds();
        const secondsNow = now.getSeconds();
        const minutesNow = now.getMinutes();
        const hoursNow = now.getUTCHours();
        const dayNow = now.getUTCDay();
        const dateNow = now.getUTCDate();
        const monthNow = now.getMonth();
        const yearNow = now.getFullYear();
        let excess = 0;
        let cd = 0;
        switch (mode) {
            case 'hourly':
                excess = msNow + secondsNow * 1000 + minutesNow * 1000 * 60;
                cd = 1000 * 60 * 60;
                break;
            case 'daily':
                excess =
                    msNow +
                    secondsNow * 1000 +
                    minutesNow * 1000 * 60 +
                    hoursNow * 1000 * 60 * 60;
                cd = 1000 * 60 * 60 * 24;

                break;
            case 'weekly':
                excess =
                    msNow +
                    secondsNow * 1000 +
                    minutesNow * 1000 * 60 +
                    hoursNow * 1000 * 60 * 60 +
                    dayNow * 1000 * 60 * 60 * 24;
                cd = 1000 * 60 * 60 * 24 * 7;

                break;
            case 'monthly':
                excess =
                    msNow +
                    secondsNow * 1000 +
                    minutesNow * 1000 * 60 +
                    hoursNow * 1000 * 60 * 60 +
                    dateNow * 1000 * 60 * 60 * 24;
                cd =
                    1000 *
                    60 *
                    60 *
                    24 *
                    new Date(yearNow, monthNow + 1, 0).getDate();
                break;
            default:
        }
        if (now.valueOf() - excess < timestamp) {
            return `⏲️ \`${parseMsIntoReadableText(cd - excess)}\` Cooldown`;
        }
        return '✅ Ready to Claim';
    }

    const profile = cache['discord_bot/community/currency'][member.id];
    const emoji = cache['discord_bot/emoji'];
    const { dice } = cache;
    const drawnDice = ['Common', 'Rare', 'Unique', 'Legendary']
        .flatMap(rarity => dice.filter(d => d.rarity === rarity))
        .flatMap(d => `${emoji[d.id]} x${profile.diceDrawn?.[d.id] || 0}`);
    const progress = balance / prestigeLevels[profile.prestige + 1].coinsNeeded;
    const embed = new Discord.MessageEmbed()
        .setAuthor(
            `${member.displayName}'s Profile`,
            author.avatarURL({ dynamic: true }) ?? author.defaultAvatarURL
        )
        .setColor(
            // eslint-disable-next-line no-nested-ternary
            member.displayHexColor
                ? // eslint-disable-next-line no-nested-ternary
                  member.displayHexColor === '#000000'
                    ? '#010101'
                    : member.displayHexColor === '#ffffff'
                    ? '#fefefe'
                    : member.displayHexColor
                : '#000000'
        )
        .setDescription(
            profile.prestige > 0
                ? `**${guild.roles.cache
                      .get(prestigeLevels[profile.prestige].id)
                      ?.name.toUpperCase()}**`
                : ''
        )
        .addField(
            'Prestige Progress',
            `${new Array(Math.max(0, Math.floor(progress * 10)))
                .fill('■')
                .concat(
                    new Array(
                        Math.min(10 - Math.floor(progress * 10), 10)
                    ).fill('□')
                )
                .join('')} (${Math.floor(progress * 1000) / 10}%)`,
            true
        )
        .addField(
            'Balance',
            `<:Dice_TierX_Coin:813149167585067008> **${numberFormat.format(
                balance
            )}**`,
            true
        )
        .addField(
            'Weekly Chat Points',
            `\`${numberFormat.format(profile.weeklyChat || 0)}\``,
            true
        )
        .addField(
            'Regular Coins Cooldown',
            `${
                profile.dailyStreak && profile.dailyStreak > 1
                    ? `🔥 **${profile.dailyStreak}** Daily Streak\n`
                    : ''
            }**Hourly**\n${cooldown(
                profile.hourly || 0,
                'hourly'
            )}\n**Daily**\n${cooldown(
                profile.daily || 0,
                'daily'
            )}\n**Weekly**\n${cooldown(
                profile.weekly || 0,
                'weekly'
            )}\n**Monthly**\n${cooldown(profile.monthly || 0, 'monthly')}`
        )
        .addField(
            'Gamble Info',
            `Total won: <:Dice_TierX_Coin:813149167585067008> ${numberFormat.format(
                profile.gamble?.gain || 0
            )}\nTotal lose: <:Dice_TierX_Coin:813149167585067008> ${numberFormat.format(
                profile.gamble?.lose || 0
            )}\nTotal earning: <:Dice_TierX_Coin:813149167585067008> ${numberFormat.format(
                (profile.gamble?.gain || 0) - (profile.gamble?.lose || 0)
            )}\n`
        )
        .addFields(
            new Array(Math.ceil(drawnDice.length / 20))
                .fill(' ')
                .map((_, i) => ({
                    name: i === 0 ? 'Dice Drawn' : '‎',
                    value: drawnDice.slice(i * 20, i * 20 + 20).join('  '),
                }))
        );
    await channel.send(embed);
}
