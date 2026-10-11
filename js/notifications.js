// ============================================
// 🔔 SISTEMA DE NOTIFICACIONES + CARRUSEL
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 🎠 Inicializar carrusel infinito
    const track = document.getElementById('eventsCarouselTrack');
    if (track) {
        const slides = track.innerHTML;
        track.innerHTML = slides + slides; 
    }
    
    // 🔔 Cargar notificaciones
    cargarNotificaciones();
});

// Notificaciones de ejemplo (eventos terminados)
const notificacionesEjemplo = [
    { id: 1, tipo: 'win', titulo: '¡Ganaste el Torneo Regional!', mensaje: 'El evento "Copa Norte 2024" ha finalizado. Quedaste en 1er lugar y ganaste +50 BC.', tiempo: 'Hace 5 minutos', leida: false },
    { id: 2, tipo: 'lose', titulo: 'Evento finalizado - Desafío Semanal', mensaje: 'No clasificaste al Desafío Semanal. ¡Sigue practicando para la próxima!', tiempo: 'Hace 2 horas', leida: false },
    { id: 3, tipo: 'info', titulo: 'Nuevo evento disponible', mensaje: 'Se ha abierto la inscripción para el "Torneo Nacional 2024". ¡No te quedes fuera!', tiempo: 'Hace 1 día', leida: false },
    { id: 4, tipo: 'win', titulo: '¡Victoria en Liga de Elite!', mensaje: 'Ganaste contra "El Minga" López. +25 BC añadidos a tu saldo.', tiempo: 'Hace 2 días', leida: true },
    { id: 5, tipo: 'info', titulo: 'Actualización de ranking', mensaje: 'Tu ranking nacional subió al puesto #12. ¡Sigue así!', tiempo: 'Hace 3 días', leida: true }
];

let notificaciones = [...notificacionesEjemplo];

function cargarNotificaciones() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    
    const notificacionesMostrar = notificaciones.slice(0, 5);
    const noLeidas = notificaciones.filter(n => !n.leida).length;
    
    badge.textContent = noLeidas;
    if (noLeidas > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
    
    if (notificacionesMostrar.length === 0) {
        list.innerHTML = `<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones</p></div>`;
        return;
    }
    
    list.innerHTML = notificacionesMostrar.map(n => `
        <div class="notification-item ${n.leida ? '' : 'unread'}" onclick="marcarLeida(${n.id})">
            <div class="notification-icon ${n.tipo}">
                <i class="fas fa-${n.tipo === 'win' ? 'trophy' : n.tipo === 'lose' ? 'times' : 'info'}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${n.titulo}</div>
                <div class="notification-message">${n.mensaje}</div>
                <div class="notification-time"><i class="fas fa-clock"></i> ${n.tiempo}</div>
            </div>
        </div>
    `).join('');
}

// Función global para cerrar paneles en móvil
window.cerrarPanelesMovil = function() {
    const overlay = document.getElementById('mobileOverlay');
    const notifDropdown = document.getElementById('notificationDropdown');
    const userDropdown = document.getElementById('dropdownMenu');
    
    if (overlay) overlay.style.display = 'none';
    if (notifDropdown) notifDropdown.classList.remove('show');
    if (userDropdown) userDropdown.classList.remove('show');
};

// Toggle Notificaciones (Adaptado para móvil)
window.toggleNotifications = function() {
    if (window.innerWidth <= 768) {
        const dropdown = document.getElementById('notificationDropdown');
        const overlay = document.getElementById('mobileOverlay');
        
        if (dropdown.classList.contains('show')) {
            window.cerrarPanelesMovil();
        } else {
            document.getElementById('dropdownMenu').classList.remove('show');
            dropdown.classList.add('show');
            if (overlay) overlay.style.display = 'block';
        }
    } else {
        const dropdown = document.getElementById('notificationDropdown');
        const btn = document.getElementById('notificationBtn');
        dropdown.classList.toggle('show');
        btn.classList.toggle('active');
        document.getElementById('dropdownMenu').classList.remove('show');
    }
};

// Toggle Menú de Usuario (Adaptado para móvil)
window.toggleMenu = function() {
    if (window.innerWidth <= 768) {
        const dropdown = document.getElementById('dropdownMenu');
        const overlay = document.getElementById('mobileOverlay');
        
        if (dropdown.classList.contains('show')) {
            window.cerrarPanelesMovil();
        } else {
            document.getElementById('notificationDropdown').classList.remove('show');
            dropdown.classList.add('show');
            if (overlay) overlay.style.display = 'block';
        }
    } else {
        const dropdown = document.getElementById('dropdownMenu');
        const btn = document.getElementById('menuToggle');
        dropdown.classList.toggle('show');
        btn.classList.toggle('active');
        document.getElementById('notificationDropdown').classList.remove('show');
    }
};

window.marcarLeida = function(id) {
    const notif = notificaciones.find(n => n.id === id);
    if (notif) {
        notif.leida = true;
        cargarNotificaciones();
    }
};

window.marcarTodasLeidas = function(event) {
    event.stopPropagation();
    notificaciones.forEach(n => n.leida = true);
    cargarNotificaciones();
};

window.verMasNotificaciones = function() {
    alert('🚧 El módulo "Mis Apuestas" estará disponible próximamente.');
};

// Cerrar al tocar el overlay
document.addEventListener('click', function(event) {
    const overlay = document.getElementById('mobileOverlay');
    if (event.target === overlay) {
        window.cerrarPanelesMovil();
    }
});
