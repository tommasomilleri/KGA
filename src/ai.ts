// src/ai.ts

export async function generateNodeInfo(term: string): Promise<string> {
    console.log(`Richiesta IA per il termine: ${term}...`);
    
    try {
        // Proviamo a contattare OLLAMA (IA Locale)
        // Assicurati di avere Ollama aperto sul PC e di aver scaricato un modello (es. scrivendo 'ollama run llama3' nel terminale)
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', // Puoi cambiarlo con 'mistral', 'phi3', ecc.
                prompt: `Sei KGA, un assistente per un Personal Knowledge Graph. Fornisci una definizione concisa e chiara (massimo 3 o 4 frasi) del termine: "${term}". Se pertinente, accenna alla sua etimologia o origine. Rispondi solo con la definizione, senza convenevoli.`,
                stream: false
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.response;
        } else {
            throw new Error("Errore API Ollama");
        }
    } catch (e) {
        console.warn("Ollama non raggiungibile. Uso il testo di fallback.");
        
        // Fallback: Se Ollama non è acceso o non è installato, restituiamo questo testo.
        // In futuro, potremo aggiungere qui la chiamata alle API di OpenAI o Claude!
        return `Questa è una scheda generata offline per il termine "${term}". 
        
Per generare definizioni reali automaticamente, assicurati di avere Ollama in esecuzione sul tuo PC (porta 11434) o configura una chiave API (es. OpenAI).`;
    }
}
