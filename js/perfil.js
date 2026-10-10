document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    let currentStream = null;
    let currentCameraType = null;
    let faceApiLoaded = false;
    let trackingAnimationId = null;

    // 🌍 LISTA COMPLETA DE TODOS LOS PAÍSES DEL MUNDO
    const countries = [
        { code: 'AF', name: 'Afganistán', phone: '+93', flag: '🇦🇫' },
        { code: 'AL', name: 'Albania', phone: '+355', flag: '🇦🇱' },
        { code: 'DE', name: 'Alemania', phone: '+49', flag: '🇩🇪' },
        { code: 'AD', name: 'Andorra', phone: '+376', flag: '🇦🇩' },
        { code: 'AO', name: 'Angola', phone: '+244', flag: '🇦🇴' },
        { code: 'AG', name: 'Antigua y Barbuda', phone: '+1-268', flag: '🇦🇬' },
        { code: 'SA', name: 'Arabia Saudita', phone: '+966', flag: '🇸🇦' },
        { code: 'DZ', name: 'Argelia', phone: '+213', flag: '🇩🇿' },
        { code: 'AR', name: 'Argentina', phone: '+54', flag: '🇦🇷' },
        { code: 'AM', name: 'Armenia', phone: '+374', flag: '🇦🇲' },
        { code: 'AU', name: 'Australia', phone: '+61', flag: '🇦🇺' },
        { code: 'AT', name: 'Austria', phone: '+43', flag: '🇦🇹' },
        { code: 'AZ', name: 'Azerbaiyán', phone: '+994', flag: '🇦🇿' },
        { code: 'BS', name: 'Bahamas', phone: '+1-242', flag: '🇧🇸' },
        { code: 'BD', name: 'Bangladés', phone: '+880', flag: '🇧🇩' },
        { code: 'BB', name: 'Barbados', phone: '+1-246', flag: '🇧🇧' },
        { code: 'BH', name: 'Baréin', phone: '+973', flag: '🇧🇭' },
        { code: 'BE', name: 'Bélgica', phone: '+32', flag: '🇧🇪' },
        { code: 'BZ', name: 'Belice', phone: '+501', flag: '🇧🇿' },
        { code: 'BJ', name: 'Benín', phone: '+229', flag: '🇧🇯' },
        { code: 'BY', name: 'Bielorrusia', phone: '+375', flag: '🇧🇾' },
        { code: 'MM', name: 'Birmania (Myanmar)', phone: '+95', flag: '🇲🇲' },
        { code: 'BO', name: 'Bolivia', phone: '+591', flag: '🇧🇴' },
        { code: 'BA', name: 'Bosnia y Herzegovina', phone: '+387', flag: '🇧🇦' },
        { code: 'BW', name: 'Botsuana', phone: '+267', flag: '🇧🇼' },
        { code: 'BR', name: 'Brasil', phone: '+55', flag: '🇧🇷' },
        { code: 'BN', name: 'Brunéi', phone: '+673', flag: '🇧🇳' },
        { code: 'BG', name: 'Bulgaria', phone: '+359', flag: '🇧🇬' },
        { code: 'BF', name: 'Burkina Faso', phone: '+226', flag: '🇧🇫' },
        { code: 'BI', name: 'Burundi', phone: '+257', flag: '🇧🇮' },
        { code: 'BT', name: 'Bután', phone: '+975', flag: '🇧🇹' },
        { code: 'CV', name: 'Cabo Verde', phone: '+238', flag: '🇨🇻' },
        { code: 'KH', name: 'Camboya', phone: '+855', flag: '🇰🇭' },
        { code: 'CM', name: 'Camerún', phone: '+237', flag: '🇨🇲' },
        { code: 'CA', name: 'Canadá', phone: '+1', flag: '🇨🇦' },
        { code: 'QA', name: 'Catar', phone: '+974', flag: '🇶🇦' },
        { code: 'TD', name: 'Chad', phone: '+235', flag: '🇹🇩' },
        { code: 'CL', name: 'Chile', phone: '+56', flag: '🇨🇱' },
        { code: 'CN', name: 'China', phone: '+86', flag: '🇨🇳' },
        { code: 'CY', name: 'Chipre', phone: '+357', flag: '🇨🇾' },
        { code: 'VA', name: 'Ciudad del Vaticano', phone: '+379', flag: '🇻🇦' },
        { code: 'CO', name: 'Colombia', phone: '+57', flag: '🇨🇴' },
        { code: 'KM', name: 'Comoras', phone: '+269', flag: '🇰🇲' },
        { code: 'CG', name: 'Congo (República del)', phone: '+242', flag: '🇨🇬' },
        { code: 'CD', name: 'Congo (República Dem. del)', phone: '+243', flag: '🇨🇩' },
        { code: 'KP', name: 'Corea del Norte', phone: '+850', flag: '🇰🇵' },
        { code: 'KR', name: 'Corea del Sur', phone: '+82', flag: '🇰🇷' },
        { code: 'CI', name: 'Costa de Marfil', phone: '+225', flag: '🇨🇮' },
        { code: 'CR', name: 'Costa Rica', phone: '+506', flag: '🇨🇷' },
        { code: 'HR', name: 'Croacia', phone: '+385', flag: '🇭🇷' },
        { code: 'CU', name: 'Cuba', phone: '+53', flag: '🇨🇺' },
        { code: 'DK', name: 'Dinamarca', phone: '+45', flag: '🇩🇰' },
        { code: 'DM', name: 'Dominica', phone: '+1-767', flag: '🇩🇲' },
        { code: 'EC', name: 'Ecuador', phone: '+593', flag: '🇪🇨' },
        { code: 'EG', name: 'Egipto', phone: '+20', flag: '🇪🇬' },
        { code: 'SV', name: 'El Salvador', phone: '+503', flag: '🇸🇻' },
        { code: 'AE', name: 'Emiratos Árabes Unidos', phone: '+971', flag: '🇦🇪' },
        { code: 'ER', name: 'Eritrea', phone: '+291', flag: '🇪🇷' },
        { code: 'SK', name: 'Eslovaquia', phone: '+421', flag: '🇸🇰' },
        { code: 'SI', name: 'Eslovenia', phone: '+386', flag: '🇸🇮' },
        { code: 'ES', name: 'España', phone: '+34', flag: '🇪🇸' },
        { code: 'US', name: 'Estados Unidos', phone: '+1', flag: '🇺🇸' },
        { code: 'EE', name: 'Estonia', phone: '+372', flag: '🇪🇪' },
        { code: 'ET', name: 'Etiopía', phone: '+251', flag: '🇪🇹' },
        { code: 'PH', name: 'Filipinas', phone: '+63', flag: '🇵🇭' },
        { code: 'FI', name: 'Finlandia', phone: '+358', flag: '🇫🇮' },
        { code: 'FJ', name: 'Fiyi', phone: '+679', flag: '🇫🇯' },
        { code: 'FR', name: 'Francia', phone: '+33', flag: '🇫🇷' },
        { code: 'GA', name: 'Gabón', phone: '+241', flag: '🇬🇦' },
        { code: 'GM', name: 'Gambia', phone: '+220', flag: '🇬🇲' },
        { code: 'GE', name: 'Georgia', phone: '+995', flag: '🇬🇪' },
        { code: 'GH', name: 'Ghana', phone: '+233', flag: '🇬🇭' },
        { code: 'GD', name: 'Granada', phone: '+1-473', flag: '🇬🇩' },
        { code: 'GR', name: 'Grecia', phone: '+30', flag: '🇬🇷' },
        { code: 'GT', name: 'Guatemala', phone: '+502', flag: '🇬🇹' },
        { code: 'GN', name: 'Guinea', phone: '+224', flag: '🇬🇳' },
        { code: 'GQ', name: 'Guinea Ecuatorial', phone: '+240', flag: '🇬🇶' },
        { code: 'GW', name: 'Guinea-Bisáu', phone: '+245', flag: '🇬🇼' },
        { code: 'GY', name: 'Guyana', phone: '+592', flag: '🇬🇾' },
        { code: 'HT', name: 'Haití', phone: '+509', flag: '🇭🇹' },
        { code: 'HN', name: 'Honduras', phone: '+504', flag: '🇭🇳' },
        { code: 'HU', name: 'Hungría', phone: '+36', flag: '🇭🇺' },
        { code: 'IN', name: 'India', phone: '+91', flag: '🇮🇳' },
        { code: 'ID', name: 'Indonesia', phone: '+62', flag: '🇮🇩' },
        { code: 'IQ', name: 'Irak', phone: '+964', flag: '🇮🇶' },
        { code: 'IR', name: 'Irán', phone: '+98', flag: '🇮🇷' },
        { code: 'IE', name: 'Irlanda', phone: '+353', flag: '🇮🇪' },
        { code: 'IS', name: 'Islandia', phone: '+354', flag: '🇮🇸' },
        { code: 'MH', name: 'Islas Marshall', phone: '+692', flag: '🇲🇭' },
        { code: 'SB', name: 'Islas Salomón', phone: '+677', flag: '🇸🇧' },
        { code: 'IL', name: 'Israel', phone: '+972', flag: '🇮🇱' },
        { code: 'IT', name: 'Italia', phone: '+39', flag: '🇮🇹' },
        { code: 'JM', name: 'Jamaica', phone: '+1-876', flag: '🇯🇲' },
        { code: 'JP', name: 'Japón', phone: '+81', flag: '🇯🇵' },
        { code: 'JO', name: 'Jordania', phone: '+962', flag: '🇯🇴' },
        { code: 'KZ', name: 'Kazajistán', phone: '+7', flag: '🇰🇿' },
        { code: 'KE', name: 'Kenia', phone: '+254', flag: '🇰🇪' },
        { code: 'KG', name: 'Kirguistán', phone: '+996', flag: '🇰🇬' },
        { code: 'KI', name: 'Kiribati', phone: '+686', flag: '🇰🇮' },
        { code: 'KW', name: 'Kuwait', phone: '+965', flag: '🇰🇼' },
        { code: 'LA', name: 'Laos', phone: '+856', flag: '🇱🇦' },
        { code: 'LS', name: 'Lesoto', phone: '+266', flag: '🇱🇸' },
        { code: 'LV', name: 'Letonia', phone: '+371', flag: '🇱🇻' },
        { code: 'LB', name: 'Líbano', phone: '+961', flag: '🇱🇧' },
        { code: 'LR', name: 'Liberia', phone: '+231', flag: '🇱🇷' },
        { code: 'LY', name: 'Libia', phone: '+218', flag: '🇱🇾' },
        { code: 'LI', name: 'Liechtenstein', phone: '+423', flag: '🇱🇮' },
        { code: 'LT', name: 'Lituania', phone: '+370', flag: '🇱🇹' },
        { code: 'LU', name: 'Luxemburgo', phone: '+352', flag: '🇱🇺' },
        { code: 'MG', name: 'Madagascar', phone: '+261', flag: '🇲🇬' },
        { code: 'MY', name: 'Malasia', phone: '+60', flag: '🇲🇾' },
        { code: 'MW', name: 'Malaui', phone: '+265', flag: '🇲🇼' },
        { code: 'MV', name: 'Maldivas', phone: '+960', flag: '🇲🇻' },
        { code: 'ML', name: 'Malí', phone: '+223', flag: '🇲🇱' },
        { code: 'MT', name: 'Malta', phone: '+356', flag: '🇲🇹' },
        { code: 'MA', name: 'Marruecos', phone: '+212', flag: '🇲🇦' },
        { code: 'MU', name: 'Mauricio', phone: '+230', flag: '🇲🇺' },
        { code: 'MR', name: 'Mauritania', phone: '+222', flag: '🇲🇷' },
        { code: 'MX', name: 'México', phone: '+52', flag: '🇲🇽' },
        { code: 'FM', name: 'Micronesia', phone: '+691', flag: '🇫🇲' },
        { code: 'MD', name: 'Moldavia', phone: '+373', flag: '🇲🇩' },
        { code: 'MC', name: 'Mónaco', phone: '+377', flag: '🇲🇨' },
        { code: 'MN', name: 'Mongolia', phone: '+976', flag: '🇲🇳' },
        { code: 'ME', name: 'Montenegro', phone: '+382', flag: '🇲🇪' },
        { code: 'MZ', name: 'Mozambique', phone: '+258', flag: '🇲🇿' },
        { code: 'NA', name: 'Namibia', phone: '+264', flag: '🇳🇦' },
        { code: 'NR', name: 'Nauru', phone: '+674', flag: '🇳🇷' },
        { code: 'NP', name: 'Nepal', phone: '+977', flag: '🇳🇵' },
        { code: 'NI', name: 'Nicaragua', phone: '+505', flag: '🇳🇮' },
        { code: 'NE', name: 'Níger', phone: '+227', flag: '🇳🇪' },
        { code: 'NG', name: 'Nigeria', phone: '+234', flag: '🇳🇬' },
        { code: 'NO', name: 'Noruega', phone: '+47', flag: '🇳🇴' },
        { code: 'NZ', name: 'Nueva Zelanda', phone: '+64', flag: '🇳🇿' },
        { code: 'OM', name: 'Omán', phone: '+968', flag: '🇴🇲' },
        { code: 'NL', name: 'Países Bajos', phone: '+31', flag: '🇳🇱' },
        { code: 'PK', name: 'Pakistán', phone: '+92', flag: '🇵🇰' },
        { code: 'PW', name: 'Palaos', phone: '+680', flag: '🇵🇼' },
        { code: 'PA', name: 'Panamá', phone: '+507', flag: '🇵🇦' },
        { code: 'PG', name: 'Papúa Nueva Guinea', phone: '+675', flag: '🇵🇬' },
        { code: 'PY', name: 'Paraguay', phone: '+595', flag: '🇵🇾' },
        { code: 'PE', name: 'Perú', phone: '+51', flag: '🇵🇪' },
        { code: 'PL', name: 'Polonia', phone: '+48', flag: '🇵🇱' },
        { code: 'PT', name: 'Portugal', phone: '+351', flag: '🇵🇹' },
        { code: 'GB', name: 'Reino Unido', phone: '+44', flag: '🇬🇧' },
        { code: 'CF', name: 'República Centroafricana', phone: '+236', flag: '🇨🇫' },
        { code: 'CZ', name: 'República Checa', phone: '+420', flag: '🇨🇿' },
        { code: 'DO', name: 'República Dominicana', phone: '+1-809', flag: '🇩🇴' },
        { code: 'RW', name: 'Ruanda', phone: '+250', flag: '🇷🇼' },
        { code: 'RO', name: 'Rumania', phone: '+40', flag: '🇷🇴' },
        { code: 'RU', name: 'Rusia', phone: '+7', flag: '🇷🇺' },
        { code: 'WS', name: 'Samoa', phone: '+685', flag: '🇼🇸' },
        { code: 'KN', name: 'San Cristóbal y Nieves', phone: '+1-869', flag: '🇰🇳' },
        { code: 'SM', name: 'San Marino', phone: '+378', flag: '🇸🇲' },
        { code: 'VC', name: 'San Vicente y las Granadinas', phone: '+1-784', flag: '🇻🇨' },
        { code: 'LC', name: 'Santa Lucía', phone: '+1-758', flag: '🇱🇨' },
        { code: 'ST', name: 'Santo Tomé y Príncipe', phone: '+239', flag: '🇸🇹' },
        { code: 'SN', name: 'Senegal', phone: '+221', flag: '🇸🇳' },
        { code: 'RS', name: 'Serbia', phone: '+381', flag: '🇷🇸' },
        { code: 'SC', name: 'Seychelles', phone: '+248', flag: '🇸🇨' },
        { code: 'SL', name: 'Sierra Leona', phone: '+232', flag: '🇸🇱' },
        { code: 'SG', name: 'Singapur', phone: '+65', flag: '🇸🇬' },
        { code: 'SY', name: 'Siria', phone: '+963', flag: '🇸🇾' },
        { code: 'SO', name: 'Somalia', phone: '+252', flag: '🇸🇴' },
        { code: 'LK', name: 'Sri Lanka', phone: '+94', flag: '🇱🇰' },
        { code: 'SZ', name: 'Suazilandia (Eswatini)', phone: '+268', flag: '🇸🇿' },
        { code: 'ZA', name: 'Sudáfrica', phone: '+27', flag: '🇿🇦' },
        { code: 'SD', name: 'Sudán', phone: '+249', flag: '🇸🇩' },
        { code: 'SS', name: 'Sudán del Sur', phone: '+211', flag: '🇸🇸' },
        { code: 'SE', name: 'Suecia', phone: '+46', flag: '🇸🇪' },
        { code: 'CH', name: 'Suiza', phone: '+41', flag: '🇨🇭' },
        { code: 'SR', name: 'Surinam', phone: '+597', flag: '🇸🇷' },
        { code: 'TH', name: 'Tailandia', phone: '+66', flag: '🇹🇭' },
        { code: 'TW', name: 'Taiwán', phone: '+886', flag: '🇹🇼' },
        { code: 'TZ', name: 'Tanzania', phone: '+255', flag: '🇹🇿' },
        { code: 'TJ', name: 'Tayikistán', phone: '+992', flag: '🇹🇯' },
        { code: 'TL', name: 'Timor Oriental', phone: '+670', flag: '🇹🇱' },
        { code: 'TG', name: 'Togo', phone: '+228', flag: '🇹🇬' },
        { code: 'TO', name: 'Tonga', phone: '+676', flag: '🇹🇴' },
        { code: 'TT', name: 'Trinidad y Tobago', phone: '+1-868', flag: '🇹🇹' },
        { code: 'TN', name: 'Túnez', phone: '+216', flag: '🇹🇳' },
        { code: 'TM', name: 'Turkmenistán', phone: '+993', flag: '🇹🇲' },
        { code: 'TR', name: 'Turquía', phone: '+90', flag: '🇹🇷' },
        { code: 'TV', name: 'Tuvalu', phone: '+688', flag: '🇹🇻' },
        { code: 'UA', name: 'Ucrania', phone: '+380', flag: '🇺🇦' },
        { code: 'UG', name: 'Uganda', phone: '+256', flag: '🇺🇬' },
        { code: 'UY', name: 'Uruguay', phone: '+598', flag: '🇺🇾' },
        { code: 'UZ', name: 'Uzbekistán', phone: '+998', flag: '🇺🇿' },
        { code: 'VU', name: 'Vanuatu', phone: '+678', flag: '🇻🇺' },
        { code: 'VE', name: 'Venezuela', phone: '+58', flag: '🇻🇪' },
        { code: 'VN', name: 'Vietnam', phone: '+84', flag: '🇻🇳' },
        { code: 'YE', name: 'Yemen', phone: '+967', flag: '🇾🇪' },
        { code: 'DJ', name: 'Yibuti', phone: '+253', flag: '🇩🇯' },
        { code: 'ZM', name: 'Zambia', phone: '+260', flag: '🇿🇲' },
        { code: 'ZW', name: 'Zimbabue', phone: '+263', flag: '🇿🇼' }
    ];

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function llenarSelectoresPaises() {
        const phoneSelect = document.getElementById('phoneCountry');
        const nationalitySelect = document.getElementById('nacionalidad');
        const countrySelect = document.getElementById('pais');

        // Opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecciona un país...';
        phoneSelect.appendChild(defaultOption.cloneNode(true));
        nationalitySelect.appendChild(defaultOption.cloneNode(true));
        countrySelect.appendChild(defaultOption.cloneNode(true));

        countries.forEach(country => {
            const phoneOption = document.createElement('option');
            phoneOption.value = country.phone;
            phoneOption.textContent = `${country.flag} ${country.name} (${country.phone})`;
            phoneSelect.appendChild(phoneOption);

            const natOption = document.createElement('option');
            natOption.value = country.name;
            natOption.textContent = `${country.flag} ${country.name}`;
            nationalitySelect.appendChild(natOption);

            const countryOption = document.createElement('option');
            countryOption.value = country.name;
            countryOption.textContent = `${country.flag} ${country.name}`;
            countrySelect.appendChild(countryOption);
        });
    }

    // 🧠 1. PRECARGAR MODELOS DE IA AL INICIAR LA PÁGINA
    async function preloadFaceModels() {
        const statusDiv = document.getElementById('faceDetectionStatus');
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            faceApiLoaded = true;
            console.log('✅ Modelos de IA precargados correctamente');
            if (statusDiv) {
                statusDiv.className = 'face-detection-status success';
                statusDiv.textContent = '✅ Sistema de IA listo. Abre la cámara para el rastreo.';
                setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            console.error('❌ Error precargando IA:', err);
            if (statusDiv) {
                statusDiv.className = 'face-detection-status error';
                statusDiv.textContent = '⚠️ Error cargando IA. Asegúrate de tener buena conexión.';
            }
        }
    }

    async function cargarPerfil() {
        try {
            const { data: { user } } = await db.auth.getUser();
            if (!user) { window.location.href = 'login.html'; return; }

            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (error) { console.error('Error al cargar perfil:', error); return; }

            document.getElementById('profileName').textContent = perfil.nombre || 'Usuario';
            document.getElementById('profileId').textContent = `ID: ${perfil.user_id}`;
            document.getElementById('profileEmail').textContent = perfil.email;
            
            const avatarInitial = document.getElementById('avatarInitial');
            const avatarImage = document.getElementById('avatarImage');
            if (perfil.avatar_url) {
                avatarImage.src = perfil.avatar_url;
                avatarImage.style.display = 'block';
                avatarInitial.style.display = 'none';
            } else {
                avatarInitial.textContent = (perfil.nombre || 'U').charAt(0).toUpperCase();
                avatarInitial.style.display = 'flex';
                avatarImage.style.display = 'none';
            }

            const kycStatus = document.getElementById('kycStatus');
            const kycSection = document.querySelectorAll('.form-section')[2];
            const estado = perfil.estado_kyc;

            if (!estado || estado === '') {
                kycStatus.className = 'kyc-status pending';
                kycStatus.innerHTML = '<i class="fas fa-id-card"></i> Verificación KYC Pendiente - Completa tus datos';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC'; submitBtn.style.background = ''; }
                if (kycSection) { kycSection.style.opacity = '1'; kycSection.style.pointerEvents = 'auto'; }
            } else if (estado === 'verificado') {
                kycStatus.className = 'kyc-status verified';
                kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado';
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> KYC Ya Verificado'; submitBtn.style.background = '#00ff00'; }
                if (kycSection) { kycSection.style.opacity = '0.5'; kycSection.style.pointerEvents = 'none'; }
            } else if (estado === 'rechazado') {
                kycStatus.className = 'kyc-status rejected';
                kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado - Puede Reenviar';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar Documentos'; submitBtn.style.background = ''; }
                if (kycSection) { kycSection.style.opacity = '1'; kycSection.style.pointerEvents = 'auto'; }
                showMessage('⚠️ Tu KYC fue rechazado. Por favor, corrige la información y reenvía.', 'error');
            } else if (estado === 'pendiente' || estado === 'revision') {
                kycStatus.className = 'kyc-status reviewing';
                kycStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> KYC en Revisión por Administrador';
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión'; submitBtn.style.background = '#666'; }
                if (kycSection) { kycSection.style.opacity = '0.5'; kycSection.style.pointerEvents = 'none'; }
                showMessage('⏳ Tus documentos están siendo revisados. Espera la aprobación.', 'info');
            }

            // Llenar formulario con datos existentes
            document.getElementById('nombre').value = perfil.nombre || '';
            document.getElementById('telefono').value = perfil.telefono ? perfil.telefono.split(' ').slice(1).join(' ') : '';
            document.getElementById('phoneCountry').value = perfil.telefono ? perfil.telefono.split(' ')[0] : '';
            document.getElementById('fechaNacimiento').value = perfil.fecha_nacimiento || '';
            document.getElementById('nacionalidad').value = perfil.nacionalidad || '';
            document.getElementById('direccion').value = perfil.direccion || '';
            document.getElementById('ciudad').value = perfil.ciudad || '';
            document.getElementById('estadoProvincia').value = perfil.estado_provincia || '';
            document.getElementById('pais').value = perfil.pais || '';
            document.getElementById('codigoPostal').value = perfil.codigo_postal || '';
            document.getElementById('tipoDocumento').value = perfil.tipo_documento || '';
            document.getElementById('numeroDocumento').value = perfil.numero_documento || '';

            // Mostrar vistas previas si ya existen URLs
            if (perfil.documento_frontal_url) {
                document.getElementById('docFrontalUrl').value = perfil.documento_frontal_url;
                document.getElementById('docFrontPreview').innerHTML = `<img src="${perfil.documento_frontal_url}" alt="Doc Frente">`;
            }
            if (perfil.documento_trasero_url) {
                document.getElementById('docTraseroUrl').value = perfil.documento_trasero_url;
                document.getElementById('docBackPreview').innerHTML = `<img src="${perfil.documento_trasero_url}" alt="Doc Reverso">`;
            }
            if (perfil.selfie_url) {
                document.getElementById('selfieUrl').value = perfil.selfie_url;
                document.getElementById('selfiePreview').innerHTML = `<img src="${perfil.selfie_url}" alt="Selfie">`;
            }

            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error:', err);
        }
    }

    window.openCamera = async function(type) {
        currentCameraType = type;
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        const title = document.getElementById('modalTitle');
        const errorMsg = document.getElementById('cameraError');
        const captureBtn = document.getElementById('modalCaptureBtn');

        const titles = { 
            'docFront': 'Foto del documento (Frente)', 
            'docBack': 'Foto del documento (Reverso)', 
            'selfie': 'Selfie con rastreo facial (IA)' 
        };
        title.textContent = titles[type] || 'Cámara';
        errorMsg.style.display = 'none';
        captureBtn.disabled = true;
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Esperando rostro...';

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: type === 'selfie' ? 'user' : 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            video.srcObject = currentStream;
            modal.classList.add('show');

            video.onloadedmetadata = () => {
                if (type === 'selfie' && faceApiLoaded) {
                    startFaceTracking(video);
                } else if (type === 'selfie' && !faceApiLoaded) {
                    const statusDiv = document.getElementById('faceDetectionStatus');
                    statusDiv.className = 'face-detection-status error';
                    statusDiv.textContent = '⚠️ IA no cargada. Asegúrate de que tu rostro sea claro.';
                    captureBtn.disabled = false;
                    captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capturar';
                } else {
                    captureBtn.disabled = false;
                    captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capturar';
                }
            };
        } catch (err) {
            console.error('Error al abrir cámara:', err);
            errorMsg.style.display = 'block';
            showMessage('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    };

    // 🎯 2. BUCLE DE RASTREO EN TIEMPO REAL
    function startFaceTracking(video) {
        const canvas = document.getElementById('faceCanvas');
        const statusDiv = document.getElementById('faceDetectionStatus');
        const captureBtn = document.getElementById('modalCaptureBtn');

        const detect = async () => {
            if (!currentStream || !document.getElementById('cameraModal').classList.contains('show')) {
                return;
            }

            const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
            faceapi.matchDimensions(canvas, displaySize);

            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
            const resizedDetections = faceapi.resizeResults(detection, displaySize);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (resizedDetections) {
                faceapi.draw.drawDetections(canvas, resizedDetections);
                statusDiv.className = 'face-detection-status success';
                statusDiv.textContent = '✅ Rostro humano detectado. ¡Listo para capturar!';
                captureBtn.disabled = false;
                captureBtn.innerHTML = '<i class="fas fa-check-circle"></i> ¡Capturar Selfie!';
                captureBtn.style.background = '#00ff00';
                captureBtn.style.color = '#000';
            } else {
                statusDiv.className = 'face-detection-status detecting';
                statusDiv.textContent = '🔍 Buscando rostro... Centra tu cara en el cuadro.';
                captureBtn.disabled = true;
                captureBtn.innerHTML = '<i class="fas fa-camera"></i> Esperando rostro...';
                captureBtn.style.background = '';
                captureBtn.style.color = '';
            }

            trackingAnimationId = requestAnimationFrame(detect);
        };

        detect();
    }

    window.closeCamera = function() {
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        
        if (trackingAnimationId) {
            cancelAnimationFrame(trackingAnimationId);
            trackingAnimationId = null;
        }

        const canvas = document.getElementById('faceCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        video.srcObject = null;
        modal.classList.remove('show');
    };

    window.captureFromModal = function() {
        const video = document.getElementById('modalVideo');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        const fieldMap = {
            'docFront': { url: 'docFrontalUrl', preview: 'docFrontPreview' },
            'docBack': { url: 'docTraseroUrl', preview: 'docBackPreview' },
            'selfie': { url: 'selfieUrl', preview: 'selfiePreview' }
        };

        const field = fieldMap[currentCameraType];
        if (field) {
            document.getElementById(field.url).value = imageData;
            document.getElementById(field.preview).innerHTML = `<img src="${imageData}" alt="Captura">`;
        }
        closeCamera();
    };

    window.takePhoto = window.captureFromModal;

    const fullProfileForm = document.getElementById('fullProfileForm');
    if (fullProfileForm) {
        fullProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const docFrontal = document.getElementById('docFrontalUrl').value;
            const docTrasero = document.getElementById('docTraseroUrl').value;
            const selfie = document.getElementById('selfieUrl').value;

            if (!docFrontal) { showMessage('Por favor, toma una foto del frente de tu documento.', 'error'); return; }
            if (!selfie) { showMessage('Por favor, toma una selfie con detección facial.', 'error'); return; }

            const phoneCountry = document.getElementById('phoneCountry').value;
            const telefono = document.getElementById('telefono').value;

            const datos = {
                nombre: document.getElementById('nombre').value,
                telefono: phoneCountry + ' ' + telefono,
                fecha_nacimiento: document.getElementById('fechaNacimiento').value,
                nacionalidad: document.getElementById('nacionalidad').value,
                direccion: document.getElementById('direccion').value,
                ciudad: document.getElementById('ciudad').value,
                estado_provincia: document.getElementById('estadoProvincia').value,
                pais: document.getElementById('pais').value,
                codigo_postal: document.getElementById('codigoPostal').value,
                tipo_documento: document.getElementById('tipoDocumento').value,
                numero_documento: document.getElementById('numeroDocumento').value,
                documento_frontal_url: docFrontal,
                documento_trasero_url: docTrasero || null,
                selfie_url: selfie,
                estado_kyc: 'pendiente',
                ultima_actualizacion: new Date().toISOString()
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando a verificación...';
            showMessage('📤 Guardando perfil y enviando documentos...', 'info');

            const { error } = await db.from('perfiles').update(datos).eq('id', user.id);

            if (error) {
                showMessage('Error al guardar: ' + error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC';
            } else {
                showMessage('✅ Perfil guardado y KYC enviado. Un administrador revisará tus documentos pronto.', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);
            }
        });
    }

    // Inicialización
    llenarSelectoresPaises();
    preloadFaceModels();
    cargarPerfil();
});
