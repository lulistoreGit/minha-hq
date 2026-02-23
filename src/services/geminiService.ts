import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
};

export async function generateComicStory(prompt: string, language: string = "pt-BR") {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Crie uma história curta para uma história em quadrinhos baseada no seguinte tema: "${prompt}". 
    Retorne a história dividida em 4 a 6 painéis. 
    Para cada painel, forneça uma descrição visual detalhada (para geração de imagem) e um texto de legenda ou balão de fala.
    O idioma da resposta deve ser ${language}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          panels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                visualDescription: { type: Type.STRING },
                caption: { type: Type.STRING }
              },
              required: ["visualDescription", "caption"]
            }
          }
        },
        required: ["title", "panels"]
      }
    }
  });

  try {
    const text = response.text || "{}";
    // Remove markdown code blocks if present
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse AI response:", response.text);
    return { title: "História Sem Título", panels: [] };
  }
}

export async function generatePanelImage(description: string, referenceImageBase64?: string) {
  const ai = getAI();
  
  const parts: any[] = [
    { text: `Gere uma imagem de estilo história em quadrinhos (comic book style) baseada na seguinte descrição: ${description}. Use cores vibrantes e traços fortes.` }
  ];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        data: referenceImageBase64.split(',')[1] || referenceImageBase64,
        mimeType: "image/png"
      }
    });
    parts[0].text += " Incorpore as características da pessoa/objeto na imagem enviada para que o personagem se pareça com ela.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  return null;
}

export async function translateText(text: string, targetLanguage: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Traduza o seguinte texto para o idioma "${targetLanguage}":\n\n${text}`,
  });
  return response.text;
}
