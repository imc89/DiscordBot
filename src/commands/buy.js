const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");
const path = require('path');

// Configura tu cadena de conexión a MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_USER}.patcutg.mongodb.net/?retryWrites=true&w=majority&appName=${process.env.DB_USER}`;
const client = new MongoClient(uri);

// Definición de las bebidas disponibles
const drinks = [
    { name: "Prueba 1", price: 5, id: "prueba_1", imageFile: "prueba_1.gif" },
    { name: "Prueba 2", price: 15, id: "prueba_2", imageFile: "prueba_2.gif" },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_buy")
        .setDescription("Compra una bebida para refrescarte."),

    async execute(interaction) {
        // CORRECCIÓN CRÍTICA: Deferir la respuesta inmediatamente.
        // Esto previene el error DiscordAPIError[10062]: Unknown interaction
        await interaction.deferReply({ ephemeral: false });

        // Conectar a la DB DESPUÉS del deferReply
        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");

            const userId = interaction.user.id;
            const userData = await collection.findOne({ userId });
            const currentBalance = userData ? userData.balance : 0;

            // Crear las opciones para el menú desplegable
            const options = drinks.map(drink =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${drink.name} - ${drink.price}$`)
                    .setValue(drink.id) // Usaremos el ID para identificar la opción seleccionada
                    .setDescription(`Costo: ${drink.price} monedas.`)
            );

            // Crear el menú desplegable
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('buy_drink_select')
                .setPlaceholder('Selecciona la bebida que deseas comprar...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle("🛒 Tienda de Bebidas")
                .setDescription(`Tu balance actual es de **${currentBalance}** monedas. Selecciona una bebida para comprarla.`)
                .setColor("LuminousVividPink")
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error("Error al conectar o interactuar con MongoDB:", error);
            // Usamos editReply porque ya hicimos deferReply
            await interaction.editReply({ content: "❌ Hubo un error al intentar acceder a la tienda. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },

    async handleSelectMenuInteraction(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'buy_drink_select') return;

        await interaction.deferUpdate(); // Deferir la actualización para que el usuario sepa que se está procesando

        const selectedDrinkId = interaction.values[0];
        const drink = drinks.find(d => d.id === selectedDrinkId);

        if (!drink) {
            return await interaction.followUp({ content: "❌ Bebida no encontrada.", ephemeral: true });
        }

        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");

            const userId = interaction.user.id;
            let userData = await collection.findOne({ userId });

            if (!userData) {
                // Crear usuario si no existe
                userData = {
                    userId,
                    username: interaction.user.username,
                    displayName: interaction.user.displayName,
                    balance: 0,
                    last_daily: null,
                    last_job: null
                };
                await collection.insertOne(userData);
            }

            const currentBalance = userData.balance;
            const price = drink.price;

            // 1. Verificar si el usuario tiene suficiente dinero
            if (currentBalance < price) {
                // Usar followUp en interacciones diferidas (deferUpdate)
                await interaction.followUp({
                    content: `❌ ¡Lo sentimos! No tienes suficientes monedas para comprar **${drink.name}**. Necesitas **${price}** monedas y solo tienes **${currentBalance}**.`,
                    ephemeral: true
                });
                
                // Si quieres que el mensaje original del menú se borre:
                await interaction.message.edit({ components: [] });
                return;
            }

            // 2. Descontar el dinero y actualizar la base de datos
            const newBalance = currentBalance - price;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            // 3. Crear la respuesta de compra exitosa
            const attachmentPath = path.resolve(__dirname, '..', '..', 'img', 'drinks', drink.imageFile);

            const embed = new EmbedBuilder()
                .setTitle("✅ Compra Exitosa")
                .setDescription(`**DISFRUTA DE TU BEBIDA ${drink.name.toUpperCase()}**`)
                .addFields(
                    { name: 'Costo', value: `**${price}** monedas`, inline: true },
                    { name: 'Balance Restante', value: `**${newBalance}** monedas`, inline: true }
                )
                .setImage(`attachment://${drink.imageFile}`) // Referencia al archivo adjunto
                .setColor("Green")
                .setTimestamp();

            await interaction.message.edit({
                content: null,
                embeds: [embed],
                files: [attachmentPath], // Adjuntar el archivo de imagen
                components: [] // Eliminar el menú
            });
            
            // Opcional: enviar un mensaje de confirmación al usuario (ephemeral)
            await interaction.followUp({ content: `¡Has comprado **${drink.name}**!`, ephemeral: true });


        } catch (error) {
            console.error("Error al procesar la compra en MongoDB:", error);
            await interaction.followUp({ content: "❌ Hubo un error al procesar tu compra. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    }
};