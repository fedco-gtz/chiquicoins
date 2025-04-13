import { Router } from 'express';
import pool from '../db/db.js';

const router = Router();

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
        const id = await generarIdUnico();
        const ganados = coins_ganados ?? 0;
        const gastados = coins_gastados ?? 0;
        const consulta = `
            INSERT INTO catalogo 
            (id, usuario_id, coins_ganados, coins_gastados)
            VALUES (?, ?, ?, ?)
        `;
        await pool.query(consulta, [id, usuario_id, ganados, gastados]);
        res.redirect('/adminMovie');
    } catch (error) {
        console.error('Hubo un error al asignar coins');
        res.status(500).json({ error: error.message });
    }
});

export default router;
