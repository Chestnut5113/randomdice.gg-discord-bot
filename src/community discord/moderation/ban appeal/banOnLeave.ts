import { appealServerChannelId } from 'config/channelIds';
import { appealServerRoleIds } from 'config/roleId';
import {
    CategoryChannel,
    GuildMember,
    MessageEmbed,
    PartialGuildMember,
} from 'discord.js';

export default async function banOnLeave(
    member: GuildMember | PartialGuildMember
): Promise<void> {
    const { guild, roles, user, client } = member;

    if (!user) return;

    const auditLogsBans = await guild.fetchAuditLogs({
        limit: 3,
        type: 'MEMBER_BAN_ADD',
    });
    const auditLogsKicks = await guild.fetchAuditLogs({
        limit: 3,
        type: 'MEMBER_KICK',
    });

    if (
        auditLogsBans.entries.some(({ target }) => target?.id === member.id) ||
        auditLogsKicks.entries.some(({ target }) => target?.id === member.id) ||
        roles.cache.hasAny(...Object.values(appealServerRoleIds))
    )
        return;

    await member.ban({
        reason: 'Appeal rejected. Member Left.',
    });
    const appealLog = new MessageEmbed()
        .setAuthor({
            name: member.user.tag,
            iconURL: member.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp()
        .setDescription('Member Left.')
        .addField(
            'Appeal closed by',
            `${client.user?.username ?? ''}\n${client.user}`.trim()
        )
        .setTitle('Appeal rejected')
        .setColor('#ff3434');

    const logChannel = guild.channels.cache.get(appealServerChannelId.log);

    if (logChannel?.isText()) {
        await logChannel.send({ embeds: [appealLog] });
    }

    const appealCat = guild.channels.cache.get(
        appealServerChannelId['Appeal Room']
    );
    if (appealCat instanceof CategoryChannel) {
        const appealRoomsWithoutMember = appealCat.children.filter(
            channel =>
                channel.id !== appealServerChannelId['ban-appeal-discussion'] &&
                channel.isText() &&
                !channel.permissionOverwrites.cache.some(
                    overwrite => overwrite.type === 'member'
                )
        );
        if (appealRoomsWithoutMember.size === 0) {
            return;
        }
        let appealRoom;
        if (appealRoomsWithoutMember.size === 1) {
            appealRoom = appealRoomsWithoutMember.first();
        } else {
            appealRoom = appealRoomsWithoutMember.find(
                channel =>
                    channel.name === `${user.username}-${user.discriminator}`
            );
        }
        if (appealRoom?.isText()) {
            await appealRoom.send({ embeds: [appealLog] });
        }
    }
}
