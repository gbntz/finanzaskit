const { onRequest } = require("firebase-functions/v2/https");

// Lista completa de ODG (se carga desde el JSON)
const odgList = require("./listado_odg_completo.json");

/**
 * Cloud Function para clasificar gastos usando OpenRouter (Gemini Free)
 */
exports.clasificarGasto = onRequest(
  {
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    // Manejo de preflight CORS
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

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

      // Construir el prompt
      const prompt = construirPrompt(descripcion, odgList);

      // Armar el contenido del mensaje
      let contentPayload;
      if (imagenBase64) {
        contentPayload = [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imagenBase64}`
            }
          }
        ];
      } else {
        contentPayload = prompt;
      }

      // Llamada a la API de OpenRouter
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://finanzaskit.web.app",
          "X-Title": "FinanzasKit"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            {
              role: "user",
              content: contentPayload
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || "Error al consultar OpenRouter");
      }

      const text = data.choices[0].message.content;

      // Parsear la respuesta de la IA
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
 * Construye el prompt para enviar a la IA
 */
function construirPrompt(descripcion, odgList) {
  const odgJson = JSON.stringify(odgList.slice(0, 100), null, 2);

  return `
Eres un clasificador de gastos públicos uruguayos. Tu tarea es analizar la descripción de un gasto y/o factura, y clasificarlo según los Objetos del Gasto (ODG) del presupuesto nacional.

LISTA DE ODG DISPONIBLES:
${odgJson}

INSTRUCCIONES:
1. Analizá la descripción del gasto proporcionada
2. Identificá cada ítem o concepto mencionado
3. Para cada ítem, asigná el código ODG más apropiado de la lista
4. Estimá un importe razonable para cada ítem (si no se menciona explícitamente)
5. Respondé EXCLUSIVAMENTE en formato JSON plano como este ejemplo:

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
- No agregues explicaciones ni texto fuera del bloque JSON

DESCRIPCIÓN DEL GASTO A CLASIFICAR:
${descripcion || "Analizá la factura adjunta y clasificá los ítems"}
`.trim();
}

/**
 * Parsea la respuesta y extrae la clasificación
 */
function parsearRespuesta(text, odgList) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No se encontró JSON en la respuesta:", text);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return [];
    }

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
