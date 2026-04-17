const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializar Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lista completa de ODG (se carga desde el JSON)
const odgList = require("./listado_odg_completo.json");

/**
 * Cloud Function para clasificar gastos usando Gemini AI
 * Acepta descripción de texto y/o imagen de factura
 */
exports.clasificarGasto = onRequest(
  {
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    // Solo permitir POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    try {
      const { descripcion, imagenBase64 } = req.body;

      if (!descripcion && !imagenBase64) {
        return res.status(400).json({
          error: "Se requiere descripción o imagen"
        });
      }

      // Construir el prompt para Gemini
      const prompt = construirPrompt(descripcion, odgList);

      // Inicializar modelo Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      let result;

      if (imagenBase64) {
        // Clasificación con imagen + texto
        const imagePart = {
          inlineData: {
            data: imagenBase64,
            mimeType: "image/jpeg",
          },
        };

        result = await model.generateContent([prompt, imagePart]);
      } else {
        // Clasificación solo con texto
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      const text = response.text();

      // Parsear la respuesta de Gemini
      const clasificacion = parsearRespuesta(text, odgList);

      // Calcular total
      const total = clasificacion.reduce(
        (sum, item) => sum + parseFloat(item.importe || 0),
        0
      );

      res.json({
        clasificacion,
        total,
        rawResponse: text,
      });

    } catch (error) {
      console.error("Error en clasificación:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor"
      });
    }
  }
);

/**
 * Construye el prompt para enviar a Gemini
 */
function construirPrompt(descripcion, odgList) {
  const odgJson = JSON.stringify(odgList.slice(0, 100), null, 2); // Limitar a 100 para el contexto

  return `
Eres un clasificador de gastos públicos uruguayos. Tu tarea es analizar la descripción de un gasto y/o factura, y clasificarlo según los Objetos del Gasto (ODG) del presupuesto nacional.

LISTA DE ODG DISPONIBLES:
${odgJson}

INSTRUCCIONES:
1. Analizá la descripción del gasto proporcionada
2. Identificá cada ítem o concepto mencionado
3. Para cada ítem, asigná el código ODG más apropiado de la lista
4. Estimá un importe razonable para cada ítem (si no se menciona explícitamente)
5. Respondé EXCLUSIVAMENTE en formato JSON como este:

{
  "items": [
    {
      "codigo": "122-000",
      "descripcion": "Uniformes de trabajo",
      "importe": 15000
    },
    {
      "codigo": "132-000",
      "descripcion": "Papel y cartón para oficina",
      "importe": 5000
    }
  ]
}

REGLAS:
- Usá solo códigos ODG de la lista proporcionada
- Si un ítem no coincide exactamente, elegí el más cercano
- Los importes deben ser números positivos
- No incluyas texto fuera del JSON

DESCRIPCIÓN DEL GASTO A CLASIFICAR:
${descripcion || "Analizá la factura adjunta y clasificá los ítems"}
`.trim();
}

/**
 * Parsea la respuesta de Gemini y extrae la clasificación
 */
function parsearRespuesta(text, odgList) {
  try {
    // Intentar extraer JSON del texto
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No se encontró JSON en la respuesta:", text);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validar estructura
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return [];
    }

    // Mapear a formato esperado y validar códigos ODG
    return parsed.items
      .filter(item => {
        const odgValido = odgList.some(
          odg => odg.numero === item.codigo
        );
        if (!odgValido) {
          console.log("ODG no válido:", item.codigo);
        }
        return odgValido;
      })
      .map(item => ({
        codigo: item.codigo,
        descripcion: item.descripcion,
        importe: parseFloat(item.importe) || 0,
      }));

  } catch (error) {
    console.error("Error parseando respuesta:", error);
    return [];
  }
}
