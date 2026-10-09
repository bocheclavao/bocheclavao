document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    // 🛡️ CONFIGURACIÓN: Cambia este email por el tuyo
    const ADMIN_EMAIL = 'gamalieljosuepirelalares@gmail.com'; // ← TU CORREO AQUÍ

    const container = document.getElementById('container');
    const loading = document.getElementById('loading');

    // Verificar sesión y permisos de admin
    async function verificarAcceso() {
        const { data: { session }, error } = await db.auth.getSession();
        
        if (error || !session) {
            alert('Debes iniciar sesión para acceder al panel de administración.');
            window.location.href = 'login.html';
            return false;
        }

        const { data: { user } } = await db.auth.getUser();
        
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }

        // Verificar que el email sea el del admin
        if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            alert('⛔ Acceso denegado. Este panel es solo para administradores.');
            window.location.href = 'dashboard.html';
            return false;
        }

        return true;
    }

    async function cargarSolicitudes() {
        try {
            const { data: perfiles, error } = await db
                .from('perfiles')
                .select('*')
                .eq('estado_kyc', 'pendiente')
                .order('fecha_registro', { ascending: false });

            loading.style.display = 'none';

            if (error) {
                container.innerHTML = `<p class="empty">Error al cargar: ${error.message}</p>`;
                return;
            }

            if (!perfiles || perfiles.length === 0) {
                container.innerHTML = `<p class="empty"><i class="fas fa-check-circle" style="font-size: 3rem; color: #00ff00; margin-bottom: 15px;"></i><br>No hay solicitudes de KYC pendientes.</p>`;
                return;
            }

            perfiles.forEach(perfil => {
                const card = document.createElement('div');
                card.className = 'user-card';
                card.innerHTML = `
                    <div class="user-header">
                        <div>
                            <div class="user-name">${perfil.nombre || 'Sin nombre'}</div>
                            <div class="user-id">ID: ${perfil.user_id} | ${perfil.email}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: #FFD700; font-weight: 700;">${perfil.tipo_documento || 'No especificado'}</div>
                            <div style="color: #999; font-size: 0.9rem;">${perfil.numero_documento || '---'}</div>
                        </div>
                    </div>
                    <div class="info-grid">
                        <div class="info-item"><label>Nacionalidad</label><span>${perfil.nacionalidad || '---'}</span></div>
                        <div class="info-item"><label>País de Residencia</label><span>${perfil.pais || '---'}</span></div>
                        <div class="info-item"><label>Ciudad</label><span>${perfil.ciudad || '---'}</span></div>
                        <div class="info-item"><label>Teléfono</label><span>${perfil.telefono || '---'}</span></div>
                        <div class="info-item"><label>Fecha de registro</label><span>${new Date(perfil.fecha_registro).toLocaleDateString()}</span></div>
                    </div>
                    <div class="images-grid">
                        <div class="image-box">
                            <img src="${perfil.documento_frontal_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" alt="Doc Frontal">
                            <p>Documento (Frente)</p>
                        </div>
                        <div class="image-box">
                            <img src="${perfil.documento_trasero_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" alt="Doc Trasero">
                            <p>Documento (Reverso)</p>
                        </div>
                        <div class="image-box">
                            <img src="${perfil.selfie_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" alt="Selfie">
                            <p>Selfie (Validada por IA)</p>
                        </div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-approve" onclick="procesarKYC('${perfil.id}', 'verificado')">
                            <i class="fas fa-check"></i> Aprobar KYC
                        </button>
                        <button class="btn btn-reject" onclick="procesarKYC('${perfil.id}', 'rechazado')">
                            <i class="fas fa-times"></i> Rechazar KYC
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });

        } catch (err) {
            console.error('Error:', err);
            loading.style.display = 'none';
            container.innerHTML = `<p class="empty">Error inesperado.</p>`;
        }
    }

    window.procesarKYC = async function(userId, nuevoEstado) {
        const confirmMsg = nuevoEstado === 'verificado' 
            ? '¿Aprobar este KYC? El usuario podrá participar en la plataforma.'
            : '¿Rechazar este KYC? El usuario deberá reenviar sus documentos.';
            
        if (!confirm(confirmMsg)) return;

        const { error } = await db
            .from('perfiles')
            .update({ 
                estado_kyc: nuevoEstado,
                ultima_actualizacion: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            alert(`KYC ${nuevoEstado === 'verificado' ? 'aprobado' : 'rechazado'} exitosamente.`);
            container.innerHTML = '';
            loading.style.display = 'block';
            cargarSolicitudes();
        }
    };

    // Iniciar verificación
    const accesoPermitido = await verificarAcceso();
    if (accesoPermitido) {
        cargarSolicitudes();
    }
});
