const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// ID del canal de ajedrez donde el comando debe funcionar.
const CHESS_CHANNEL_ID = '1273040354433826898';
// Duración máxima para aceptar el desafío (en milisegundos).
const TIMEOUT_MS = 60 * 1000; // 60 segundos

module.exports = {
    // 1. Definición del Comando y Opciones
    data: new SlashCommandBuilder()
        .setName('law_chess')
        .setDescription('Desafía a un usuario a una partida de ajedrez en Lichess.')
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Control de tiempo (ej: 5+3, 10+0).')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('jugador')
                .setDescription('El usuario al que deseas desafiar.')
                .setRequired(true)),

    // 2. Lógica de Ejecución
    async execute(interaction) {
        const retador = interaction.user;
        const jugadorObjetivo = interaction.options.getUser('jugador');
        const tiempoRaw = interaction.options.getString('tiempo');

        // --- Paso 1: Restricción de Canal ---
        if (interaction.channelId !== CHESS_CHANNEL_ID) {
            return interaction.reply({ 
                content: `❌ Este comando solo se puede usar en el canal de Ajedrez (<#${CHESS_CHANNEL_ID}>).`,
                ephemeral: true // Solo visible para el usuario que lo usó
            });
        }
        
        // No permitir desafiarse a sí mismo
        if (jugadorObjetivo.id === retador.id) {
            return interaction.reply({
                content: '🛑 No puedes desafiarte a ti mismo.',
                ephemeral: true
            });
        }
        
        // --- Lógica para Parsear Tiempo y Crear Link ---
        let minutos = 0;
        let incremento = 0;
        let valido = false;

        if (tiempoRaw.includes('+')) {
            const partes = tiempoRaw.split('+');
            const [minutosStr, incrementoStr] = partes.map(s => s.trim());
            
            const m = parseInt(minutosStr);
            const i = parseInt(incrementoStr);

            if (!isNaN(m) && !isNaN(i) && m > 0 && i >= 0) {
                minutos = m;
                incremento = i;
                valido = true;
            }
        }
        
        if (!valido) {
            return interaction.reply({
                content: '❌ **Formato de tiempo inválido.** Por favor, usa el formato `minutos+incremento` (ej: `5+3`).',
                ephemeral: true
            });
        }
        
        // Construir el URL de Lichess
        const segundosBase = minutos * 60;
        const lichessUrl = 
            `https://lichess.org/?time=${segundosBase}+${incremento}` +
            `&rated=1&color=random#friend`;

        // --- Paso 2 y 3: Notificación Interactiva ---
        
        // Botones de Aceptar y Rechazar
        const aceptarButton = new ButtonBuilder()
            .setCustomId('law_chest_accept')
            .setLabel('✅ Aceptar Partida')
            .setStyle(ButtonStyle.Success);

        const rechazarButton = new ButtonBuilder()
            .setCustomId('law_chest_decline')
            .setLabel('❌ Rechazar')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(aceptarButton, rechazarButton);

        const initialEmbed = new EmbedBuilder()
            .setTitle(`♟️ ¡Desafío de Ajedrez Pendiente!`)
            .setDescription(
                `${jugadorObjetivo}, has sido desafiado a una partida de **Lichess** por ${retador}.\n\n` +
                `**Control de Tiempo:** \`${minutos}+${incremento}\``
            )
            .setColor('Blurple');
        
        // Enviar la notificación con los botones
        const respuesta = await interaction.reply({
            content: `${jugadorObjetivo}`, // Mensión directa al jugador
            embeds: [initialEmbed],
            components: [row], // Añade los botones al mensaje
            fetchReply: true // Necesario para obtener el mensaje y usar el collector
        });

        // --- Paso 3, 4 y 5: Manejo de la Interacción con el Collector ---

        const filter = i => 
            // Solo el jugador objetivo puede interactuar y debe ser una de las IDs de botón
            i.user.id === jugadorObjetivo.id && 
            (i.customId === 'law_chest_accept' || i.customId === 'law_chest_decline');
        
        // Iniciar un colector para esperar la pulsación del botón
        const collector = respuesta.createMessageComponentCollector({ 
            filter, 
            time: TIMEOUT_MS,
            max: 1 // Solo necesitamos una respuesta (aceptar o rechazar)
        });

        collector.on('collect', async i => {
            await i.deferUpdate(); // Indicar a Discord que la interacción está siendo procesada

            // El jugador ha aceptado
            if (i.customId === 'law_chest_accept') {
                const acceptedEmbed = new EmbedBuilder()
                    .setTitle('🚀 ¡Partida Aceptada y Lista!')
                    .setDescription(
                        `¡${jugadorObjetivo} ha aceptado el desafío de ${retador}! \n` +
                        `**Tiempo:** \`${minutos}+${incremento}\`\n\n` +
                        `[**🔗 HAZ CLIC AQUÍ PARA IR AL DESAFÍO EN LICHESS**](${lichessUrl})`
                    )
                    .setColor('Green');

                // Edita el mensaje original para mostrar el resultado final y el link
                await interaction.editReply({ 
                    content: '✅ **Desafío aceptado.** ¡A jugar!', 
                    embeds: [acceptedEmbed], 
                    components: [] // Elimina los botones
                });

            // El jugador ha rechazado
            } else if (i.customId === 'law_chest_decline') {
                const declinedEmbed = new EmbedBuilder()
                    .setTitle('🛑 Desafío Rechazado')
                    .setDescription(`${jugadorObjetivo} ha **rechazado** la partida de ${retador}.`)
                    .setColor('Red');

                // Edita el mensaje original
                await interaction.editReply({ 
                    content: '❌ **Desafío rechazado.**', 
                    embeds: [declinedEmbed], 
                    components: [] 
                });
            }
        });

        // Manejar el caso en que nadie responde (Timeout)
        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏳ Desafío Caducado')
                    .setDescription(`El desafío de ${retador} a ${jugadorObjetivo} ha caducado (60 segundos).`)
                    .setColor('Yellow');

                // Edita el mensaje original y elimina los botones
                interaction.editReply({ 
                    content: '⚠️ **Desafío caducado.**', 
                    embeds: [timeoutEmbed], 
                    components: [] 
                }).catch(console.error); // Usa catch para evitar errores si el mensaje ya fue editado
            }
        });
    },
};