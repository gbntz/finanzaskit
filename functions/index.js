const { onRequest } = require("firebase-functions/v2/https");

// Cargar listado de ODG (está en la misma carpeta)
let odgList = [];
try {
  odgList = require("./listado_odg_completo.json");
} catch (e) {
  console.log("No se encontró listado_odg_completo.json localmente.");
}

exports.clasificarGasto = onRequest(
  {
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: ["OPENROUTER_API_KEY"], 
  },
  async (req, res) => {
    // Manejo de preflight CORS
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    try {
      const { descripcion, imagenBase64 } = req.body || {};

      if (!descripcion && !imagenBase64) {
        return res.status(400).json({ error: "Se requiere descripción o imagen" });
      }

      // Preparar el contexto de ODG para el prompt
      const odgContext = JSON.stringify(odgList.slice(0, 100), null, 2);

      const prompt = `
Eres un clasificador de gastos públicos uruguayos. Tu tarea es analizar la descripción de un gasto y/o factura y clasificarlo según los Objetos del Gasto (ODG).

LISTA DE ODG DISPONIBLES:
${odgContext}

INSTRUCCIONES:
1. Analizá el gasto y asigná el código ODG correspondiente.
2. Estimá un importe razonable para cada ítem.
3. Respondé EXCLUSIVAMENTE con un JSON válido con esta estructura (sin texto adicional ni bloques markdown):

{
  "items": [
    {
      "codigo": "122-000",
      "descripcion": "Descripción del ítem",
      "importe": 1000
    }
  ]
}

GASTO A CLASIFICAR:
${descripcion || "Analizá la factura adjunta"}
`.trim();

      let contentPayload;
      if (imagenBase64) {
        contentPayload = [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imagenBase64}` }
          }
        ];
      } else {
        contentPayload = prompt;
      }

      // Llamada a OpenRouter usando el token guardado en el secreto
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://finanzaskit.web.app",
          "X-Title": "FinanzasKit"
        },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [{ role: "user", content: contentPayload }]
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || "Error devuelto por OpenRouter");
      }

      const text = data.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("La IA no devolvió un formato JSON válido");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const items = parsed.items || [];
      const clasificacion = items.map(item => ({
        codigo: item.codigo || "000-000",
        descripcion: item.descripcion || "Gasto general",
        importe: parseFloat(item.importe) || 0
      }));

      const total = clasificacion.reduce((sum, item) => sum + item.importe, 0);

      return res.status(200).json({ clasificacion, total, rawResponse: text });

    } catch (error) {
      console.error("Error en clasificación:", error);
      return res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  }
);
