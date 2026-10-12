document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');
    const profileMessageDiv = document.getElementById('profileMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    const fechaNacimientoInput = document.getElementById('fechaNacimiento');

    let currentStream = null;
    let currentCameraType = null;
    let faceApiLoaded = false;
    let trackingAnimationId = null;
    let edadValida = false;
    let currentUserId = null;
    let tempAvatarData = null;
    let perfilBloqueado = false;
    let nombreOriginal = '';
    let perfilActual = null;

    // 🌍 LISTA COMPLETA DE PAÍSES CON BANDERAS Y CÓDIGOS
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
        { code: 'CG', name: 'Congo (Rep. del)', phone: '+242', flag: '🇨🇬' },
        { code: 'CD', name: 'Congo (Rep. Dem. del)', phone: '+243', flag: '🇨🇩' },
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
        { code: 'CF', name: 'Rep. Centroafricana', phone: '+236', flag: '🇨🇫' },
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

    function showProfileMessage(text, type) {
        if (profileMessageDiv) {
            profileMessageDiv.textContent = text;
            profileMessageDiv.className = 'message ' + type;
            setTimeout(() => { profileMessageDiv.className = 'message'; }, 4000);
        }
    }

    function llenarSelectoresPaises() {
        const phoneSelect = document.getElementById('phoneCountry');
        const nationalitySelect = document.getElementById('nacionalidad');
        const countrySelect = document.getElementById('pais');
        if (!phoneSelect || !nationalitySelect || !countrySelect) return;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecciona un país...';
        [phoneSelect, nationalitySelect, countrySelect].forEach(sel => sel.appendChild(defaultOption.cloneNode(true)));

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

    function validarEdad(fechaNacimiento) {
        const edadDiv = document.getElementById('edadValidationMsg');
        if (!edadDiv) return false;
        const hoy = new Date();
        const fechaNac = new Date(fechaNacimiento);
        if (fechaNac > hoy) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> La fecha de nacimiento no puede ser futura.';
            edadValida = false; return false;
        }
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mes = hoy.getMonth() - fechaNac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
        
        if (edad < 18) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Debes ser mayor de edad (18+ años). Tienes ${edad} años.`;
            edadValida = false; return false;
        } else if (edad > 120) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Fecha de nacimiento no válida.';
            edadValida = false; return false;
        } else {
            edadDiv.className = 'validation-message success';
            edadDiv.innerHTML = `<i class="fas fa-check-circle"></i> Edad verificada: ${edad} años ✓`;
            edadValida = true; return true;
        }
    }

    if (fechaNacimientoInput) {
        fechaNacimientoInput.setAttribute('max', new Date().toISOString().split('T')[0]);
        fechaNacimientoInput.addEventListener('change', function() {
            if (this.value) validarEdad(this.value);
            else {
                const edadDiv = document.getElementById('edadValidationMsg');
                if (edadDiv) edadDiv.className = 'validation-message';
                edadValida = false;
            }
        });
    }

    async function preloadFaceModels() {
        const statusDiv = document.getElementById('faceDetectionStatus');
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            faceApiLoaded = true;
            if (statusDiv) {
                statusDiv.className = 'face-detection-status success';
                statusDiv.textContent = '✅ Sistema de IA listo. Abre la cámara para el rastreo.';
                setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            console.error('❌ Error precargando IA:', err);
            if (statusDiv) {
                statusDiv.className = 'face-detection-status error';
                statusDiv.textContent = '⚠️ Error cargando IA. Verifica tu conexión.';
            }
        }
    }

    function setDocStatus(type, state) {
        const map = { docFront: 'docFrontStatus', docBack: 'docBackStatus', selfie: 'selfieStatus' };
        const el = document.getElementById(map[type]);
        if (!el) return;
        if (state === 'ok') { el.className = 'doc-status ok'; el.innerHTML = '<i class="fas fa-check-circle"></i> Cargada'; }
        else if (state === 'missing') { el.className = 'doc-status missing'; el.innerHTML = '<i class="fas fa-times-circle"></i> No cargada'; }
        else if (state === 'optional') { el.className = 'doc-status optional'; el.innerHTML = '<i class="fas fa-minus-circle"></i> No cargada (opcional)'; }
        else if (state === 'pending-save') { el.className = 'doc-status pending-save'; el.innerHTML = '<i class="fas fa-check-circle"></i> Capturada - Se guardará al enviar'; }
    }

    function bloquearCampos(bloquear) {
        perfilBloqueado = bloquear;
        const camposABloquear = [
            'phoneCountry', 'telefono', 'fechaNacimiento', 'nacionalidad',
            'direccion', 'ciudad', 'estadoProvincia', 'pais', 'codigoPostal',
            'tipoDocumento', 'numeroDocumento'
        ];
        camposABloquear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = bloquear;
        });
        document.querySelectorAll('[data-camera-btn]').forEach(btn => { btn.disabled = bloquear; });
        ['sectionPersonal', 'sectionDireccion', 'sectionKyc'].forEach(id => {
            const sec = document.getElementById(id);
            if (sec) {
                if (bloquear) { sec.style.opacity = '0.6'; sec.style.pointerEvents = 'none'; sec.classList.add('locked-section'); }
                else { sec.style.opacity = '1'; sec.style.pointerEvents = 'auto'; sec.classList.remove('locked-section'); }
            }
        });
    }

    async function cargarPerfil() {
        try {
            const { data: { user } } = await db.auth.getUser();
            if (!user) { window.location.href = 'index.html'; return; }
            currentUserId = user.id;

            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (error) { console.error('Error al cargar perfil:', error); return; }
            
            perfilActual = perfil;
            nombreOriginal = perfil.nombre || 'Usuario';
            const apodo = perfil.apodo || '';

            const profileApodo = document.getElementById('profileApodo');
            const profileId = document.getElementById('profileId');
            const profileEmail = document.getElementById('profileEmail');
            if (profileApodo) profileApodo.textContent = apodo || nombreOriginal;
            if (profileId) profileId.textContent = `ID: ${perfil.user_id}`;
            if (profileEmail) profileEmail.textContent = perfil.email;

            mostrarAvatar(perfil.avatar_url, nombreOriginal);

            const apodoInput = document.getElementById('apodo');
            if (apodoInput) apodoInput.value = apodo;

            const nombreInput = document.getElementById('nombre');
            if (nombreInput) { nombreInput.value = nombreOriginal; nombreInput.disabled = true; }

            const kycStatus = document.getElementById('kycStatus');
            const estado = perfil.estado_kyc;

            if (!estado || estado === '') {
                if (kycStatus) { kycStatus.className = 'kyc-status pending'; kycStatus.innerHTML = '<i class="fas fa-id-card"></i> Verificación KYC Pendiente'; }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC'; }
                bloquearCampos(false);
            } else if (estado === 'verificado') {
                if (kycStatus) { kycStatus.className = 'kyc-status verified'; kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado'; }
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> KYC Ya Verificado'; }
                bloquearCampos(true);
            } else if (estado === 'rechazado') {
                if (kycStatus) { kycStatus.className = 'kyc-status rejected'; kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado - Puede Reenviar'; }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar Documentos'; }
                bloquearCampos(false);
                showMessage('⚠️ Tu KYC fue rechazado. Por favor, corrige la información y reenvía.', 'error');
            } else if (estado === 'pendiente' || estado === 'revision') {
                if (kycStatus) { kycStatus.className = 'kyc-status reviewing'; kycStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> KYC en Revisión'; }
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión'; }
                bloquearCampos(true);
                showMessage('⏳ Tus documentos están siendo revisados.', 'info');
            }

            const campos = [
                { id: 'telefono', value: perfil.telefono ? perfil.telefono.split(' ').slice(1).join(' ') : '' },
                { id: 'phoneCountry', value: perfil.telefono ? perfil.telefono.split(' ')[0] : '' },
                { id: 'fechaNacimiento', value: perfil.fecha_nacimiento || '' },
                { id: 'nacionalidad', value: perfil.nacionalidad || '' },
                { id: 'direccion', value: perfil.direccion || '' },
                { id: 'ciudad', value: perfil.ciudad || '' },
                { id: 'estadoProvincia', value: perfil.estado_provincia || '' },
                { id: 'pais', value: perfil.pais || '' },
                { id: 'codigoPostal', value: perfil.codigo_postal || '' },
                { id: 'tipoDocumento', value: perfil.tipo_documento || '' },
                { id: 'numeroDocumento', value: perfil.numero_documento || '' }
            ];
            campos.forEach(c => { const el = document.getElementById(c.id); if (el) el.value = c.value; });

            if (perfil.fecha_nacimiento) validarEdad(perfil.fecha_nacimiento);

            if (perfil.documento_frontal_url) { document.getElementById('docFrontalUrl').value = perfil.documento_frontal_url; setDocStatus('docFront', 'ok'); }
            else setDocStatus('docFront', 'missing');

            if (perfil.documento_trasero_url) { document.getElementById('docTraseroUrl').value = perfil.documento_trasero_url; setDocStatus('docBack', 'ok'); }
            else setDocStatus('docBack', 'optional');

            if (perfil.selfie_url) { document.getElementById('selfieUrl').value = perfil.selfie_url; setDocStatus('selfie', 'ok'); }
            else setDocStatus('selfie', 'missing');

            if (loadingState) loadingState.style.display = 'none';
            if (contentState) contentState.style.display = 'block';

        } catch (err) {
            console.error('Error:', err);
        }
    }

    function mostrarAvatar(avatarUrl, nombre) {
        const avatarInitial = document.getElementById('avatarInitial');
        const avatarImage = document.getElementById('avatarImage');
        if (avatarUrl && !avatarUrl.startsWith('data:')) {
            if (avatarImage) { avatarImage.src = avatarUrl; avatarImage.style.display = 'block'; }
            if (avatarInitial) avatarInitial.style.display = 'none';
        } else if (tempAvatarData) {
            if (avatarImage) { avatarImage.src = tempAvatarData; avatarImage.style.display = 'block'; }
            if (avatarInitial) avatarInitial.style.display = 'none';
        } else {
            if (avatarInitial) { avatarInitial.textContent = (nombre || 'U').charAt(0).toUpperCase(); avatarInitial.style.display = 'flex'; }
            if (avatarImage) avatarImage.style.display = 'none';
        }
    }

    const avatarOptionsModal = document.getElementById('avatarOptionsModal');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const avatarWrapper = document.getElementById('avatarWrapper');

    if (avatarWrapper) {
        avatarWrapper.addEventListener('click', () => {
            tempAvatarData = null;
            if (avatarOptionsModal) avatarOptionsModal.classList.add('show');
        });
    }
    if (document.getElementById('btnAvatarCamera')) {
        document.getElementById('btnAvatarCamera').addEventListener('click', () => {
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show');
            openCamera('avatar');
        });
    }
    if (document.getElementById('btnAvatarGallery')) {
        document.getElementById('btnAvatarGallery').addEventListener('click', () => {
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show');
            if (avatarFileInput) avatarFileInput.click();
        });
    }
    if (document.getElementById('btnAvatarCancel')) {
        document.getElementById('btnAvatarCancel').addEventListener('click', () => { 
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show'); 
        });
    }
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { showProfileMessage('⚠️ El archivo debe ser una imagen.', 'error'); return; }
            if (file.size > 5 * 1024 * 1024) { showProfileMessage('⚠️ La imagen es demasiado grande. Máximo 5MB.', 'error'); return; }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                redimensionarImagen(event.target.result, 300, 300, (dataResized) => {
                    tempAvatarData = dataResized;
                    mostrarAvatar(tempAvatarData, nombreOriginal);
                    showProfileMessage('📷 Foto seleccionada. Pulsa "Guardar Cambios" para aplicarla.', 'info');
                });
            };
            reader.readAsDataURL(file);
            avatarFileInput.value = '';
        });
    }

    function redimensionarImagen(dataUrl, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.onload = function() {
            let width = img.width, height = img.height;
            if (width > height) { if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; } }
            else { if (height > maxHeight) { width = Math.round(width * maxHeight / height); height = maxHeight; } }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUrl;
    }

    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', async () => {
            const apodoInput = document.getElementById('apodo');
            const nuevoApodo = apodoInput ? apodoInput.value.trim() : '';

            if (nuevoApodo.length > 0 && nuevoApodo.length < 2) {
                showProfileMessage('⚠️ El apodo debe tener al menos 2 caracteres.', 'error');
                return;
            }
            if (!tempAvatarData && nuevoApodo === (document.getElementById('profileApodo').textContent)) {
                showProfileMessage('⚠️ No hay cambios para guardar.', 'info');
                return;
            }

            btnSaveProfile.disabled = true;
            btnSaveProfile.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

            try {
                const datosActualizar = { apodo: nuevoApodo, ultima_actualizacion: new Date().toISOString() };
                
                if (tempAvatarData) {
                    const ruta = `${currentUserId}/avatar_${Date.now()}.jpg`;
                    datosActualizar.avatar_url = await subirImagenAStorage(tempAvatarData, ruta);
                }

                const { error } = await db.from('perfiles').update(datosActualizar).eq('id', currentUserId);

                if (error) {
                    showProfileMessage('❌ Error al guardar: ' + error.message, 'error');
                } else {
                    document.getElementById('profileApodo').textContent = nuevoApodo || nombreOriginal;
                    if (tempAvatarData) {
                        mostrarAvatar(datosActualizar.avatar_url, nombreOriginal);
                        tempAvatarData = null;
                    }
                    showProfileMessage('✅ ¡Perfil actualizado correctamente!', 'success');
                }
            } catch (err) {
                showProfileMessage('❌ Error inesperado: ' + err.message, 'error');
            } finally {
                btnSaveProfile.disabled = false;
                btnSaveProfile.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios de Perfil';
            }
        });
    }

    async function subirImagenAStorage(base64Data, ruta) {
        if (!base64Data || !base64Data.startsWith('data:')) return base64Data;
        try {
            const arr = base64Data.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) { u8arr[n] = bstr.charCodeAt(n); }
            const blob = new Blob([u8arr], { type: mime });

            const { error: uploadError } = await db.storage.from('kyc_documentos').upload(ruta, blob, { contentType: mime, upsert: true });
            if (uploadError) throw uploadError;
            
            const { data: urlData } = db.storage.from('kyc_documentos').getPublicUrl(ruta);
            return urlData.publicUrl;
        } catch (err) {
            console.error('Error al subir imagen:', err);
            throw err;
        }
    }

    const cameraModal = document.getElementById('cameraModal');
    const modalVideo = document.getElementById('modalVideo');
    const modalCaptureBtn = document.getElementById('modalCaptureBtn');

    window.openCamera = async function(type) {
        currentCameraType = type;
        const title = document.getElementById('modalTitle');
        const errorMsg = document.getElementById('cameraError');
        const titles = { 'docFront': 'Foto del documento (Frente)', 'docBack': 'Foto del documento (Reverso)', 'selfie': 'Selfie con rastreo facial (IA)', 'avatar': 'Foto de perfil' };
        if (title) title.textContent = titles[type] || 'Cámara';
        if (errorMsg) errorMsg.style.display = 'none';
        if (modalCaptureBtn) { modalCaptureBtn.disabled = true; modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Iniciando cámara...'; }

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: (type === 'selfie' || type === 'avatar') ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            if (modalVideo) modalVideo.srcObject = currentStream;
            if (cameraModal) cameraModal.classList.add('show');
            
            if (modalVideo) {
                modalVideo.onloadeddata = () => {
                    if (type === 'selfie' && faceApiLoaded) startFaceTracking(modalVideo);
                    else if (modalCaptureBtn) { modalCaptureBtn.disabled = false; modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Capturar'; }
                };
            }
        } catch (err) {
            console.error('Error al abrir cámara:', err);
            if (errorMsg) errorMsg.style.display = 'block';
            showMessage('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    };

    function startFaceTracking(video) {
        const canvas = document.getElementById('faceCanvas');
        const statusDiv = document.getElementById('faceDetectionStatus');
        const detect = async () => {
            if (!currentStream || !cameraModal || !cameraModal.classList.contains('show')) return;
            if (video.readyState < 2) { trackingAnimationId = requestAnimationFrame(detect); return; }
            try {
                const displaySize = { width: video.clientWidth || video.videoWidth, height: video.clientHeight || video.videoHeight };
                if (canvas) faceapi.matchDimensions(canvas, displaySize);
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 });
                const detection = await faceapi.detectSingleFace(video, options);
                const ctx = canvas ? canvas.getContext('2d') : null;
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (detection) {
                    const resized = faceapi.resizeResults(detection, displaySize);
                    if (canvas) faceapi.draw.drawDetections(canvas, resized);
                    if (statusDiv) { statusDiv.className = 'face-detection-status success'; statusDiv.textContent = '✅ Rostro humano detectado. ¡Listo para capturar!'; }
                    if (modalCaptureBtn) { modalCaptureBtn.disabled = false; modalCaptureBtn.innerHTML = '<i class="fas fa-check-circle"></i> ¡Capturar Selfie!'; modalCaptureBtn.style.background = '#00ff00'; modalCaptureBtn.style.color = '#000'; }
                } else {
                    if (statusDiv) { statusDiv.className = 'face-detection-status detecting'; statusDiv.textContent = '🔍 Buscando rostro... Centra tu cara en el cuadro.'; }
                    if (modalCaptureBtn) { modalCaptureBtn.disabled = true; modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Esperando rostro...'; modalCaptureBtn.style.background = ''; modalCaptureBtn.style.color = ''; }
                }
            } catch (err) { console.error('⚠️ Error en detección facial:', err); }
            trackingAnimationId = requestAnimationFrame(detect);
        };
        detect();
    }

    function closeCamera() {
        if (trackingAnimationId) { cancelAnimationFrame(trackingAnimationId); trackingAnimationId = null; }
        const canvas = document.getElementById('faceCanvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
        if (modalVideo) modalVideo.srcObject = null;
        if (cameraModal) cameraModal.classList.remove('show');
    }

    const btnCloseCamera = document.getElementById('btnCloseCamera');
    if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);

    if (modalCaptureBtn) {
        modalCaptureBtn.addEventListener('click', function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = modalVideo.videoWidth;
            canvas.height = modalVideo.videoHeight;
            ctx.drawImage(modalVideo, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);

            if (currentCameraType === 'avatar') {
                redimensionarImagen(imageData, 300, 300, (dataResized) => {
                    tempAvatarData = dataResized;
                    mostrarAvatar(tempAvatarData, nombreOriginal);
                    showProfileMessage('📷 Foto capturada. Pulsa "Guardar Cambios" para aplicarla.', 'info');
                });
            } else {
                const fieldMap = {
                    'docFront': { url: 'docFrontalUrl', status: 'docFront', required: true },
                    'docBack': { url: 'docTraseroUrl', status: 'docBack', required: false },
                    'selfie': { url: 'selfieUrl', status: 'selfie', required: true }
                };
                const field = fieldMap[currentCameraType];
                if (field) {
                    const inputEl = document.getElementById(field.url);
                    if (inputEl) inputEl.value = imageData;
                    setDocStatus(currentCameraType, 'pending-save');
                }
            }
            closeCamera();
        });
    }

    document.querySelectorAll('[data-camera-btn]').forEach(btn => {
        btn.addEventListener('click', () => { if (!btn.disabled) openCamera(btn.dataset.cameraBtn); });
    });

    // ========== ENVIAR KYC CON MODAL DE TÉRMINOS ==========
    const fullProfileForm = document.getElementById('fullProfileForm');
    const termsModal = document.getElementById('termsModal');
    const termsCheckbox = document.getElementById('termsCheckbox');
    const acceptTermsBtn = document.getElementById('acceptTermsBtn');
    const rejectTermsBtn = document.getElementById('rejectTermsBtn');

    if (fullProfileForm) {
        fullProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Detenemos el envío real
            
            if (perfilBloqueado) { 
                showMessage('⚠️ No puedes modificar estos datos mientras tu KYC está en revisión o verificado.', 'error'); 
                return; 
            }

            const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const fechaNacimiento = val('fechaNacimiento');
            const docFrontal = val('docFrontalUrl');
            const selfie = val('selfieUrl');

            if (!fechaNacimiento) { showMessage('Por favor, selecciona tu fecha de nacimiento.', 'error'); return; }
            if (!edadValida) { showMessage('⚠️ Debes ser mayor de 18 años para registrarte.', 'error'); return; }
            if (!docFrontal) { showMessage('Por favor, toma una foto del frente de tu documento.', 'error'); return; }
            if (!selfie) { showMessage('Por favor, toma una selfie con detección facial.', 'error'); return; }

            // MOSTRAR EL MODAL DE TÉRMINOS
            if (termsModal) {
                termsCheckbox.checked = false;
                acceptTermsBtn.disabled = true;
                termsModal.classList.add('show');
                console.log('✅ Modal de términos mostrado correctamente');
            } else {
                console.error('❌ ERROR: No se encontró el modal #termsModal en el HTML. Revisa perfil.html');
                alert('Error: Falta el modal de términos en el HTML.');
            }
        });
    }

    if (termsCheckbox && acceptTermsBtn) {
        termsCheckbox.addEventListener('change', function() {
            acceptTermsBtn.disabled = !this.checked;
        });
    }

    if (rejectTermsBtn && termsModal) {
        rejectTermsBtn.addEventListener('click', () => {
            termsModal.classList.remove('show');
            showMessage('⚠️ Debes aceptar los términos y condiciones para continuar.', 'info');
        });
    }

    if (acceptTermsBtn) {
        acceptTermsBtn.addEventListener('click', async () => {
            if (termsModal) termsModal.classList.remove('show');
            
            const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo documentos...'; }
            showMessage('📤 Procesando imágenes y enviando a verificación...', 'info');

            try {
                const rutaFront = `${currentUserId}/doc_front_${Date.now()}.jpg`;
                const urlFront = await subirImagenAStorage(val('docFrontalUrl'), rutaFront);

                let urlBack = perfilActual.documento_trasero_url;
                const docTrasero = val('docTraseroUrl');
                if (docTrasero && docTrasero.startsWith('data:')) {
                    const rutaBack = `${currentUserId}/doc_back_${Date.now()}.jpg`;
                    urlBack = await subirImagenAStorage(docTrasero, rutaBack);
                }

                const rutaSelfie = `${currentUserId}/selfie_${Date.now()}.jpg`;
                const urlSelfie = await subirImagenAStorage(val('selfieUrl'), rutaSelfie);

                const datos = {
                    nombre: nombreOriginal,
                    telefono: val('phoneCountry') + ' ' + val('telefono'),
                    fecha_nacimiento: val('fechaNacimiento'),
                    nacionalidad: val('nacionalidad'),
                    direccion: val('direccion'),
                    ciudad: val('ciudad'),
                    estado_provincia: val('estadoProvincia'),
                    pais: val('pais'),
                    codigo_postal: val('codigoPostal'),
                    tipo_documento: val('tipoDocumento'),
                    numero_documento: val('numeroDocumento'),
                    documento_frontal_url: urlFront,
                    documento_trasero_url: urlBack || null,
                    selfie_url: urlSelfie,
                    estado_kyc: 'pendiente',
                    acepto_terminos: true,
                    fecha_aceptacion_terminos: new Date().toISOString(),
                    ultima_actualizacion: new Date().toISOString()
                };

                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando en base de datos...';
                
                const { error } = await db.from('perfiles').update(datos).eq('id', currentUserId);
                if (error) throw error;

                showMessage('✅ Perfil guardado, Términos aceptados y KYC enviado. Un administrador revisará tus documentos pronto.', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);

            } catch (err) {
                console.error('Error al enviar KYC:', err);
                showMessage('❌ Error al procesar: ' + err.message, 'error');
                if (submitBtn) { 
                    submitBtn.disabled = false; 
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC'; 
                }
            }
        });
    }

    llenarSelectoresPaises();
    preloadFaceModels();
    cargarPerfil();
});
