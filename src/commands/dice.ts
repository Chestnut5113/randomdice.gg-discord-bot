import {
    ApplicationCommandDataResolvable,
    CommandInteraction,
    WebhookEditMessageOptions,
} from 'discord.js';

import cache, { Dice } from 'util/cache';
import parsedText from 'util/parseText';
import cooldown from 'util/cooldown';
import { getAscendingNumberArray, mapChoices } from 'register/commandData';
import bestMatchFollowUp from './util/bestMatchFollowUp';
import getBrandingEmbed from './util/getBrandingEmbed';

export default async function dice(
    interaction: CommandInteraction
): Promise<void> {
    const { options } = interaction;

    if (
        await cooldown(interaction, {
            default: 10 * 1000,
            donator: 2 * 1000,
        })
    ) {
        return;
    }

    const dieName = options.getString('die', true);
    const diceList = cache.dice;
    const die = diceList.find(
        ({ name }) => dieName.toLowerCase() === name.toLowerCase()
    );

    const getDiceInfo = (target?: Dice): string | WebhookEditMessageOptions => {
        let minClass: number;
        if (!target) return 'No dice found.';
        switch (target.rarity) {
            case 'Legendary':
                minClass = 7;
                break;
            case 'Unique':
                minClass = 5;
                break;
            case 'Rare':
                minClass = 3;
                break;
            default:
                minClass = 1;
        }

        const firstArgs = dieName.indexOf('-');
        if (firstArgs > -1) {
            const otherArgs = [
                ...dieName
                    .slice(firstArgs, dieName.length)
                    .replace(/(?:-l|--level|-c|--class)[=| +]\w+/gi, '')
                    .matchAll(/--?\w+(?:[=| +]\w+)?/gi),
            ];
            if (otherArgs.length) {
                return `Unknown arguments: ${otherArgs.map(
                    ([arg]) => `\`${arg}\``
                )}. Acceptable arguments are \`--class\` \`--level\` or alias \`-c\` \`-l\``;
            }
        }

        const dieClassArgs = [
            ...dieName
                .slice(firstArgs, dieName.length)
                .matchAll(/(?:-c|--class)[=| +](\w+)/gi),
        ];
        const dieLevelArgs = [
            ...dieName
                .slice(firstArgs, dieName.length)
                .matchAll(/(?:-l|--level)[=| +](\w+)/gi),
        ];
        if (dieClassArgs.length > 1 || dieLevelArgs.length > 1) {
            if (dieClassArgs.length > 1) {
                return `Duplicated arguments for dice class: ${dieClassArgs
                    .map(arg => `\`${arg?.[0]}\``)
                    .join(' ')}`;
            }

            if (dieLevelArgs.length > 1) {
                return `Duplicated arguments for dice level: ${dieLevelArgs
                    .map(arg => `\`${arg?.[0]}\``)
                    .join(' ')}`;
            }
        }
        const dieClassArg =
            interaction instanceof CommandInteraction
                ? interaction.options.getInteger('class')
                : dieClassArgs[0]?.[1];
        const dieLevelArg =
            interaction instanceof CommandInteraction
                ? interaction.options.getInteger('level')
                : dieLevelArgs[0]?.[1];
        const dieClass = Number(dieClassArg || minClass);
        const dieLevel = Number(dieLevelArg || 1);

        if (
            Number.isNaN(dieClass) ||
            Number.isNaN(dieLevel) ||
            dieClass < minClass ||
            dieClass > 15 ||
            dieLevel < 1 ||
            dieLevel > 5
        ) {
            if (Number.isNaN(dieClass)) {
                return `Invalid arguments for dice class, \`${dieClassArg}\` is not a number.`;
            }
            if (dieClass < minClass) {
                return `Invalid arguments for dice class, ${target.name} dice is in **${target.rarity} tier**, its minimum class is **${minClass}**.`;
            }
            if (dieClass > 15) {
                return `Invalid arguments for dice class, the maximum dice class is **15**.`;
            }
            if (Number.isNaN(dieLevel)) {
                return `Invalid arguments for dice level, \`${dieLevelArg}\` is not a number.`;
            }
            if (dieLevel < 1 || dieLevel > 5) {
                return `Invalid arguments for dice level, dice level should be between **1 - 5**.`;
            }
        }
        const atk =
            Math.round(
                (target.atk +
                    target.cupAtk * (dieClass - minClass) +
                    target.pupAtk * (dieLevel - 1)) *
                    100
            ) / 100;
        const spd =
            Math.round(
                (target.spd +
                    target.cupSpd * (dieClass - minClass) +
                    target.pupSpd * (dieLevel - 1)) *
                    100
            ) / 100;
        const eff1 =
            Math.round(
                (target.eff1 +
                    target.cupEff1 * (dieClass - minClass) +
                    target.pupEff1 * (dieLevel - 1)) *
                    100
            ) / 100;
        const eff2 =
            Math.round(
                (target.eff2 +
                    target.cupEff2 * (dieClass - minClass) +
                    target.pupEff2 * (dieLevel - 1)) *
                    100
            ) / 100;

        return {
            embeds: [
                getBrandingEmbed('/wiki/dice_mechanics')
                    .setTitle(`${target.name} Dice`)
                    .setDescription(parsedText(target.detail))
                    .setThumbnail(target.img)
                    .addFields([
                        {
                            name: 'Attack Damage',
                            value: String(atk) || '-',
                            inline: true,
                        },
                        {
                            name: 'Type',
                            value: target.type,
                            inline: true,
                        },
                        {
                            name: 'Attack Speed',
                            value: spd ? `${spd}s` : '-',
                            inline: true,
                        },
                        {
                            name: 'Target',
                            value: target.target,
                            inline: true,
                        },
                        ...(!target.nameEff1 || target.nameEff1 === '-'
                            ? []
                            : [
                                  {
                                      name: target.nameEff1,
                                      value: eff1 + target.unitEff1,
                                      inline: true,
                                  },
                              ]),
                        ...(!target.nameEff2 || target.nameEff2 === '-'
                            ? []
                            : [
                                  {
                                      name: target.nameEff2,
                                      value: eff2 + target.unitEff2,
                                      inline: true,
                                  },
                              ]),
                    ]),
            ],
        };
    };

    if (die) {
        await interaction.reply(getDiceInfo(die));
        return;
    }

    await bestMatchFollowUp(
        interaction,
        dieName,
        diceList,
        ' is not a valid dice.',
        getDiceInfo
    );
}

export const commandData = (
    diceList: Dice[]
): ApplicationCommandDataResolvable => ({
    name: 'dice',
    description: 'get the information about a die',
    options: [
        {
            type: 'STRING',
            name: 'die',
            description: 'the name of the die',
            required: true,
            choices: mapChoices(diceList),
        },
        {
            type: 'INTEGER',
            name: 'class',
            description: 'the class of the die',
            minValue: 1,
            maxValue: 15,
            choices: getAscendingNumberArray(15, 'Class'),
        },
        {
            type: 'INTEGER',
            name: 'level',
            description: 'the level of the die',
            minValue: 1,
            maxValue: 5,
            choices: getAscendingNumberArray(5, 'Level'),
        },
    ],
});
