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
  arena: { name: 'Coronka Arena', role: 'Arena Player', lfg: 'arena-lfg' },
  duel: { name: 'Coronka Duel', role: 'Duel Player', lfg: 'duel-lfg' },
  kingdoms: { name: 'Kingdoms of Coronka', role: 'Kingdoms Player', lfg: 'kingdoms-lfg' },
  overall: { name: 'Coronka' },
};

const OBSOLETE_CHANNELS = [
  'screenshots-and-clips',
  'general-feedback',
  'off-topic',
  'arena-discussion',
  'arena-strategy',
  'arena-ranked',
  'arena-find-a-game',
  'arena-feedback',
  'duel-discussion',
  'duel-strategy',
  'duel-find-a-game',
  'duel-feedback',
  'kingdoms-development',
  'kingdoms-strategy',
  'kingdoms-find-a-game',
  'kingdoms-feedback',
  'kingdoms-changelog',
  'playtest-announcements',
  'playtest-chat',
  'mod-log',
];

const OBSOLETE_CATEGORIES = [
  '⚔️ CORONKA ARENA',
  '🛡️ CORONKA DUEL',
  '🏯 KINGDOMS OF CORONKA',
  '📅 PLAYTESTS & EVENTS',
];

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

async function ensureText(guild, category, name, topic = '', readOnly = false) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
  const permissionOverwrites = readOnly
    ? [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }]
    : [];

  if (!ch) {
    ch = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic,
      permissionOverwrites,
    });
  } else {
    await ch.edit({ parent: category.id, topic, permissionOverwrites }).catch(() => {});
  }
  return ch;
}

async function cleanLegacyLayout(guild) {
  for (const name of OBSOLETE_CHANNELS) {
    const ch = guild.channels.cache.find(c => c.name === name && c.type !== ChannelType.GuildCategory);
    if (ch) await ch.delete('Cleaning old Coronka bot layout').catch(() => {});
  }
  for (const name of OBSOLETE_CATEGORIES) {
    const ch = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
    if (ch) await ch.delete('Cleaning old Coronka bot layout').catch(() => {});
  }
}

async function sendStarterContent(welcome, rules) {
  const rolesChannel = welcome.guild.channels.cache.find(c => c.name === 'choose-your-games');
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('What is Coronka? 👑')
    .setURL('https://coronka.com')
    .setDescription(
      '**Coronka** is a world of three multiplayer strategy board games played at **coronka.com**.\n\n' +
      '**Coronka Duel** — A war of cards - draw, match, and battle your deck against rivals to seize the crown of Coronka.\n\n' +
      '**Coronka Arena** — Enter the Colosseum as a King. Build powerful formations, eliminate your rivals, and emerge as a Gladiator of Coronka.\n\n' +
      '**Kingdoms of Coronka** — Raise castles, command armies, and expand your kingdom across the realm of Coronka. *(Coming soon)*\n\n' +
      '**How to play here**\n' +
      '1. Open **coronka.com** and create or join a game.\n' +
      '2. Use the LFG channels here to post your room code and find players.\n' +
      '3. Join the temporary voice room if you want to talk while you play.\n' +
      (rolesChannel ? '4. Pick your game roles in <#' + rolesChannel.id + '> so people know what you play.\n\n' : '\n') +
      '**Want a match?** Post an LFG, grab a room code, and challenge someone.'
    )
    .setFooter({ text: 'Free to play in your browser • Public beta' });

  const playRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Play Coronka')
      .setStyle(ButtonStyle.Link)
      .setURL('https://coronka.com')
      .setEmoji('🎮')
  );

  const rulesEmbed = new EmbedBuilder()
    .setTitle('Coronka Community Rules')
    .setDescription(
      '**1. Be respectful.** No harassment, hate speech, personal attacks, or targeted hostility.\n\n' +
      '**2. Keep it appropriate.** No NSFW, graphic, illegal, or deliberately shocking content.\n\n' +
      '**3. Do not spam.** Avoid message floods, repeated pings, excessive self-promotion, or disruptive posting.\n\n' +
      '**4. Keep feedback constructive.** Critique the game, not other players. Explain what happened and what you would like improved.\n\n' +
      '**5. Use LFG honestly.** Post real room codes, accurate player counts, and close your LFG when the game is finished.\n\n' +
      '**6. No cheating or exploit abuse.** Do not distribute cheats, automation, exploits, or instructions intended to ruin games for others.\n\n' +
      '**7. Respect staff decisions.** Moderators may remove content or members to keep the community safe and usable.\n\n' +
      '**8. Use common sense.** If something is clearly disruptive or harmful, it does not need a loophole in the rules to be moderated.'
    )
    .setFooter({ text: 'By participating here, you agree to follow these rules.' });

  const recentWelcome = await welcome.messages.fetch({ limit: 25 }).catch(() => null);
  const existingWelcome = recentWelcome?.find(m => m.author.id === client.user.id);
  if (existingWelcome) {
    await existingWelcome.edit({ embeds: [welcomeEmbed], components: [playRow] });
  } else {
    await welcome.send({ embeds: [welcomeEmbed], components: [playRow] });
  }

  const recentRules = await rules.messages.fetch({ limit: 10 }).catch(() => null);
  if (!recentRules?.some(m => m.author.id === client.user.id)) {
    await rules.send({ embeds: [rulesEmbed] });
  }
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
  const welcome = await ensureText(guild, start, 'welcome', 'Start here for the Coronka community.', true);
  const rules = await ensureText(guild, start, 'rules', 'Community rules and expectations.', true);
  await ensureText(guild, start, 'choose-your-games', 'Choose which Coronka games you play.', true);
  await ensureText(guild, start, 'announcements', 'Official Coronka announcements.', true);

  const community = await ensureCategory(guild, '🏰 CORONKA COMMUNITY');
  await ensureText(guild, community, 'general', 'General Coronka discussion.');
  await ensureText(guild, community, 'media', 'Share screenshots, clips, art, and memorable moments.');
  await ensureText(guild, community, 'feedback', 'Public feedback for all Coronka games.');

  const lfg = await ensureCategory(guild, '🎮 FIND A GAME');
  await ensureText(guild, lfg, 'arena-lfg', 'Find players for Coronka Arena.');
  await ensureText(guild, lfg, 'duel-lfg', 'Find players for Coronka Duel.');
  await ensureText(guild, lfg, 'kingdoms-lfg', 'Find players for Kingdoms of Coronka.');
  await ensureText(guild, lfg, 'playtests', 'Official Coronka playtests and RSVPs.', true);

  await ensureCategory(guild, '🔊 TEMP VOICE');

  const staff = await ensureCategory(guild, '🔒 STAFF');
  let staffChat = guild.channels.cache.find(c => c.name === 'staff-chat' && c.type === ChannelType.GuildText);
  if (!staffChat) {
    staffChat = await guild.channels.create({
      name: 'staff-chat',
      type: ChannelType.GuildText,
      parent: staff.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: admin.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: mod.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  } else {
    await staffChat.edit({
      parent: staff.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: admin.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: mod.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    }).catch(() => {});
  }

  await cleanLegacyLayout(guild);
  await sendStarterContent(welcome, rules);
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
    .setDescription(
      `**Host:** <@${data.host}>\n**Room Code:** \`${data.roomCode}\`\n**Players:** ${joined}/${data.players}${mode}\n` +
      `**Voice:** ${data.voiceChannelId ? `<#${data.voiceChannelId}>` : 'Disabled'}`
    )
    .setFooter({ text: 'Use Join/Leave below. Enter the room code at coronka.com.' });
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
        return interaction.editReply('Coronka cleaned up and rebuilt with the streamlined layout. Run `/roles` in #choose-your-games.');
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
        const voice = interaction.options.getBoolean('voice') ?? true;
        let mode = interaction.options.getString('mode');
        if (game === 'arena' && !mode) mode = 'casual';
        if (game !== 'arena') mode = null;

        const channel = interaction.guild.channels.cache.find(c => c.name === GAME[game].lfg);
        if (!channel) return interaction.reply({ content: 'Run `/setup` first.', ephemeral: true });

        const id = `${Date.now()}-${interaction.user.id}`;
        const data = { id, game, roomCode, players, voice, mode, host: interaction.user.id, users: [interaction.user.id], voiceChannelId: null };

        if (voice) {
          const voiceCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🔊 TEMP VOICE');
          const vc = await interaction.guild.channels.create({
            name: `${GAME[game].name} • ${roomCode}`.slice(0, 90),
            type: ChannelType.GuildVoice,
            parent: voiceCategory?.id,
            userLimit: players,
            reason: 'Temporary Coronka LFG voice room',
          });
          data.voiceChannelId = vc.id;
        }

        const msg = await channel.send({ embeds: [lfgEmbed(data)], components: [lfgButtons(id)] });
        data.messageId = msg.id;
        data.channelId = channel.id;
        lfgs.set(id, data);
        return interaction.reply({
          content: `Your ${GAME[game].name} LFG is live in <#${channel.id}>.${data.voiceChannelId ? ` Voice room: <#${data.voiceChannelId}>` : ''}`,
          ephemeral: true,
        });
      }

      if (interaction.commandName === 'feedback') {
        const game = interaction.options.getString('game');
        const channel = interaction.guild.channels.cache.find(c => c.name === 'feedback');
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
        return interaction.reply({ content: `Feedback posted in <#${channel.id}>.`, ephemeral: true });
      }

      if (interaction.commandName === 'playtest') {
        const game = interaction.options.getString('game');
        const when = interaction.options.getString('when');
        const notes = interaction.options.getString('notes');
        const max = interaction.options.getInteger('max_players');
        const channel = interaction.guild.channels.cache.find(c => c.name === 'playtests');
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

client.on('voiceStateUpdate', async oldState => {
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
