const { Events } = require("discord.js");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ Bot conectado como ${client.user.tag}`);

        // Register slash commands
        const commands = client.commands.map(cmd => cmd.data.toJSON());

        try {
            await client.application.commands.set(commands);
            console.log("🌐 Comandos registrados globalmente.");
        } catch (err) {
            console.error("⚠️ Error al registrar comandos:", err);
        }
    },
};