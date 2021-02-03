import * as Discord from 'discord.js';
import cache from '../helper/cache';
import cooldown from '../helper/cooldown';

export default async function RandomDeck(
    message: Discord.Message
): Promise<void> {
    const { channel } = message;

    if (
        await cooldown(message, '.gg randomdeck', {
            default: 5 * 1000,
            donator: 1 * 1000,
        })
    ) {
        return;
    }
    const emoji = cache['discord_bot/emoji'];
    const shuffleArray = Object.keys(emoji)
        .filter(key => key !== '-1')
        .map(key => Number(key)) as number[];
    shuffleArray.forEach((_, i) => {
        const random = Math.floor(Math.random() * i);
        [shuffleArray[i], shuffleArray[random]] = [
            shuffleArray[random],
            shuffleArray[i],
        ];
    });
    const pick5dice = shuffleArray.slice(0, 5).map(id => emoji[id]);
    await channel.send(pick5dice.join(''));
}
