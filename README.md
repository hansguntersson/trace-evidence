# Trace Evidence — HTML prototype

Mobile-first detective investigation prototype. Runs as a **local HTML file** — no server required.

## Open locally

Double-click **`index.html`**, or open it in any browser (Chrome, Edge, Firefox, Safari).

Keep the folder structure intact:

```
Prototype/
  index.html
  css/app.css
  js/
    case1-data.js      ← game data (embedded)
    resources-data.js
    cases-data.js
    engine.js
    ui.js
    app.js
```

## Edit case data

1. Edit JSON in `data/` (easier to read).
2. Regenerate embedded scripts:

```powershell
cd Prototype
python -c "
import json, pathlib
base = pathlib.Path('data')
out = pathlib.Path('js')
for src, var, dst in [
    ('case1_data.json', 'CASE1_DATA', 'case1-data.js'),
    ('resources.json', 'RESOURCES_DATA', 'resources-data.js'),
    ('cases.json', 'CASES_LIST_DATA', 'cases-data.js'),
]:
    data = json.loads((base / src).read_text(encoding='utf-8'))
    (out / dst).write_text('window.' + var + ' = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')
"
```

## Optional: host on a server

You can still serve the folder if you prefer (`python -m http.server 3456`). Behaviour is the same.

## Play Case 1

**START INVESTIGATING** → **THE MOPED THEFT** (case 01).
