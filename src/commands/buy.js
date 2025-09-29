const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");
const path = require('path');

// Configura tu cadena de conexión a MongoDB
// Usamos el mismo patrón de URI y cliente que en el archivo law_money.js
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_USER}.patcutg.mongodb.net/?retryWrites=true&w=majority&appName=${process.env.DB_USER}`;
const client = new MongoClient(uri);

// Definición de las bebidas disponibles
const drinks = [
    { name: "Veridian", price: 5, id: "Veridian", imageFile: "Veridian.gif" },
    { name: "Ascua", price: 15, id: "Ascua", imageFile: "Ascua.gif" },
    { name: "Cerveza", price: 25, id: "Cerveza", imageFile: "Cerveza.gif" },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_buy")
        .setDescription("Compra una bebida para refrescarte."),

    async execute(interaction) {
        // Deferir la respuesta **inmediatamente** para evitar el timeout de Discord.
        await interaction.deferReply({ ephemeral: false }).catch(console.error); // Añade .catch para seguridad

        // Ahora puedes tomarte tu tiempo para conectar a la DB
        try {
            await client.connect(); // Esta operación ahora tiene más tiempo para ejecutarse
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
                // Crear usuario si no existe (debería existir por el comando law_money, pero es una seguridad)
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
                await interaction.editReply({
                    content: `❌ ¡Lo sentimos! No tienes suficientes monedas para comprar **${drink.name}**. Necesitas **${price}** monedas y solo tienes **${currentBalance}**.`,
                    embeds: [],
                    components: [] // Elimina el menú desplegable
                });
                return;
            }

            // 2. Descontar el dinero y actualizar la base de datos
            const newBalance = currentBalance - price;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            // 3. Crear la respuesta de compra exitosa
            // Nota: Discord no permite adjuntar imágenes de rutas locales directamente en un embed para la mayoría de las interacciones.
            // Para que esto funcione, la imagen debe ser un archivo adjunto al mensaje o una URL pública.
            // Aquí se adjuntará como archivo para simular la entrega del producto.

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

// **IMPORTANTE**: Necesitas exportar y manejar el 'handleSelectMenuInteraction' en tu 'client.on(Events.InteractionCreate, ...)'
// de tu archivo principal (ej: index.js o bot.js) para que funcione la lógica del menú desplegable, similar a como manejas 'handleButtonInteraction' en law_money.js.