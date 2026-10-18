document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo cargar el cliente de Supabase');
        return;
    }

    // Referencias al DOM
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const formContainer = document.getElementById('formContainer');
    const messageBox = document.getElementById('messageBox');
    const bochadorForm = document.getElementById('bochadorForm');
    const saveBtn = document.getElementById('saveBtn');

    // Función para mostrar mensajes
    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `message ${type}`;
        messageBox.style.display = 'flex';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }

    // Función para calcular edad a partir de la fecha de nacimiento
    function calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return '';
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    // Evento: Al cambiar la fecha de nacimiento, actualizar edad automáticamente
    document.getElementById('fechaNacimiento').addEventListener('change', function() {
        const edad = calcularEdad(this.value);
        if (edad >= 0) {
            document.getElementById('edad').value = edad;
        }
    });

    // Evento: Buscar Jugador
    searchBtn.addEventListener('click', async function() {
        const query = searchInput.value.trim();
        if (!query) {
            showMessage('Por favor, ingresa un correo o ID de usuario.', 'error');
            return;
        }

        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Buscando...';

        try {
            // Buscar por email o por user_id
            const { data, error } = await db
                .from('perfiles')
                .select('*')
                .or(`email.eq.${query},user_id.eq.${query}`)
                .single();

            if (error || !data) {
                showMessage('No se encontró ningún jugador con ese correo o ID.', 'error');
                formContainer.classList.remove('active');
                return;
            }

            // Llenar el formulario con los datos encontrados
            document.getElementById('userIdHidden').value = data.id;
            document.getElementById('userNameDisplay').textContent = data.nombre || 'Sin nombre';
            document.getElementById('userEmailDisplay').textContent = data.email;
            
            document.getElementById('nombreCompleto').value = data.nombre || '';
            document.getElementById('nacionalidad').value = data.nacionalidad || 'Venezuela';
            document.getElementById('manoHabil').value = data.mano_habil || 'Diestro';
            document.getElementById('peso').value = data.peso || '';
            document.getElementById('estatura').value = data.estatura || '';
            document.getElementById('longitudBrazo').value = data.longitud_brazo || '';
            document.getElementById('sexo').value = data.sexo || 'Masculino';
            document.getElementById('fechaNacimiento').value = data.fecha_nacimiento || '';
            document.getElementById('edad').value = data.edad || calcularEdad(data.fecha_nacimiento) || '';
            document.getElementById('telefono').value = data.telefono || '';
            document.getElementById('partidosJugados').value = data.partidos_jugados || 0;
            document.getElementById('porcentajeAciertos').value = data.porcentaje_aciertos || 0;
            
            // Manejo de fechas de últimos partidos (asumiendo que se guardan como string o fecha)
            document.getElementById('ultimoPartido1').value = data.ultimo_partido_1 || '';
            document.getElementById('ultimoPartido2').value = data.ultimo_partido_2 || '';
            document.getElementById('ultimoPartido3').value = data.ultimo_partido_3 || '';

            document.getElementById('categoria').value = data.categoria || 'F';
            
            const estado = data.estado_clasificacion || 'No clasificado';
            document.getElementById('estadoClasificacion').value = estado;
            
            const badge = document.getElementById('userStatusBadge');
            badge.textContent = estado;
            badge.className = `status-badge ${estado === 'Clasificado' ? 'status-clasificado' : 'status-pendiente'}`;

            formContainer.classList.add('active');
            showMessage('Jugador encontrado. Puedes editar sus datos.', 'success');

        } catch (err) {
            console.error('Error en la búsqueda:', err);
            showMessage('Ocurrió un error al buscar en la base de datos.', 'error');
        } finally {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fas fa-search"></i> Buscar Jugador';
        }
    });

    // Evento: Guardar Cambios
    bochadorForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userId = document.getElementById('userIdHidden').value;
        if (!userId) {
            showMessage('Error: No se identificó al usuario.', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

        const datosActualizados = {
            nombre: document.getElementById('nombreCompleto').value,
            nacionalidad: document.getElementById('nacionalidad').value,
            mano_habil: document.getElementById('manoHabil').value,
            peso: parseFloat(document.getElementById('peso').value) || null,
            estatura: parseFloat(document.getElementById('estatura').value) || null,
            longitud_brazo: parseFloat(document.getElementById('longitudBrazo').value) || null,
            sexo: document.getElementById('sexo').value,
            fecha_nacimiento: document.getElementById('fechaNacimiento').value,
            edad: parseInt(document.getElementById('edad').value) || null,
            telefono: document.getElementById('telefono').value,
            partidos_jugados: parseInt(document.getElementById('partidosJugados').value) || 0,
            porcentaje_aciertos: parseFloat(document.getElementById('porcentajeAciertos').value) || 0,
            ultimo_partido_1: document.getElementById('ultimoPartido1').value,
            ultimo_partido_2: document.getElementById('ultimoPartido2').value,
            ultimo_partido_3: document.getElementById('ultimoPartido3').value,
            categoria: document.getElementById('categoria').value,
            estado_clasificacion: document.getElementById('estadoClasificacion').value
        };

        try {
            const { error } = await db
                .from('perfiles')
                .update(datosActualizados)
                .eq('id', userId);

            if (error) throw error;

            showMessage('¡Datos del bochador actualizados exitosamente!', 'success');
            
            // Actualizar el badge visualmente
            const estado = datosActualizados.estado_clasificacion;
            const badge = document.getElementById('userStatusBadge');
            badge.textContent = estado;
            badge.className = `status-badge ${estado === 'Clasificado' ? 'status-clasificado' : 'status-pendiente'}`;

        } catch (err) {
            console.error('Error al guardar:', err);
            showMessage('Error al guardar los cambios. Inténtalo de nuevo.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        }
    });

    // Función global para limpiar/cancelar
    window.limpiarFormulario = function() {
        formContainer.classList.remove('active');
        searchInput.value = '';
        bochadorForm.reset();
        messageBox.style.display = 'none';
    };
});
