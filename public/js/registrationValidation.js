document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const nombre = document.getElementById('nombre');
    const apellido = document.getElementById('apellido');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const rol = document.getElementById('rol');
    const errorTexts = document.querySelectorAll('.error-text');

    form.addEventListener('submit', function(event) {
        // Reset error messages
        errorTexts.forEach(errorText => errorText.textContent = '');

        let hasError = false;

        // Validate nombre
        if (nombre.value.trim() === '') {
            nombre.nextElementSibling.textContent = 'El nombre es obligatorio';
            hasError = true;
        }

        // Validate apellido
        if (apellido.value.trim() === '') {
            apellido.nextElementSibling.textContent = 'El apellido es obligatorio';
            hasError = true;
        }

        // Validate email
        if (!validateEmail(email.value)) {
            email.nextElementSibling.textContent = 'El email no es válido';
            hasError = true;
        }

        // Validate password
        if (password.value.length < 6) {
            password.nextElementSibling.textContent = 'La contraseña debe tener al menos 6 caracteres';
            hasError = true;
        }
        
        // Validate apellido
        if (rol.value.trim() === '2') {
            apellido.nextElementSibling.textContent = 'El apellido es obligatorio';
            hasError = true;
        }

        if (hasError) {
            event.preventDefault();
        }
    });

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

});