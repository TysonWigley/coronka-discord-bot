import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

const GAME = {
  arena: { name: 'Coronka Arena', role: 'Arena Player', lfg: 'arena-find-a-game', feedback: 'arena-feedback' },
  duel: { name: 'Coronka Duel', role: 'Duel Player', lfg: 'duel-find-a-game', feedback: 'duel-feedback' },
  kingdoms: { name: 'Kingdoms of Coronka', role: 'Kingdoms Player', lfg: 'kingdoms-find-a-game', feedback: 'kingdoms-feedback' },
  overall: { name: 'Coronka', feedback: 'general-feedback' },
};

const lfgs = new Map();
const feedbackVotes = new Map();
const playtests = new Map();

async function ensureRole(guild, name, permissions = []) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name, permissions, reason: 'Coronka server setup' });
  return role;
}

async function ensureCategory(guild, name) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return ch;
}

async function ensureText(guild, category, name, topic = '') {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic });
  return ch;
}

async function setupGuild(guild) {
  const admin = await ensureRole(guild, 'Admin', [PermissionFlagsBits.Administrator]);
  const mod = await ensureRole(guild, 'Moderator', [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ViewAuditLog,
  ]);
  await ensureRole(guild, 'Arena Player');
  await ensureRole(guild, 'Duel Player');
  await ensureRole(guild, 'Kingdoms Player');
  await ensureRole(guild, 'Playtester');

  const start = await ensureCategory(guild, '👑 START HERE');
  await ensureText(guild, start, 'welcome', 'Welcome to the official Coronka community.');
  await ensureText(guild, start, 'rules', 'Community rules and expectations.');
  await ensureText(guild, start, 'choose-your-games', 'Choose which Coronka games you play.');
  await ensureText(guild, start, 'announcements', 'Official Coronka announcements.');

  const community = await ensureCategory(guild, '🏰 CORONKA COMMUNITY');
  await ensureText(guild, community, 'general', 'General Coronka discussion.');
  await ensureText(guild, community, 'screenshots-and-clips', 'Share moments from your Coronka games.');
  await ensureText(guild, community, 'general-feedback', 'Feedback about Coronka overall.');
  await ensureText(guild, community, 'off-topic', 'Community conversation beyond Coronka.');

  const arena = await ensureCategory(guild, '⚔️ CORONKA ARENA');
  await ensureText(guild, arena, 'arena-discussion', 'Discuss Coronka Arena.');
  await ensureText(guild, arena, 'arena-strategy', 'Arena strategy and tactics.');
  await ensureText(guild, arena, 'arena-ranked', 'Ranked Arena discussion.');
  await ensureText(guild, arena, 'arena-find-a-game', 'Post Arena room codes and find players.');
  await ensureText(guild, arena, 'arena-feedback', 'Public Arena feedback and voting.');

  const duel = await ensureCategory(guild, '🛡️ CORONKA DUEL');
  await ensureText(guild, duel, 'duel-discussion', 'Discuss Coronka Duel.');
  await ensureText(guild, duel, 'duel-strategy', 'Duel strategy and tactics.');
  await ensureText(guild, duel, 'duel-find-a-game', 'Post Duel room codes and find players.');
  await ensureText(guild, duel, 'duel-feedback', 'Public Duel feedback and voting.');

  const kingdoms = await ensureCategory(guild, '🏯 KINGDOMS OF CORONKA');
  await ensureText(guild, kingdoms, 'kingdoms-development', 'Discuss the development of Kingdoms of Coronka.');
  await ensureText(guild, kingdoms, 'kingdoms-strategy', 'Kingdoms strategy and theorycrafting.');
  await ensureText(guild, kingdoms, 'kingdoms-find-a-game', 'Find Kingdoms playtest players.');
  await ensureText(guild, kingdoms, 'kingdoms-feedback', 'Public Kingdoms feedback and voting.');
  await ensureText(guild, kingdoms, 'kingdoms-changelog', 'Official Kingdoms development updates.');

  const events = await ensureCategory(guild, '📅 PLAYTESTS & EVENTS');
  await ensureText(guild, events, 'playtest-announcements', 'Official scheduled playtests.');
  await ensureText(guild, events, 'playtest-chat', 'Coordinate and discuss official playtests.');

  const staff = await ensureCategory(guild, '🔒 STAFF');
  if (!guild.channels.cache.find(c => c.name === 'staff-chat')) {
    await guild.channels.create({
      name: 'staff-chat', type: ChannelType.GuildText, parent: staff.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: admin.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: mod.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }
  if (!guild.channels.cache.find(c => c.name === 'mod-log')) {
    await guild.channels.create({
      name: 'mod-log', type: ChannelType.GuildText, parent: staff.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: admin.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: mod.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }
}

function roleButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('role:arena').setLabel('Arena Player').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('role:duel').setLabel('Duel Player').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('role:kingdoms').setLabel('Kingdoms Player').setStyle(ButtonStyle.Primary).setEmoji('🏯'),
    new ButtonBuilder().setCustomId('role:playtester').setLabel('Playtester').setStyle(ButtonStyle.Secondary).setEmoji('🧪'),
  );
}

function lfgEmbed(data) {
  const joined = data.users.length;
  const mode = data.game === 'arena' ? `\n**Mode:** ${data.mode === 'ranked' ? 'Ranked' : 'Casual'}` : '';
  return new EmbedBuilder()
    .setTitle(`${GAME[data.game].name} — Looking for Players`)
    .setDescription(`**Host:** <@${data.host}>\n**Room Code:** \`${data.roomCode}\`\n**Players:** ${joined}/${data.players}${mode}\n**Voice:** ${data.voice ? 'Temporary VC enabled' : 'No voice room'}`)
    .setFooter({ text: 'Use Join/Leave below. Room codes are entered on coronka.com.' });
}

function lfgButtons(id, full = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lfgjoin:${id}`).setLabel(full ? 'Full' : 'Join Game').setStyle(ButtonStyle.Success).setDisabled(full),
    new ButtonBuilder().setCustomId(`lfgleave:${id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lfgclose:${id}`).setLabel('Close').setStyle(ButtonStyle.Danger),
  );
}

function feedbackEmbed(data) {
  return new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.details)
    .addFields(
      { name: 'Game', value: GAME[data.game].name, inline: true },
      { name: 'Type', value: data.type, inline: true },
      { name: 'Status', value: data.status ?? 'Open', inline: true },
      { name: 'Votes', value: `👍 ${data.up.size}   👎 ${data.down.size}` },
    )
    .setFooter({ text: `Submitted by ${data.authorName}` });
}

function feedbackButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`fbup:${id}`).setLabel('Upvote').setEmoji('👍').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`fbdown:${id}`).setLabel('Downvote').setEmoji('👎').setStyle(ButtonStyle.Danger),
  );
}

client.once('ready', () => console.log(`Coronka bot online as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup') {
        await interaction.deferReply({ ephemeral: true });
        await setupGuild(interaction.guild);
        return interaction.editReply('Coronka server structure created. Run `/roles` in #choose-your-games next.');
      }

      if (interaction.commandName === 'roles') {
        const embed = new EmbedBuilder()
          .setTitle('Choose Your Coronka Games')
          .setDescription('Pick any roles you want. Click again to remove a role.\n\n⚔️ **Arena Player**\n🛡️ **Duel Player**\n🏯 **Kingdoms Player**\n🧪 **Playtester**');
        return interaction.reply({ embeds: [embed], components: [roleButtons()] });
      }

      if (interaction.commandName === 'findgame') {
        const game = interaction.options.getString('game');
        const roomCode = interaction.options.getString('room_code').trim();
        const players = interaction.options.getInteger('players');
        const voice = interaction.options.getBoolean('voice') ?? false;
        let mode = interaction.options.getString('mode');
        if (game === 'arena' && !mode) mode = 'casual';
        if (game !== 'arena') mode = null;

        const channel = interaction.guild.channels.cache.find(c => c.name === GAME[game].lfg);
        if (!channel) return interaction.reply({ content: 'Run `/setup` first.', ephemeral: true });

        const id = `${Date.now()}-${interaction.user.id}`;
        const data = { id, game, roomCode, players, voice, mode, host: interaction.user.id, users: [interaction.user.id], voiceChannelId: null };
        const msg = await channel.send({ embeds: [lfgEmbed(data)], components: [lfgButtons(id)] });
        data.messageId = msg.id;
        data.channelId = channel.id;
        lfgs.set(id, data);
        return interaction.reply({ content: `Your ${GAME[game].name} LFG is live in <#${channel.id}>.`, ephemeral: true });
      }

      if (interaction.commandName === 'feedback') {
        const game = interaction.options.getString('game');
        const channel = interaction.guild.channels.cache.find(c => c.name === GAME[game].feedback);
        if (!channel) return interaction.reply({ content: 'Run `/setup` first.', ephemeral: true });
        const id = `${Date.now()}-${interaction.user.id}`;
        const data = {
          id, game,
          type: interaction.options.getString('type'),
          title: interaction.options.getString('title'),
          details: interaction.options.getString('details'),
          authorName: interaction.user.username,
          up: new Set(), down: new Set(), status: 'Open',
        };
        const msg = await channel.send({ embeds: [feedbackEmbed(data)], components: [feedbackButtons(id)] });
        data.messageId = msg.id;
        data.channelId = channel.id;
        feedbackVotes.set(id, data);
        return interaction.reply({ content: `Feedback posted in <#${channel.id}> for public voting.`, ephemeral: true });
      }

      if (interaction.commandName === 'playtest') {
        const game = interaction.options.getString('game');
        const when = interaction.options.getString('when');
        const notes = interaction.options.getString('notes');
        const max = interaction.options.getInteger('max_players');
        const channel = interaction.guild.channels.cache.find(c => c.name === 'playtest-announcements');
        if (!channel) return interaction.reply({ content: 'Run `/setup` first.', ephemeral: true });
        const id = `${Date.now()}`;
        const data = { game, when, notes, max, users: new Set() };
        playtests.set(id, data);
        const embed = new EmbedBuilder()
          .setTitle(`Official Playtest — ${GAME[game].name}`)
          .setDescription(`**When:** ${when}\n\n${notes}\n\n**RSVPs:** 0${max ? `/${max}` : ''}`)
          .setFooter({ text: 'Official Coronka playtest' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ptrsvp:${id}`).setLabel('RSVP').setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder().setCustomId(`ptleave:${id}`).setLabel('Cancel RSVP').setStyle(ButtonStyle.Secondary),
        );
        const playtester = interaction.guild.roles.cache.find(r => r.name === 'Playtester');
        await channel.send({
          content: playtester ? `<@&${playtester.id}>` : '',
          embeds: [embed],
          components: [row],
          allowedMentions: { roles: playtester ? [playtester.id] : [] }
        });
        return interaction.reply({ content: `Playtest posted in <#${channel.id}>.`, ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('role:')) {
        const key = interaction.customId.split(':')[1];
        const names = { arena: 'Arena Player', duel: 'Duel Player', kingdoms: 'Kingdoms Player', playtester: 'Playtester' };
        const role = interaction.guild.roles.cache.find(r => r.name === names[key]);
        if (!role) return interaction.reply({ content: 'Role not found. Ask an admin to run `/setup`.', ephemeral: true });
        const member = interaction.member;
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          return interaction.reply({ content: `Removed **${role.name}**.`, ephemeral: true });
        }
        await member.roles.add(role);
        return interaction.reply({ content: `Added **${role.name}**.`, ephemeral: true });
      }

      if (interaction.customId.startsWith('lfg')) {
        const [action, id] = interaction.customId.split(':');
        const data = lfgs.get(id);
        if (!data) return interaction.reply({ content: 'This LFG is no longer active.', ephemeral: true });

        if (action === 'lfgclose') {
          const canClose = interaction.user.id === data.host || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
          if (!canClose) return interaction.reply({ content: 'Only the host or a moderator can close this LFG.', ephemeral: true });
          if (data.voiceChannelId) await interaction.guild.channels.cache.get(data.voiceChannelId)?.delete().catch(() => {});
          lfgs.delete(id);
          await interaction.message.edit({ components: [], embeds: [lfgEmbed(data).setFooter({ text: 'LFG closed.' })] });
          return interaction.reply({ content: 'LFG closed.', ephemeral: true });
        }

        if (action === 'lfgjoin') {
          if (!data.users.includes(interaction.user.id) && data.users.length < data.players) data.users.push(interaction.user.id);
          if (data.voice && !data.voiceChannelId) {
            const vc = await interaction.guild.channels.create({
              name: `${GAME[data.game].name} • ${data.roomCode}`.slice(0, 90),
              type: ChannelType.GuildVoice,
              userLimit: data.players,
              reason: 'Temporary Coronka LFG voice room',
            });
            data.voiceChannelId = vc.id;
          }
          const full = data.users.length >= data.players;
          await interaction.message.edit({ embeds: [lfgEmbed(data)], components: [lfgButtons(id, full)] });
          return interaction.reply({ content: `Joined. Room code: \`${data.roomCode}\`${data.voiceChannelId ? ` • Voice: <#${data.voiceChannelId}>` : ''}`, ephemeral: true });
        }

        if (action === 'lfgleave') {
          if (interaction.user.id === data.host) return interaction.reply({ content: 'The host should use **Close** instead.', ephemeral: true });
          data.users = data.users.filter(u => u !== interaction.user.id);
          await interaction.message.edit({ embeds: [lfgEmbed(data)], components: [lfgButtons(id, false)] });
          return interaction.reply({ content: 'You left this LFG.', ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('fb')) {
        const [action, id] = interaction.customId.split(':');
        const data = feedbackVotes.get(id);
        if (!data) return interaction.reply({ content: 'This feedback vote is no longer active.', ephemeral: true });
        const uid = interaction.user.id;
        if (action === 'fbup') {
          if (data.up.has(uid)) data.up.delete(uid); else { data.up.add(uid); data.down.delete(uid); }
        } else {
          if (data.down.has(uid)) data.down.delete(uid); else { data.down.add(uid); data.up.delete(uid); }
        }
        await interaction.message.edit({ embeds: [feedbackEmbed(data)], components: [feedbackButtons(id)] });
        return interaction.reply({ content: 'Vote updated.', ephemeral: true });
      }

      if (interaction.customId.startsWith('pt')) {
        const [action, id] = interaction.customId.split(':');
        const data = playtests.get(id);
        if (!data) return interaction.reply({ content: 'This playtest RSVP is no longer active.', ephemeral: true });
        if (action === 'ptrsvp') {
          if (data.max && data.users.size >= data.max && !data.users.has(interaction.user.id)) return interaction.reply({ content: 'This playtest is full.', ephemeral: true });
          data.users.add(interaction.user.id);
        } else data.users.delete(interaction.user.id);
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.setDescription(`**When:** ${data.when}\n\n${data.notes}\n\n**RSVPs:** ${data.users.size}${data.max ? `/${data.max}` : ''}`);
        await interaction.message.edit({ embeds: [embed] });
        return interaction.reply({ content: action === 'ptrsvp' ? 'You are RSVP’d.' : 'Your RSVP was removed.', ephemeral: true });
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
  }
});

client.on('voiceStateUpdate', async (oldState) => {
  const left = oldState.channel;
  if (!left || left.type !== ChannelType.GuildVoice) return;
  const active = [...lfgs.values()].find(x => x.voiceChannelId === left.id);
  if (active && left.members.size === 0) {
    await left.delete('Empty temporary Coronka LFG voice room').catch(() => {});
    active.voiceChannelId = null;
  }
});

if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
client.login(process.env.DISCORD_TOKEN);
