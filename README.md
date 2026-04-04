# SMT visualizer

Visualizzatore web statico per esplorare, validare e modificare una state machine a partire da `Broker XML` e `Kernel XML`.

## Live

[Apri la pagina GitHub Pages](https://phantonull.github.io/smt-visualizer/)

## Funzionalità principali

- rendering del grafo in modalità `2D` e `3D`
- drag & drop dei nodi con layout salvato in sessione
- tooltip e aggregazione delle transizioni per grafi densi
- evidenziazione di reachability, stati finali e stati non raggiungibili
- `edit mode` per creare, modificare e cancellare stati e transizioni
- editor XML dedicati per broker e kernel con validazione e diagnostica
- validazione semantica della macchina oltre al semplice parse XML
- export del grafo in `PNG`
- interfaccia localizzata `IT` / `EN`

## Uso rapido

1. Apri la pagina.
2. Incolla oppure carica `Broker XML` e `Kernel XML`.
3. Esplora il grafo, regola la spaziatura o cambia vista `2D` / `3D`.
4. Attiva la `edit mode` per modificare direttamente la macchina.

## Note

- Il progetto è una pagina web statica: non richiede backend.
- Il salvataggio diretto su file dipende dal supporto del browser alla File System Access API.
- In browser che non supportano bene alcune emoji di sistema, alcuni elementi UI possono essere resi in modo diverso.

## Licenza

Contenuto distribuito con licenza **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

Autore: **PhantoNull**
