export async function* streamChat(prompt: string): AsyncGenerator<string> {
  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: localStorage.getItem('kga-model') || 'llama3.1:8b',
        stream: true,
        prompt,
      }),
    });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines.filter(Boolean)) {
        try { yield JSON.parse(line).response ?? ''; } catch { /* riga parziale */ }
      }
    }
  } catch {
    yield '⚠️ Ollama non raggiungibile — avvialo per usare il tutor.';
  }
}