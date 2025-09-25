const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('law_ship')
        .setDescription('Mide el porcentaje de compatibilidad entre dos usuarios.')
        .addUserOption(option =>
            option.setName("usuario1")
                .setDescription("El primer usuario.")
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName("usuario2")
                .setDescription("El segundo usuario.")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.options.getUser("usuario1");
        const user2 = interaction.options.getUser("usuario2");

        if (user1.id === user2.id) {
            return await interaction.editReply({ content: '💔 No puedes emparejar a un usuario consigo mismo. ¡Qué triste! ' });
        }

        // Genera un porcentaje de 0 a 100
        const lovePercentage = Math.floor(Math.random() * 101);

        // Prepara los textos y emojis para la respuesta
        let shipMessage;
        let shipEmoji;
        let color;

        if (lovePercentage <= 10) {
            shipMessage = "Es un amor no correspondido, creo que ni se conocen.";
            shipEmoji = "💔";
            color = "LuminousVividPink";
        } else if (lovePercentage <= 30) {
            shipMessage = "Puede haber algo, pero hay muchos obstáculos.";
            shipEmoji = "🥀";
            color = "Purple";
        } else if (lovePercentage <= 50) {
            shipMessage = "Hay una buena amistad, pero no hay nada más.";
            shipEmoji = "💞";
            color = "Gold";
        } else if (lovePercentage <= 70) {
            shipMessage = "La química está ahí. ¡El futuro es prometedor!";
            shipEmoji = "💖";
            color = "Orange";
        } else if (lovePercentage <= 90) {
            shipMessage = "¡Un match hecho en el cielo! Se ve mucho amor por aquí.";
            shipEmoji = "💕";
            color = "DarkRed";
        } else {
            shipMessage = "¡Son almas gemelas! Una conexión casi perfecta.";
            shipEmoji = "❤️‍🔥";
            color = "Red";
        }

        // --- Generación de la imagen con Canvas ---
        const canvas = createCanvas(400, 150);
        const ctx = canvas.getContext('2d');

        // Carga y dibuja las imágenes de perfil
        const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png' }));
        const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png' }));

        ctx.drawImage(avatar1, 20, 20, 100, 100);
        ctx.drawImage(avatar2, 280, 20, 100, 100);

        // Dibuja el corazón
        ctx.fillStyle = "Red";
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❤', canvas.width / 2, canvas.height / 2);

        // Dibuja la barra de porcentaje
        const barWidth = 200;
        const barHeight = 20;
        const barX = canvas.width / 2 - barWidth / 2;
        const barY = 125;
        
        // Fondo de la barra
        ctx.fillStyle = '#36393F'; // Un color oscuro similar a Discord
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progreso de la barra
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, (barWidth * lovePercentage) / 100, barHeight);

        // Dibuja el texto del porcentaje
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText(`${lovePercentage}%`, canvas.width / 2, barY + barHeight / 2);

        // Convierte el canvas a una imagen de buffer para enviarlo
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'ship.png' });
        
        // --- Creación del Embed ---
        const embed = new EmbedBuilder()
            .setTitle(`${user1.username} ${shipEmoji} ${user2.username}`)
            .setDescription(`${shipMessage}`)
            .setColor(color)
            .setImage('attachment://ship.png')
            .setFooter({ text: '¡Un pronóstico del corazón, nada más!' });

        await interaction.editReply({ embeds: [embed], files: [attachment] });
    },
};