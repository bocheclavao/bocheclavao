document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
    }

    async function cargarPerfil() {
        try {
            const { data: { user } } = await db.auth.getUser();
            
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error al cargar perfil:', error);
                return;
            }

            // Mostrar datos
            document.getElementById('profileName').textContent = perfil.nombre || 'Usuario';
            document.getElementById('profileId').textContent = `ID: ${perfil.user_id}`;
            document.getElementById('profileEmail').textContent = perfil.email;
            
            const avatar = document.getElementById('profileAvatar');
            if (perfil.avatar_url) {
                avatar.style.backgroundImage = `url(${perfil.avatar_url})`;
                avatar.style.backgroundSize = 'cover';
                avatar.textContent = '';
            } else {
                avatar.textContent = (perfil.nombre || 'U').charAt(0).toUpperCase();
            }

            // Estado KYC
            const kycStatus = document.getElementById('kycStatus');
            if (perfil.estado_kyc === 'verificado') {
                kycStatus.className = 'kyc-status verified';
                kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado';
            } else if (perfil.estado_kyc === 'rechazado') {
                kycStatus.className = 'kyc-status rejected';
                kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado';
            } else {
                kycStatus.className = 'kyc-status pending';
                kycStatus.innerHTML = '<i class="fas fa-clock"></i> KYC Pendiente';
            }

            // Llenar formulario
            document.getElementById('nombre').value = perfil.nombre || '';
            document.getElementById('telefono').value = perfil.telefono || '';
            document.getElementById('fechaNacimiento').value = perfil.fecha_nacimiento || '';
            document.getElementById('nacionalidad').value = perfil.nacionalidad || '';
            document.getElementById('tipoDocumento').value = perfil.tipo_documento || '';
            document.getElementById('numeroDocumento').value = perfil.numero_documento || '';
            document.getElementById('direccion').value = perfil.direccion || '';
            document.getElementById('ciudad').value = perfil.ciudad || '';
            document.getElementById('pais').value = perfil.pais || '';
            document.getElementById('codigoPostal').value = perfil.codigo_postal || '';

            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error:', err);
        }
    }

    // Guardar información personal
    const personalForm = document.getElementById('personalForm');
    if (personalForm) {
        personalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const datos = {
                nombre: document.getElementById('nombre').value,
                telefono: document.getElementById('telefono').value,
                fecha_nacimiento: document.getElementById('fechaNacimiento').value,
                nacionalidad: document.getElementById('nacionalidad').value,
                ultima_actualizacion: new Date().toISOString()
            };

            showMessage('Guardando información...', 'info');

            const { error } = await db
                .from('perfiles')
                .update(datos)
                .eq('id', user.id);

            if (error) {
                showMessage('Error al guardar: ' + error.message, 'error');
            } else {
                showMessage('Información guardada exitosamente', 'success');
            }
        });
    }

    // Enviar documentos KYC
    const kycForm = document.getElementById('kycForm');
    if (kycForm) {
        kycForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const datos = {
                tipo_documento: document.getElementById('tipoDocumento').value,
                numero_documento: document.getElementById('numeroDocumento').value,
                direccion: document.getElementById('direccion').value,
                ciudad: document.getElementById('ciudad').value,
                pais: document.getElementById('pais').value,
                codigo_postal: document.getElementById('codigoPostal').value,
                estado_kyc: 'pendiente',
                ultima_actualizacion: new Date().toISOString()
            };

            showMessage('Enviando documentos para verificación...', 'info');

            const { error } = await db
                .from('perfiles')
                .update(datos)
                .eq('id', user.id);

            if (error) {
                showMessage('Error al enviar: ' + error.message, 'error');
            } else {
                showMessage('Documentos enviados. Tu verificación será revisada pronto.', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        });
    }

    cargarPerfil();
});
