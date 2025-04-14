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

router.get('/', async (req, res) => {
    try {
        res.render('home');
    } catch (error) {
        console.error('Hubo un error al obtener los datos', error);
        res.status(500).json({ error: 'Hubo un error al obtener los productos' });
    }
});

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

router.get('/detail', async (req, res) => {
    try {
        const [colegios] = await pool.query('SELECT DISTINCT colegio FROM usuarios ORDER BY colegio');
        const [cursos] = await pool.query('SELECT DISTINCT curso FROM usuarios ORDER BY curso');

        res.render('detail', {
            estudiantes: [],
            colegios,
            cursos
        });

    } catch (error) {
        console.error('Error al cargar los filtros:', error.message);
        res.status(500).send('Ocurrió un error al cargar la vista.');
    }
});

router.post('/detail', async (req, res) => {
    const { colegio, curso } = req.body;

    try {
        const [estudiantes] = await pool.query(`
            SELECT 
                u.nombre, 
                u.apellido,
                u.email,
                u.curso,
                u.colegio,
                COALESCE(SUM(c.coins_ganados), 0) AS monedas_ganadas,
                COALESCE(SUM(c.coins_gastados), 0) AS monedas_gastadas,
                COALESCE(SUM(c.coins_ganados) - SUM(c.coins_gastados), 0) AS monedas_disponibles
            FROM usuarios u
            LEFT JOIN catalogo c ON u.id = c.usuario_id
            WHERE u.colegio = ? AND u.curso = ?
            GROUP BY u.id
            ORDER BY monedas_ganadas DESC
        `, [colegio, curso]);

        const [resumenColegio] = await pool.query(`
            SELECT 
                COUNT(DISTINCT u.id) AS totalEstudiantes,
                COALESCE(SUM(c.coins_ganados), 0) AS totalMonedas
            FROM usuarios u
            LEFT JOIN catalogo c ON u.id = c.usuario_id
            WHERE u.colegio = ?
        `, [colegio]);

        const totalEstudiantesColegio = resumenColegio[0].totalEstudiantes;
        const totalMonedasColegio = resumenColegio[0].totalMonedas;
        const totalEstudiantes = estudiantes.length;
        const totalMonedas = estudiantes.reduce((sum, est) => sum + parseInt(est.monedas_ganadas), 0);

        const [colegios] = await pool.query('SELECT DISTINCT colegio FROM usuarios ORDER BY colegio');
        const [cursos] = await pool.query('SELECT DISTINCT curso FROM usuarios ORDER BY curso');

        res.render('detail', {
            estudiantes,
            colegios,
            cursos,
            selectedColegio: colegio,
            selectedCurso: curso,
            totalEstudiantes,
            totalMonedas,
            totalEstudiantesColegio,
            totalMonedasColegio,
            mostrarMensaje: true
        });

    } catch (error) {
        console.error('Error al filtrar estudiantes:', error.message);
        res.status(500).send('Ocurrió un error al filtrar los datos.');
    }
});


export default router;
