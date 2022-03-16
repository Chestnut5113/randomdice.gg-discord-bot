import {
    ButtonInteraction,
    CommandInteraction,
    ContextMenuInteraction,
    Message,
    ReplyMessageOptions,
    WebhookEditMessageOptions,
} from 'discord.js';
import { APIMessage } from 'discord.js/node_modules/discord-api-types';
import { suppressCannotDmUser } from './suppressErrors';

async function transformApiMessage(
    input:
        | Message
        | ButtonInteraction
        | CommandInteraction
        | ContextMenuInteraction,
    message: Message | APIMessage
): Promise<Message> {
    if (!(message instanceof Message)) {
        const { channel } = input;
        if (!channel) {
            throw new Error(
                'Reply message was not sent because the channel was not found'
            );
        }
        return channel.messages.fetch(message.id);
    }
    return message;
}

export async function reply<TEphemeral extends boolean | undefined = undefined>(
    input:
        | Message
        | ButtonInteraction
        | CommandInteraction
        | ContextMenuInteraction,
    messageOptions: ReplyMessageOptions | string,
    ephemeral?: TEphemeral
): Promise<TEphemeral extends true ? void : Message<boolean>> {
    const finalOption = {
        ephemeral,
        ...(typeof messageOptions === 'string'
            ? { content: messageOptions }
            : messageOptions),
        allowedMentions: { repliedUser: false },
    };

    if (input instanceof Message) {
        if (ephemeral) {
            const dmMessage = await input.author
                .send(finalOption)
                .catch(suppressCannotDmUser);
            if (!dmMessage)
                await input.reply(
                    'I am unable to DM you the message because you have disabled DMs, consider using slash `/` command or enabling DMs.'
                );
        } else {
            return input.reply(finalOption) as Promise<
                TEphemeral extends true ? undefined : Message<boolean>
            >;
        }
    } else if (ephemeral) {
        await input.reply({ ...finalOption, ephemeral: true });
    } else {
        if (!input.deferred) await input.deferReply();
        return transformApiMessage(
            input,
            await input.followUp(finalOption)
        ) as Promise<TEphemeral extends true ? undefined : Message<boolean>>;
    }
    return new Promise(r =>
        r(undefined as TEphemeral extends true ? undefined : Message<boolean>)
    );
}

export async function edit(
    input: Message | ButtonInteraction | CommandInteraction,
    messageOptions: string | WebhookEditMessageOptions
): Promise<Message<boolean>> {
    const finalOption = {
        ...(typeof messageOptions === 'string'
            ? { content: messageOptions }
            : messageOptions),
        allowedMentions: { repliedUser: false },
    };
    if (input instanceof Message) {
        return input.edit(finalOption);
    }

    return transformApiMessage(input, await input.editReply(finalOption));
}
