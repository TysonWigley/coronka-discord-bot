import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Clean up and rebuild the streamlined Coronka server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Post Coronka self-assign game role buttons')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('findgame')
    .setDescription('Find players for a Coronka game')
    .addStringOption(o =>
      o.setName('game').setDescription('Game').setRequired(true)
        .addChoices(
          { name: 'Coronka Arena', value: 'arena' },
          { name: 'Coronka Duel', value: 'duel' },
          { name: 'Kingdoms of Coronka', value: 'kingdoms' },
        ))
    .addStringOption(o => o.setName('room_code').setDescription('Coronka room code').setRequired(true).setMaxLength(32))
    .addIntegerOption(o => o.setName('players').setDescription('Total players wanted').setRequired(true).setMinValue(2).setMaxValue(6))
    .addStringOption(o =>
      o.setName('mode').setDescription('Arena mode')
        .addChoices({ name: 'Ranked', value: 'ranked' }, { name: 'Casual', value: 'casual' }))
    .addBooleanOption(o => o.setName('voice').setDescription('Create a temporary voice room? Defaults to yes')),

  new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Submit public Coronka feedback for community voting')
    .addStringOption(o =>
      o.setName('game').setDescription('Game').setRequired(true)
        .addChoices(
          { name: 'Coronka Arena', value: 'arena' },
          { name: 'Coronka Duel', value: 'duel' },
          { name: 'Kingdoms of Coronka', value: 'kingdoms' },
          { name: 'Coronka Overall', value: 'overall' },
        ))
    .addStringOption(o =>
      o.setName('type').setDescription('Feedback type').setRequired(true)
        .addChoices(
          { name: 'Balance', value: 'Balance' },
          { name: 'Bug', value: 'Bug' },
          { name: 'UI / UX', value: 'UI / UX' },
          { name: 'Rules', value: 'Rules' },
          { name: 'Feature', value: 'Feature' },
          { name: 'Other', value: 'Other' },
        ))
    .addStringOption(o => o.setName('title').setDescription('Short feedback title').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('details').setDescription('Describe the feedback').setRequired(true).setMaxLength(1500)),

  new SlashCommandBuilder()
    .setName('playtest')
    .setDescription('Create an official Coronka playtest announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(o =>
      o.setName('game').setDescription('Game').setRequired(true)
        .addChoices(
          { name: 'Coronka Arena', value: 'arena' },
          { name: 'Coronka Duel', value: 'duel' },
          { name: 'Kingdoms of Coronka', value: 'kingdoms' },
        ))
    .addStringOption(o => o.setName('when').setDescription('Date/time and timezone, e.g. Sep 20, 7 PM MT').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('notes').setDescription('What is being tested?').setRequired(true).setMaxLength(1000))
    .addIntegerOption(o => o.setName('max_players').setDescription('Maximum participants').setMinValue(2).setMaxValue(100)),
].map(c => c.toJSON());

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  throw new Error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID');
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
console.log('Coronka commands deployed.');
