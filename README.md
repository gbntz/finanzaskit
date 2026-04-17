# FinanzasKit

Clasificador de gastos con Inteligencia Artificial para el sector público uruguayo.

## Descripción

FinanzasKit utiliza la API de Gemini (Google) para analizar descripciones de gastos y/o fotos de facturas, y clasificar automáticamente los conceptos según los **Objetos del Gasto (ODG)** del presupuesto nacional uruguayo.

### Características

- 📝 **Entrada de texto**: Describí el gasto y la IA lo clasifica
- 📷 **OCR con IA**: Subí una foto de la factura y extrae los ítems automáticamente
- 📊 **Clasificación ODG**: Asigna cada ítem al código ODG correspondiente
- 💰 **Cálculo de importes**: Estima o extrae los importes de cada concepto
- 🔒 **API Key oculta**: La clave de Gemini está segura en el backend (Firebase Functions)

## Estructura del Proyecto

```
finanzaskit/
├── index.html              # Frontend (interfaz web)
├── functions/              # Backend (Firebase Functions)
│   ├── index.js            # Cloud Function para clasificación
│   ├── package.json        # Dependencias de functions
│   └── listado_odg_completo.json  # Base de datos de ODG
├── firebase.json           # Configuración de Firebase
├── .firebaserc             # Configuración del proyecto
├── config.json             # API keys (no commitear)
└── package.json            # Scripts y dependencias
```

## Configuración Inicial

### 1. Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Iniciar sesión en Firebase

```bash
firebase login
```

### 3. Configurar la API de Gemini

1. Obtené tu API key en [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Creá un archivo `.env` en la carpeta `functions/`:

```
GEMINI_API_KEY=tu_api_key_aqui
```

### 4. Instalar dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Instalar dependencias de functions
npm run install:functions
```

## Deploy

### Deploy completo (Hosting + Functions)

```bash
npm run deploy
```

### Solo Hosting

```bash
npm run deploy:hosting
```

### Solo Functions

```bash
npm run deploy:functions
```

## Uso

1. Abrí la web en `https://finanzaskit.web.app`
2. Ingresá una descripción del gasto **o** subí una foto de la factura
3. Hacé clic en **"Clasificar con IA"**
4. La IA devolverá una tabla con:
   - Código ODG
   - Descripción del ítem
   - Importe asignado

## Ejemplo

**Entrada:**
> "Compra de 50 sillas de oficina ergonómicas, 10 escritorios de madera, y material de papelería (resmas de papel, bolígrafos, carpetas)"

**Salida:**
| ODG | Descripción | Importe |
|-----|-------------|---------|
| 122-000 | Sillas y mobiliario de oficina | $75,000 |
| 122-000 | Escritorios de madera | $50,000 |
| 132-000 | Papel y cartón para oficina | $5,000 |
| **Total** | | **$130,000** |

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend**: Firebase Functions (Node.js 18)
- **IA**: Gemini 2.0 Flash (Google)
- **Hosting**: Firebase Hosting
- **ODG**: Listado oficial del presupuesto uruguayo

## Consideraciones

- La API de Gemini tiene un costo después de cierto número de requests (ver [pricing](https://ai.google.dev/pricing))
- El timeout de la función está configurado en 60 segundos
- Las imágenes se envían en base64 (máximo ~10MB)

## Desarrollo

### Correr localmente con emuladores

```bash
npm run serve
```

Luego abrir `http://localhost:5000`

## Licencia

ISC

## Autor

gbntz - [GitHub](https://github.com/gbntz/finanzaskit)
