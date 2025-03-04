import getBrandingEmbed from 'commands/util/getBrandingEmbed';
import { Client, Message, MessageEmbed, WebhookClient } from 'discord.js';
import reboot from 'dev-commands/reboot';
import { devUsersMentions } from 'config/users';
import { devTestServerChannelId } from 'config/channelIds';
import { getDevTestDiscord } from 'config/guild';

// eslint-disable-next-line consistent-return
export default async function log(
    client: Client,
    severity: 'info' | 'warning' | 'error',
    message: unknown = ''
): Promise<Message | ReturnType<WebhookClient['send']>> {
    const messageOption = {
        content: severity === 'error' ? devUsersMentions : undefined,
        embeds: [
            getBrandingEmbed()
                .setDescription(
                    message instanceof Error
                        ? message.stack ?? message.message
                        : String(message)
                )
                .setTitle(`${severity[0].toUpperCase()}${severity.slice(1)}`)
                .setColor(
                    // eslint-disable-next-line no-nested-ternary
                    severity === 'error'
                        ? 0xcc0000
                        : severity === 'warning'
                        ? 0xcccc00
                        : 0x00cc00
                )
                .setAuthor(null)
                .setFooter({
                    text: `env: ${process.env.NODE_ENV}`,
                }),
        ],
    };

    const webhookLogging = new WebhookClient({
        id: '48731927232397312',
        token: process.env.DEV_SERVER_LOG_CHANNEL_WEBHOOK_TOKEN ?? '',
    });

    try {
        const logChannel = getDevTestDiscord(client).channels.cache.get(
            devTestServerChannelId['bot-log']
        );
        return logChannel?.isText()
            ? logChannel.send(messageOption)
            : webhookLogging.send({
                  ...messageOption,
                  content: `${messageOption.content}\n⚠️This is logged with webhook, please check if the channel property is sufficiently supplied.`,
              });
    } catch (networkError) {
        try {
            return webhookLogging.send({
                content: `⚠️⚠️⚠️⚠️⚠️\n${devUsersMentions}\nNormal logging has failed. This message is being sent using the webhook instead.\n⚠️⚠️⚠️⚠️⚠️`,
                embeds: [
                    new MessageEmbed()
                        .setColor('#ff0000')
                        .setTitle('Critical Error Encountered')
                        .setDescription(
                            (networkError as Error).stack ??
                                (networkError as Error).message ??
                                String(networkError)
                        )
                        .setFooter({
                            text: `env: ${process.env.NODE_ENV}`,
                        }),
                ],
            });
        } catch (criticalError) {
            // Even webhook logging failed. This is a critical error. Proceed to log to console.
            // eslint-disable-next-line no-console
            console.error(criticalError);

            // Critical error. Reboot the bot.
            try {
                client.destroy();
                await reboot();
            } catch (rebootError) {
                // eslint-disable-next-line no-console
                console.error(rebootError);
            } finally {
                process.exit(1);
            }
        }
    }
}
