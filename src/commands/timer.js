const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Definición del comando de barra (slash command)
    data: new SlashCommandBuilder()
        .setName('law_timer')
        .setDescription('Establece un temporizador de 5 a 60 minutos.')
        // CAMBIO 1: Usamos addIntegerOption para forzar la entrada numérica.
        .addIntegerOption(option =>
            option.setName('minutos') // CAMBIO 2: Renombramos la opción a 'minutos'
                .setDescription('Duración del temporizador en minutos (de 5 a 60).')
                .setRequired(true)
                // CAMBIO 3: Establecemos los límites mínimo y máximo
                .setMinValue(5) 
                .setMaxValue(60)) 
        .addStringOption(option =>
            option.setName('tarea')
                .setDescription('Descripción de la tarea para el recordatorio.')
                .setRequired(true)),
    
    // Función de ejecución del comando
    async execute(interaction) {
        // CAMBIO 4: Obtenemos el valor como un número entero
        const durationMinutes = interaction.options.getInteger('minutos'); 
        const task = interaction.options.getString('tarea');
        
        // Conversión a milisegundos para setTimeout
        const durationMs = durationMinutes * 60 * 1000;

        // NOTA: Con .setMinValue(5) y .setMaxValue(60) en la definición del comando,
        // Discord ya previene que se introduzcan valores fuera de rango. 
        // ¡No necesitamos la validación manual de MIN_MS/MAX_MS!
        
        // Mensaje de confirmación inicial (PÚBLICO)
        await interaction.reply({ 
            content: `⏳ **Temporizador iniciado por ${interaction.user}** de **${durationMinutes} minutos** para la tarea: "${task}". ¡Avisaré aquí cuando acabe!`,
            // Mensaje público por defecto al omitir 'ephemeral: true'
        });

        // Establecer el temporizador
        setTimeout(async () => {
            try {
                // Envía el mensaje de aviso final al canal (público)
                await interaction.channel.send(`🔔 ¡Ey ${interaction.user}! **¡Tu temporizador de ${durationMinutes} minutos ha terminado!** Tarea: **${task}**.`);
            } catch (error) {
                console.error(`No se pudo enviar el mensaje de aviso en el canal.`, error);
                
                // Intento de DM de respaldo en caso de fallo de permisos
                try {
                     await interaction.user.send(`⚠️ ¡Alerta! No pude avisar en el canal #${interaction.channel.name}, pero tu temporizador de **${durationMinutes} minutos** para "**${task}**" ha terminado.`);
                } catch (dmError) {
                    console.error(`Fallo catastrófico: No se pudo avisar al usuario ${interaction.user.tag}.`, dmError);
                }
            }
        }, durationMs);
    },
};