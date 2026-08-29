# GMOCU architecture diagram

## 1) Logical component diagram

```mermaid
flowchart LR
    UI[PySimpleGUI Desktop UI] --> EV[Event Loop]
    EV --> APP[gmocu.py Application Logic]
    APP --> DBL[pysimplesqlmod mapping layer]
    DBL --> SQL[(SQLite gmocu.db)]
    APP --> SQL
    APP --> REP[Report/Export Engine]
    APP --> SYNC[Glossary Sync Engine]
    APP --> PUB[Publishing Engine]

    SYNC --> GS[Google Sheets API]
    PUB --> ICE[JBEI/ICE API]
    PUB --> FB[Filebrowser API]
    PUB --> GD[Google Drive API]
    REP --> XLSX[Excel Files]
    PUB --> FS[Local export tree in user folder]
```

## 2) Runtime sequence (high level)

```mermaid
sequenceDiagram
    participant User
    participant UI as PySimpleGUI UI
    participant App as gmocu.py
    participant DB as SQLite
    participant Ext as External Services

    User->>UI: Trigger action (edit/sync/export/upload)
    UI->>App: Event + values
    App->>DB: Read/write data
    App->>Ext: Optional API calls
    App->>DB: Persist updates
    App->>UI: Refresh table controls/messages
```

## 3) Data model relationship diagram

```mermaid
erDiagram
    Plasmids ||--o{ Cassettes : has
    Plasmids ||--o{ GMOs : has
    Plasmids ||--o{ Attachments : has
    SelectionValues ||--o{ Plasmids : status
    IceCredentials ||--o{ Settings : selectedBy

    Plasmids {
        int id PK
        text name
        text alias
        int status FK
    }
    Cassettes {
        int cassette_id PK
        text content
        int plasmid_id FK
    }
    GMOs {
        int organism_id PK
        text organism_name
        int plasmid_id FK
    }
    Attachments {
        int attach_id PK
        blob file
        int plasmid_id FK
    }
    Features {
        int id PK
        text annotation
        text uid
    }
    Organisms {
        int id PK
        text short_name
        text uid
    }
```

## 4) Architectural characteristics (current)

- Monolithic application script with integrated UI + domain + integration logic.
- Stateful desktop loop with local SQLite as system of record.
- Partial abstraction over DB through PySimpleSQL-style mapper, mixed with direct SQL.
- Synchronous integration calls from UI thread.
