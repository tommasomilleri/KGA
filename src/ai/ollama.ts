export async function* streamDefinition(term: string): AsyncGenerator<string> {
  try {
    console.log(`[AI] 3. Chiedo la definizione a Ollama per: "${term}"...`);
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: localStorage.getItem('kga-model') ?? 'llama3.1:8b',
        stream: true,
        prompt: `Definizione concisa (max 4 frasi, italiano) di: "${term}"`,
      }),
    });
    
    if (!r.ok) {
        console.error(`[AI] ❌ Errore generazione (Codice ${r.status})`);
        throw new Error(`Ollama HTTP ${r.status}`);
    }

    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    console.log(`[AI] ✅ Ollama sta scrivendo il testo in streaming...`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines.filter(Boolean)) {
        try { yield JSON.parse(line).response ?? ''; } catch {}
      }
    }
    console.log(`[AI] 🏁 Definizione completata!`);
  } catch(e) {
    console.error(`[AI] ❌ Generazione fallita:`, e);
    yield "\n\n⚠️ Errore: Ollama non risponde. Controlla che sia acceso e funzionante.";
  }
}