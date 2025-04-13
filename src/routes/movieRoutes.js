import { Router } from 'express';
import pool from '../db/db.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

// Función para generar un ID único de 5 dígitos
const generarIdUnico = async () => {
    let id;
    let existe = true;
    while (existe) {
        id = Math.floor(10000 + Math.random() * 90000);
        const [rows] = await pool.query('SELECT id FROM catalogo WHERE id = ?', [id]);
        if (rows.length === 0) {
            existe = false;
        }
    }
    return id;
};

// Ruta para renderizar productos en home.handlebars
router.get('/', async (req, res) => {
    try {
        res.render('home');
    } catch (error) {
        console.error('Hubo un error al obtener los datos', error);
        res.status(500).json({ error: 'Hubo un error al obtener los productos' });
    }
});

// Ruta para renderizar el formulario de coins con usuarios en adminMovie.handlebars
router.get('/adminMovie', async (req, res) => {
    try {
        const consultaUsuarios = `SELECT id, nombre, apellido, colegio, curso FROM usuarios WHERE role_id = 1`;
        const [rowsUsuarios] = await pool.query(consultaUsuarios);
        const usuarios = rowsUsuarios.map(usuario => ({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            colegio: usuario.colegio,
            curso: usuario.curso
        }));
        res.render('adminMovie', { usuarios });
    } catch (error) {
        console.error('Error al obtener los usuarios para el formulario:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los usuarios' });
    }
});

// Ruta para asignar coins y volver a renderizar adminMovie.handlebars
router.post('/adminMovie', async (req, res) => {
    const { usuario_id, coins_ganados, coins_gastados } = req.body;

    try {
        if (!usuario_id) {
            throw new Error('El ID del usuario es obligatorio');
        }
        const [userRows] = await pool.query('SELECT nombre, apellido, email FROM usuarios WHERE id = ?', [usuario_id]);
        if (userRows.length === 0) {
            throw new Error('Usuario no encontrado');
        }
        const { nombre, apellido, email } = userRows[0];
        const id = await generarIdUnico();
        const ganados = coins_ganados ?? 0;
        const gastados = coins_gastados ?? 0;
        const consultaInsert = `
            INSERT INTO catalogo 
            (id, usuario_id, coins_ganados, coins_gastados)
            VALUES (?, ?, ?, ?)
        `;
        await pool.query(consultaInsert, [id, usuario_id, ganados, gastados]);
        const consultaCoins = `
            SELECT 
                SUM(coins_ganados) AS coins_ganados, 
                SUM(coins_gastados) AS coins_gastados 
            FROM catalogo 
            WHERE usuario_id = ?
        `;
        const [resultadosCoins] = await pool.query(consultaCoins, [usuario_id]);

        const totalGanados = resultadosCoins[0]?.coins_ganados ?? 0;
        const totalGastados = resultadosCoins[0]?.coins_gastados ?? 0;
        const disponibles = totalGanados - totalGastados;
        const mailOptions = {
            from: 'coinschiqui@gmail.com',
            to: email,
            subject: '🪙 Resumen de tus ChiquiCoins',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; border-radius: 10px; max-width: 500px; margin: auto;">
                    <h2 style="color: #2c3e50;">¡Hola ${nombre} ${apellido}! 👋</h2>
                    <p>Te dejamos un resumen actualizado de tus <strong>ChiquiCoins 🪙</strong>:</p>
                    <ul style="list-style: none; font-size: 16px; padding: 0;">
                        <li>🟢 <strong>Monedas ganadas:</strong> ${totalGanados}</li>
                        <li>🔴 <strong>Monedas gastadas:</strong> ${totalGastados}</li>
                        <li>💰 <strong>Saldo disponible:</strong> ${disponibles}</li>
                    </ul>
                    <p>Gracias por seguir usando <strong>ChiquiCoins</strong>. ¡Seguimos creciendo juntos! 🚀</p>
                    <small style="color: #888;">*Este mensaje fue enviado automáticamente. No responder.</small>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        res.redirect('/adminMovie');
    } catch (error) {
        console.error('Hubo un error al asignar coins:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
