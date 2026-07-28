// src/ai/ollama.ts
export async function* streamDefinition(term: string): AsyncGenerator<string> {
  try {
      const r = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localStorage.getItem('kga-model') ?? 'llama3',
          stream: true,
          prompt: `Definizione concisa (max 4 frasi, italiano) di: "${term}"`,
        }),
      });
      
      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n').filter(Boolean)) {
          yield JSON.parse(line).response ?? '';
        }
      }
  } catch(e) {
      yield "Nessuna IA locale rilevata. Usa un servizio cloud o avvia Ollama.";
  }
}