import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

const COOLDOWNS_COMMAND = new SlashCommandBuilder()
  .setName('cooldowns')
  .setDescription('View your cooldowns & timers ')
  .toJSON();

export interface OutboundAlert {
  text: string;
  buttonLabel: string;
  url: string;
}

export async function createNotifier(
  token: string,
  userId: string,
  onCooldowns: () => Promise<string>,
) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(token);
  const user = await client.users.fetch(userId);

  await registerCooldownsCommand(client);
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'cooldowns') return;
    void handleCooldowns(interaction, userId, onCooldowns);
  });
  client.on(Events.GuildCreate, (guild) => {
    void client.application?.commands.set([COOLDOWNS_COMMAND], guild.id);
  });

  return {
    async send(alert: OutboundAlert): Promise<void> {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(alert.buttonLabel)
          .setURL(alert.url),
      );

      try {
        await user.send({
          content: alert.text,
          components: [row],
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not DM Discord User ${userId}. The bot has to share a server with you, and your DMs from server members have to be enabled. ${reason}`,
          { cause: error },
        );
      }
    },

    async close(): Promise<void> {
      client.destroy();
    },
  };
}

async function registerCooldownsCommand(client: Client): Promise<void> {
  if (!client.application) {
    throw new Error('Discord application is not available after login');
  }
  const commands = [COOLDOWNS_COMMAND];
  await client.application.commands.set(commands);
  for (const guild of client.guilds.cache.values()) {
    await client.application.commands.set(commands, guild.id);
  }
}
async function handleCooldowns(
  interaction: ChatInputCommandInteraction,
  userId: string,
  onCooldowns: () => Promise<string>,
): Promise<void> {
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: 'This command is only for the configured Discord user.',
      ephemeral: true,
    });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    await interaction.editReply(await onCooldowns());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await interaction.editReply(`Could not load Torn timers. ${reason}`);
  }
}
