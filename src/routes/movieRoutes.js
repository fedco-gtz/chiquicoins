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
        const consultaUsuarios = `
            SELECT id, nombre, apellido, colegio, curso
            FROM usuarios
            WHERE role_id = 1
            ORDER BY apellido ASC
        `;
        const [rowsUsuarios] = await pool.query(consultaUsuarios);

        const usuarios = rowsUsuarios.map(usuario => ({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            colegio: usuario.colegio,
            curso: usuario.curso
        }));

        const colegiosUnicos = [...new Set(rowsUsuarios.map(u => u.colegio))].map(colegio => ({ colegio }));
        const cursosUnicos = [...new Set(rowsUsuarios.map(u => u.curso))].map(curso => ({ curso }));

        res.render('adminMovie', {
            usuarios,
            colegios: colegiosUnicos,
            cursos: cursosUnicos
        });
    } catch (error) {
        console.error('Error al obtener los usuarios para el formulario:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los usuarios' });
    }
});

router.post('/adminMovie', async (req, res) => {
    const { colegio, curso } = req.body;

    try {
        let consultaUsuarios = `
            SELECT id, nombre, apellido, colegio, curso
            FROM usuarios
            WHERE role_id = 1
        `;
        
        const queryParams = [];
        
        if (colegio) {
            consultaUsuarios += ` AND colegio = ?`;
            queryParams.push(colegio);
        }
        
        if (curso) {
            consultaUsuarios += ` AND curso = ?`;
            queryParams.push(curso);
        }

        consultaUsuarios += ` ORDER BY colegio ASC, curso ASC`;

        const [rowsUsuarios] = await pool.query(consultaUsuarios, queryParams);

        const usuarios = rowsUsuarios.map(usuario => ({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            colegio: usuario.colegio,
            curso: usuario.curso
        }));

        const consultaTodos = `SELECT colegio, curso FROM usuarios WHERE role_id = 1 ORDER BY colegio ASC, curso ASC`;
        const [todosUsuarios] = await pool.query(consultaTodos);

        const colegiosUnicos = [...new Set(todosUsuarios.map(u => u.colegio))].map(c => ({
            colegio: c,
            selected: c === colegio
        }));

        const cursosUnicos = [...new Set(todosUsuarios.map(u => u.curso))].map(c => ({
            curso: c,
            selected: c === curso
        }));

        res.render('adminMovie', {
            usuarios,
            colegios: colegiosUnicos,
            cursos: cursosUnicos,
            mostrarMensaje: false
        });
    } catch (error) {
        console.error('Error al filtrar los usuarios:', error);
        res.status(500).json({ error: 'Hubo un error al filtrar los usuarios' });
    }
});

router.post('/adminMovie/coins', async (req, res) => {
    const body = req.body;

    try {
        const ids = new Set();
        const correos = [];

        for (const key of Object.keys(body)) {
            const match = key.match(/coins_(ganados|gastados)_(\d+)/);
            if (match) {
                ids.add(match[2]);
            }
        }

        let totalGanados = 0;
        let totalGastados = 0;

        for (const id of ids) {
            const ganados = parseInt(body[`coins_ganados_${id}`] || '0', 10);
            const gastados = parseInt(body[`coins_gastados_${id}`] || '0', 10);

            if (ganados === 0 && gastados === 0) continue;

            const uniqueId = await generarIdUnico();

            await pool.query(
                `INSERT INTO fedco_coins.catalogo (id, usuario_id, coins_ganados, coins_gastados)
                 VALUES (?, ?, ?, ?)`,
                [uniqueId, id, ganados, gastados]
            );

            const [estudiante] = await pool.query('SELECT nombre, apellido, email FROM usuarios WHERE id = ?', [id]);
            if (estudiante.length > 0) {
                const nombre = estudiante[0].nombre;
                const apellido = estudiante[0].apellido;
                const saldoDisponible = ganados - gastados; 

                totalGanados += ganados; 
                totalGastados += gastados; 

                let mensaje = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #ddd; max-width: 500px; margin: auto;">
                    <h3 style="font-size: 20px; color: #2c3e50;">Hola <span style="color: #2980b9;">${nombre} ${apellido}</span> 👋</h3>
  
                    <p style="font-size: 20px; color: #333;">
                        Te dejamos un resumen actualizado de tus ChiquiCoins 🪙:
                    </p>

                    <ul style="list-style: none; padding: 0; font-size: 18px;">
                        <li><strong>🟢 Monedas ganadas:</strong> ${ganados}</li>
                        <li><strong>🔴 Monedas gastadas:</strong> ${gastados}</li>
                    </ul>

                    <p style="margin-top: 20px; font-size: 18px;">
                        👉 <a href="https://chiquicoins.onrender.com/" style="color: #2980b9; text-decoration: none; font-weight: bold;">
                            INGRESA EN CHIQUICOINS PARA CONOCER TU SALDO DISPONIBLE 💰
                        </a>
                    </p>

                    <p style="font-size: 14px; margin-top: 20px; font-weight: bold; color: #2c3e50;">Gracias por seguir usando ChiquiCoins. ¡Seguimos creciendo juntos! 🚀</p>
                    <p style="font-size: 14px; color:rgb(56, 55, 55); text-transform: uppercase;">*Este mensaje fue enviado automáticamente. No responder.</p>
                </div>
                `;

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: estudiante[0].email,
                    subject: '🪙 Resumen de tus ChiquiCoins',
                    html: mensaje
                };

                try {
                    await transporter.sendMail(mailOptions);
                } catch (error) {
                    console.error(`Error al enviar correo a ${estudiante[0].email}:`, error);
                    res.status(500).json({ error: `Error al enviar correo a ${estudiante[0].email}`, details: error });
                    return;
                }
            }
        }

        res.redirect('/adminMovie');
    } catch (error) {
        console.error('Error al asignar ChiquiCoins:', error);
        res.status(500).json({ error: 'Hubo un error al asignar ChiquiCoins', details: error.message });
    }
});

router.get('/detail', async (req, res) => {
    try {
        const [colegios] = await pool.query('SELECT DISTINCT colegio FROM usuarios WHERE role_id = 1 ORDER BY colegio');
        const [cursos] = await pool.query('SELECT DISTINCT curso FROM usuarios WHERE role_id = 1 ORDER BY curso');

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
