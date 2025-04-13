import { Router } from 'express';
import pool from '../db/db.js';

const router = Router();

// Función para generar un ID único de 5 dígitos
const generarIdUnicoUser = async () => {
    let id;
    let existe = true;
    while (existe) {
        id = Math.floor(10000 + Math.random() * 90000);
        const [rows] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [id]);
        if (rows.length === 0) {
            existe = false;
        }
    }
    return id;
};

// Ruta para mostrar register.handlebars
router.get('/register', async (req, res) => {
    res.render('register', { isRegisterPage: true });
});

// Ruta para crear un usuario en register.handlebars
router.post('/register', async (req, res) => {
    const { nombre, apellido, email, password, colegio, curso } = req.body;

    try {
        const id = await generarIdUnicoUser();
        const consulta = 'INSERT INTO usuarios (id, nombre, apellido, email, password, colegio, curso) VALUES (?, ?, ?, ?, ?, ?, ?)';

        await pool.query(consulta, [id, nombre, apellido, email, password, colegio, curso]);

        res.render('login', { isRegisterPage: true });

    } catch (error) {
        console.error('Ya existe una cuenta con el e-mail ingresado:', error.message);
        res.render('register', { error: 'Ya existe una cuenta con el e-mail ingresado', isRegisterPage: true });
    }
});

// Ruta para mostrar login.handlebars
router.get('/login', (req, res) => {
    res.render('login', { isRegisterPage: true });
});

// Ruta para manejar el inicio de sesión
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const consultaUsuario = 'SELECT id, nombre, apellido, curso, colegio, role_id FROM usuarios WHERE email = ? AND password = ?';
        const [resultadosUsuario] = await pool.query(consultaUsuario, [email, password]);

        if (resultadosUsuario.length > 0) {
            const usuario = resultadosUsuario[0];
            const { id, nombre, apellido, curso, colegio, role_id } = usuario;

            const consultaCoins = `
                SELECT 
                    usuario_id, 
                    SUM(coins_ganados) AS coins_ganados, 
                    SUM(coins_gastados) AS coins_gastados 
                FROM catalogo 
                WHERE usuario_id = ? 
                GROUP BY usuario_id
            `;
            const [resultadosCoins] = await pool.query(consultaCoins, [id]);

            const coins = resultadosCoins.map(row => ({
                coins_ganados: row.coins_ganados,
                coins_gastados: row.coins_gastados,
                disponibles: row.coins_ganados - row.coins_gastados
            }));

            if (role_id === 1) {
                res.render('profileUser', {
                    id,
                    nombre,
                    apellido,
                    curso, 
                    colegio,
                    coins
                });
            } else if (role_id === 2) {
                res.render('profileAdmin', { nombre, apellido });
            } else {
                res.render('login', { errorMessage: 'Rol de usuario no reconocido.', isRegisterPage: true });
            }
        } else {
            res.render('login', { error: 'E-mail o contraseña incorrecto', isRegisterPage: true });
        }
    } catch (error) {
        console.error('Hubo un error al validar el usuario:', error.message);
        res.status(500).json({ error: 'Hubo un error al validar el usuario' });
    }
});

// Ruta para mostrar profileAdmin.handlebars
router.get('/profileAdmin', (req, res) => {
    res.render('profileAdmin');
});

// Ruta para obtener y renderizar usuarios en adminUser.handlebars
router.get('/adminUser', async (req, res) => {
    try {
        const { colegio, curso } = req.query;
        let consulta = `SELECT u.id, u.nombre, u.apellido, u.email, u.colegio, u.curso, r.nombre AS rol 
                        FROM usuarios u
                        LEFT JOIN roles r ON u.role_id = r.id`;
        const condiciones = [];
        const valores = [];
        if (colegio) {
            condiciones.push(`u.colegio = ?`);
            valores.push(colegio);
        }
        if (curso) {
            condiciones.push(`u.curso = ?`);
            valores.push(curso);
        }
        if (condiciones.length > 0) {
            consulta += ` WHERE ` + condiciones.join(' AND ');
        }
        const [rows] = await pool.query(consulta, valores);
        const usuarios = rows.map(usuario => ({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            colegio: usuario.colegio,
            curso: usuario.curso,
            rol: usuario.rol
        }));
        res.render('adminUser', { usuarios });
    } catch (error) {
        console.error('Hubo un error al obtener los usuarios:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los usuarios' });
    }
});

// Ruta para modificar el rol de los usuarios en adminUser.handlebars
router.post('/userAdmin/modifyRole/:id', async (req, res) => {
    const userId = req.params.id;
    const newRoleId = req.body.role;
    try {
        const [userRows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await pool.query('UPDATE usuarios SET role_id = ? WHERE id = ?', [newRoleId, userId]);

        res.redirect('/adminUser');

    } catch (error) {
        console.error('Hubo un error al modificar el rol del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al modificar el rol del usuario' });
    }
});

// Ruta para mostrar profileUser.handlebars
router.get('/profileUser/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
        const consulta = 'SELECT id, nombre, curso, colegio, apellido FROM usuarios WHERE id = ?';
        const [rows] = await pool.query(consulta, [id]);

        const consultaCoins = `
        SELECT 
            usuario_id, 
            SUM(coins_ganados) AS coins_ganados, 
            SUM(coins_gastados) AS coins_gastados 
        FROM catalogo 
        WHERE usuario_id = ? 
        GROUP BY usuario_id
    `;
    const [resultadosCoins] = await pool.query(consultaCoins, [id]);

    const coins = resultadosCoins.map(row => ({
        coins_ganados: row.coins_ganados,
        coins_gastados: row.coins_gastados,
        disponibles: row.coins_ganados - row.coins_gastados
    }));

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.render('profileUser', {
            id: rows[0].id,
            nombre: rows[0].nombre,
            apellido: rows[0].apellido,
            curso: rows[0].curso,
            colegio: rows[0].colegio,
            coins
        });

    } catch (error) {
        console.error('Hubo un error al obtener los datos del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los datos del usuario' });
    }
});

// Ruta para mostrar profile.handlebars
router.get('/profile/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
        const userQuery = 'SELECT id, nombre, apellido, email, password, colegio, curso FROM usuarios WHERE id = ?';
        const [userRows] = await pool.query(userQuery, [id]);

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.render('profile', {
            id: userRows[0].id,
            nombre: userRows[0].nombre,
            apellido: userRows[0].apellido,
            email: userRows[0].email,
            password: userRows[0].password,
            colegio: userRows[0].colegio,
            curso: userRows[0].curso,
        });

    } catch (error) {
        console.error('Hubo un error al obtener los datos del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los datos del usuario' });
    }
});

// Ruta para modificar datos en profile.handlebars
router.post('/profile/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nombre, apellido, email, password, colegio, curso } = req.body;
    try {
        const consulta = `
            UPDATE usuarios 
            SET nombre = ?, apellido = ?, email = ?, password = ?, colegio = ?, curso = ?
            WHERE id = ?`;

        await pool.query(consulta, [
            nombre, apellido, email, password, colegio, curso, id
        ]);
        res.redirect(`/profile/${id}`);
    } catch (error) {
        console.error('Hubo un error al actualizar los datos del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al actualizar los datos del usuario' });
    }
});

// Ruta para eliminar en profile.handlebars
router.post('/profile/:id/delete', async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
        const consulta = 'DELETE FROM usuarios WHERE id = ?';
        await pool.query('DELETE FROM catalogo WHERE usuario_id = ?', [id]);
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

        res.redirect('/');

    } catch (error) {
        console.error('Hubo un error al eliminar el perfil del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al eliminar el perfil del usuario', error });
    }
});


// Ruta para mostrar profileUser.handlebars
router.get('/profile/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
        const consulta = 'SELECT id, nombre, apellido, colegio, curso FROM usuarios WHERE id = ?';
        const [rows] = await pool.query(consulta, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.render('login', {
            id: rows[0].id,
            nombre: rows[0].nombre,
            apellido: rows[0].apellido,
        });
    } catch (error) {
        console.error('Hubo un error al obtener los datos del usuario:', error);
        res.status(500).json({ error: 'Hubo un error al obtener los datos del usuario' });
    }
});

export default router;