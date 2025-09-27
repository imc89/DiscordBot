const { SlashCommandBuilder } = require('discord.js');

// Función auxiliar para convertir el tiempo de entrada a milisegundos
function parseTime(timeString) {
    const parts = timeString.match(/(\d+)([hm])/g);
    if (!parts) return null;

    let totalMs = 0;
    for (const part of parts) {
        const value = parseInt(part.slice(0, -1));
        const unit = part.slice(-1);

        if (unit === 'h') {
            totalMs += value * 60 * 60 * 1000; // Horas a ms
        } else if (unit === 'm') {
            totalMs += value * 60 * 1000; // Minutos a ms
        }
    }
    return totalMs;
}

module.exports = {
    // Definición del comando de barra (slash command)
    data: new SlashCommandBuilder()
        .setName('law_timer')
        .setDescription('Establece un temporizador con un máximo de 1 hora y un mínimo de 5 minutos.')
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración del temporizador (ej: 1h, 30m, 1h15m). Máx: 1h, Mín: 5m')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tarea')
                .setDescription('Descripción de la tarea para el recordatorio.')
                .setRequired(true)),
    
    // Función de ejecución del comando
    async execute(interaction) {
        const timeInput = interaction.options.getString('tiempo');
        const task = interaction.options.getString('tarea');
        const durationMs = parseTime(timeInput);

        const MIN_MS = 5 * 60 * 1000;      // 5 minutos
        const MAX_MS = 60 * 60 * 1000;     // 1 hora

        // 1. Validaciones
        if (!durationMs || durationMs < MIN_MS || durationMs > MAX_MS) {
            return interaction.reply({ 
                content: '⚠️ El tiempo debe estar entre **5 minutos** (5m) y **1 hora** (1h), y en un formato válido (ej: 30m, 1h).', 
                ephemeral: true // Solo visible para el usuario
            });
        }

        const durationMinutes = Math.floor(durationMs / 60000);
        
        // El mensaje de confirmación inicial seguirá siendo efímero (solo para el usuario)
        await interaction.reply({ 
            content: `⏳ Temporizador de **${durationMinutes} minutos** para "**${task}**" iniciado. Te avisaré en este canal cuando termine.`,
            ephemeral: false // Visible para todos en el canal
        });

        // 2. Establecer el temporizador
        setTimeout(async () => {
            try {
                // Envía el mensaje de aviso al canal donde se usó el comando
                // Usamos interaction.channel.send para el aviso público
                await interaction.channel.send(`🔔 ¡Ey ${interaction.user}! **¡Tu temporizador ha terminado!**\nLa tarea: **${task}** (${durationMinutes} minutos).`);
            } catch (error) {
                console.error(`No se pudo enviar el mensaje de aviso en el canal ${interaction.channel.name}.`, error);
                
                // Si el bot no tiene permisos para enviar mensajes en el canal, intenta notificar al usuario de forma privada
                try {
                     await interaction.user.send(`⚠️ ¡Alerta! No pude avisar en el canal #${interaction.channel.name} (posiblemente por falta de permisos), pero tu temporizador de **${durationMinutes} minutos** para "**${task}**" ha terminado.`);
                } catch (dmError) {
                    console.error(`Fallo catastrófico: No se pudo avisar al usuario ${interaction.user.tag} ni en el canal ni por DM.`, dmError);
                }
            }
        }, durationMs);
    },
};