import { Pane } from 'tweakpane';

export function initUI(onAddNode: (label: string) => void) {
    const pane = new Pane({ title: 'KGA Control Panel' });
    
    // I parametri che l'utente può modificare
    const PARAMS = {
        newNode: '',
    };

    const addFolder = pane.addFolder({ title: 'Aggiungi Conoscenza' });
    
    // Casella di testo per inserire il termine
    addFolder.addBinding(PARAMS, 'newNode', { label: 'Termine' });
    
    // Bottone che si attiva quando ci clicchi
    addFolder.addButton({ title: 'Aggiungi al Grafo' }).on('click', () => {
        if (PARAMS.newNode.trim() !== '') {
            onAddNode(PARAMS.newNode.trim()); // Passa il testo a main.ts
            PARAMS.newNode = ''; // Svuota la casella di testo dopo aver aggiunto
            pane.refresh(); // Aggiorna l'interfaccia visivamente
        }
    });

    return pane;
}